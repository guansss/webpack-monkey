// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule"

import { access, readFile } from "fs/promises"
import { castArray, compact, find, isObject, isString, without } from "lodash"
import path from "path"
import { Writable } from "type-fest"
import { Chunk, Compilation, Compiler, EntryPlugin, ExternalModule, sources } from "webpack"
import { getGMAPIs } from "../shared/GM"
import {
  CLIENT_SCRIPT,
  DEV_SCRIPT,
  VAR_MK_DEV_INJECTION,
  VAR_MK_GLOBAL,
  VAR_MK_INJECTION,
} from "../shared/constants"
import { UserscriptMeta } from "../shared/meta"
import { MonkeyDevInjection, UserscriptInfo } from "../types/userscript"
import { MaybePromise } from "../types/utils"
import { colorize } from "./color"
import { generateMetaBlock, getPackageDepVersion, getPackageJson } from "./utils"

const { RawSource, ConcatSource } = sources

type RequireResolver = (args: {
  name: string
  externalType: string
  version?: string
  packageVersion?: string
}) => MaybePromise<string | undefined>

type CdnProvider = "jsdelivr" | "unpkg"

type MetaResolver = (
  args: { entryName: string; entry: string },
  context: MonkeyWebpackPlugin
) => MaybePromise<string | undefined>
type MetaLoader = (
  args: { file: string },
  context: MonkeyWebpackPlugin
) => MaybePromise<UserscriptMeta>
type metaTransformer = (
  meta: UserscriptMeta,
  context: MonkeyWebpackPlugin
) => MaybePromise<UserscriptMeta>

type WebpackLogger = Compilation["logger"]
type EntryDependency = ReturnType<(typeof EntryPlugin)["createDependency"]>

export interface MonkeyWebpackPluginOptions {
  require?:
    | CdnProvider
    | RequireResolver
    | ({
        lockVersions?: boolean
        provider?: CdnProvider
      } & Record<string, string>)
  meta?: {
    resolve?: string | string[] | MetaResolver
    loader?: MetaLoader
    transform?: metaTransformer
  }
  devScript?: {
    name?: string
    transform?: (content: string) => string
  }
  debug?: boolean
}

const isServe = process.env.WEBPACK_SERVE === "true"
const isBuild = !isServe

const cdnProviders: Record<CdnProvider, string> = {
  jsdelivr: "https://cdn.jsdelivr.net/npm",
  unpkg: "https://unpkg.com",
}

function createRequireResolver({
  // don't confuse with the `require()` function
  require: requireOpt,
}: MonkeyWebpackPluginOptions): RequireResolver {
  return (args) => {
    if (typeof requireOpt === "function") {
      return requireOpt(args)
    }

    const { name, version, packageVersion } = args

    if (isObject(requireOpt) && requireOpt[name]) {
      return requireOpt[name]
    }

    const lockVersions = isString(requireOpt) ? false : !!requireOpt?.lockVersions

    if (lockVersions && !packageVersion) {
      throw new Error(
        `"lockVersions" is enabled but the version of "${name}" could not be found, probably because this package is not installed as a direct dependency.`
      )
    }

    const cdnProvider = isString(requireOpt)
      ? requireOpt
      : (requireOpt?.provider as CdnProvider) ?? "unpkg"

    const baseUrl = cdnProviders[cdnProvider]

    if (!baseUrl) {
      throw new Error(`Unknown CDN provider: ${cdnProvider}`)
    }

    let versionDef = lockVersions ? packageVersion : version

    if (versionDef) {
      versionDef = `@${versionDef}`
    }

    return encodeURI(`${baseUrl}/${name}${versionDef}`)
  }
}

function createMetaResolver({ meta: { resolve } = {} }: MonkeyWebpackPluginOptions): MetaResolver {
  if (typeof resolve === "function") {
    return resolve
  }

  return async (args, { logger }) => {
    const { entry } = args

    // if the entry has no extension, we assume it's a directory
    const dir = path.extname(entry) ? path.dirname(entry) : entry

    const candidates = compact(castArray(resolve)).concat(["meta.ts", "meta.js", "meta.json"])

    for (const filename of candidates) {
      try {
        const file = path.resolve(dir, filename)

        await access(file)

        return file
      } catch (e) {
        // ignore
      }
    }

    logger.warn(`Could not find meta file for entry "${entry}"`)

    return undefined
  }
}

function createMetaLoader({ meta: { loader } = {} }: MonkeyWebpackPluginOptions): MetaLoader {
  if (typeof loader === "function") {
    return loader
  }

  return async ({ file }) => {
    const ext = path.extname(file)
    const supportedExtensions = [".ts", ".js", ".json"]

    if (!supportedExtensions.includes(ext)) {
      throw new Error(
        `Unknown meta file extension: "${file}". Expected one of: ${supportedExtensions.join(", ")}`
      )
    }

    const content = require(file)

    if (content.__esModule && content.default) {
      return content.default as UserscriptMeta
    }

    return content as UserscriptMeta
  }
}

export class MonkeyWebpackPlugin {
  options: MonkeyWebpackPluginOptions
  requireResolver: RequireResolver
  metaResolver: MetaResolver
  metaLoader: MetaLoader
  metaTransformer?: metaTransformer

  userscripts: Omit<UserscriptInfo, "url">[] = []
  userscriptsLoaded = Promise.resolve()

  receivePort?: Promise<number>
  readonly setPort = (port: number) => {}

  // assume that we won't call it before ready
  logger!: WebpackLogger

  constructor(options: MonkeyWebpackPluginOptions = {}) {
    this.options = options
    this.requireResolver = createRequireResolver(options)
    this.metaResolver = createMetaResolver(options)
    this.metaLoader = createMetaLoader(options)
    this.metaTransformer = options.meta?.transform

    if (isServe) {
      this.receivePort = new Promise((resolve) => {
        let resolved = false

        const timer = setTimeout(() => {
          if (!resolved) {
            this.logger.warn("Port not received after 10 seconds, assuming 8080.")
            resolve(8080)
          }
        }, 1000 * 10)

        ;(this as Writable<this>).setPort = (port) => {
          if (resolved) {
            this.logger.warn("setPort() called multiple times, ignoring.")
            return
          }

          resolved = true
          clearTimeout(timer)
          resolve(port)
        }
      })
    }
  }

  apply(compiler: Compiler) {
    if (isServe) {
      new EntryPlugin(compiler.context, require.resolve("../client/client.ts"), {
        name: "monkey-client",
        filename: CLIENT_SCRIPT,
      }).apply(compiler)

      new EntryPlugin(compiler.context, require.resolve("../client/patches.ts"), {
        name: undefined,
      }).apply(compiler)
    }

    compiler.resolverFactory.hooks.resolver
      .for("normal")
      .tap(MonkeyWebpackPlugin.name, (resolver) => {
        resolver.hooks.result.tap(MonkeyWebpackPlugin.name, (result, ctx) => {
          // redirect to the patching scripts in order to bypass CSP when hot reloading CSS
          if (
            // expects: "<project>/node_modules/mini-css-extract-plugin/dist/hmr/hotModuleReplacement.js"
            result.path &&
            result.path.includes("mini-css-extract-plugin") &&
            result.path.includes("hotModuleReplacement.js")
          ) {
            result.path = require.resolve("./deps/mini-css-extract-hmr.js")
          }
          if (
            // expects: "<project>/node_modules/style-loader/dist/runtime/insertStyleElement.js"
            result.path &&
            result.path.includes("style-loader") &&
            result.path.includes("insertStyleElement.js")
          ) {
            result.path = require.resolve("./deps/style-loader-insertStyleElement.js")
          }
          return result
        })
      })

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        this.logger = compilation.getLogger(this.constructor.name)

        const projectPackageJson = getPackageJson(
          compilation.inputFileSystem,
          compiler.context
        ).catch((e) => {
          if (this.options.debug) {
            this.logger.warn(e)
          }
          return undefined
        })

        function findOneOrNoneJsFile(chunk: Chunk) {
          const jsFiles = Array.from(chunk.files).filter((file) => file.endsWith(".js"))

          if (isBuild && jsFiles.length > 1) {
            throw new Error(`multiple js files in chunk ${chunk.name}:\n- ${jsFiles.join("\n- ")}`)
          }

          return jsFiles[0]
        }

        compilation.hooks.succeedEntry.tap(
          this.constructor.name,
          (dependency, { name, filename }) => {
            if (!name) {
              // do not process global entries
              return
            }

            const entryFile = (dependency as EntryDependency)?.request

            if (!entryFile) {
              return
            }

            if (filename === CLIENT_SCRIPT) {
              return
            }

            const loadUserscriptPromise = (async () => {
              const metaFile = await this.metaResolver({ entryName: name, entry: entryFile }, this)

              if (!metaFile) {
                return
              }

              let meta = await this.metaLoader({ file: metaFile }, this)

              if (this.metaTransformer) {
                meta = await this.metaTransformer(meta, this)
              }

              const userscript: Omit<UserscriptInfo, "url"> = {
                name,
                entry: entryFile,
                dir: path.dirname(entryFile),
                meta,
                assets: [],
              }

              const existing = this.userscripts.find((u) => u.name === name)

              if (existing) {
                Object.assign(existing, userscript)
              } else {
                this.userscripts.push(userscript)
              }
            })()

            this.userscriptsLoaded = this.userscriptsLoaded.then(() => loadUserscriptPromise)
          }
        )

        if (isServe) {
          const originReady = this.receivePort!.then(
            (port) => `http://${compiler.options.devServer?.host || "localhost"}:${port}`
          )

          let origin: string | undefined

          originReady.then((o) => (origin = o))

          const getAssetUrl = (asset: string) => {
            if (!origin) {
              throw new Error("origin not set")
            }

            return `${origin}/${asset}`
          }

          originReady.then(() => {
            const url = getAssetUrl(DEV_SCRIPT)
            this.logger.info(
              `[webpack-monkey] Start your development by installing the dev script: ${colorize(
                "cyan",
                url
              )}`
            )
          })

          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            async (assets) => {
              await this.userscriptsLoaded
              await originReady

              const qualifiedUserscripts: UserscriptInfo[] = []

              let runtimeScript: string | undefined

              for (const [name, entrypoint] of compilation.entrypoints) {
                if (!runtimeScript) {
                  const runtimeChunk = find(entrypoint.chunks, { name: "runtime" })

                  if (runtimeChunk) {
                    runtimeScript = findOneOrNoneJsFile(runtimeChunk)
                  }
                }

                const userscript = find(this.userscripts, { name })

                if (!userscript) {
                  continue
                }

                const chunk = find(entrypoint.chunks, { name })

                if (!chunk) {
                  this.logger.warn("Chunk not found for userscript:", name)
                  continue
                }

                const file = findOneOrNoneJsFile(chunk)

                if (file && assets[file]) {
                  qualifiedUserscripts.push({
                    ...userscript,
                    url: getAssetUrl(file),

                    // when using mini-css-extract-plugin, the CSS is extracted into a separate file,
                    // we provide their URLs to the client script
                    assets: without(Array.from(chunk.files), file).map(getAssetUrl),
                  })
                } else {
                  this.logger.warn("URL not found for userscript:", name)
                  continue
                }
              }

              if (!runtimeScript || !assets[runtimeScript]) {
                this.logger.error("runtime script not found")
                return
              }

              const runtimeSource = assets[runtimeScript]!

              const newRuntimeSource = new ConcatSource(
                `window.${VAR_MK_INJECTION} = ${JSON.stringify({
                  userscripts: qualifiedUserscripts,
                })};\n\n`,
                `window.${VAR_MK_GLOBAL}.inspectRuntime = function() { console.log("runtime") };\n\n`,
                runtimeSource
              )

              compilation.updateAsset(runtimeScript, newRuntimeSource)

              let content = await readFile(path.resolve(__dirname, "../dev.user.js"), "utf-8")

              const devInjection: MonkeyDevInjection = {
                clientScript: getAssetUrl(CLIENT_SCRIPT),
                runtimeScript: getAssetUrl(runtimeScript),
              }

              content =
                `window.${VAR_MK_DEV_INJECTION} = ${JSON.stringify(devInjection)};\n\n` + content

              let devScriptName = this.options.devScript?.name

              if (!devScriptName) {
                const projectName = ((await projectPackageJson) as any)?.data?.name

                devScriptName = `[Dev] ${projectName || "untitled project"}`
              }

              content =
                generateMetaBlock("", {
                  name: devScriptName,
                  version: "1.0.0",
                  // TODO: change to *://*/*
                  match: ["*://127.0.0.1/*", "*://localhost/*"],

                  // put everything in these fields because we don't know what the userscripts will do
                  connect: "*",
                  grant: getGMAPIs(),
                }) +
                "\n\n" +
                content

              if (this.options.devScript?.transform) {
                content = this.options.devScript.transform(content)
              }

              const source = new RawSource(content)

              compilation.emitAsset(DEV_SCRIPT, source)
            }
          )
        }

        if (isBuild) {
          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
            },
            async (assets) => {
              await this.userscriptsLoaded

              await Promise.all(
                Array.from(compilation.entrypoints).map(async ([entryName, { chunks }]) => {
                  const userscript = this.userscripts.find((u) => u.name === entryName)

                  if (!userscript) {
                    return
                  }

                  await Promise.all(
                    // there's most likely only one chunk per entrypoint
                    chunks.map(async (chunk) => {
                      const jsFile = findOneOrNoneJsFile(chunk)

                      if (!jsFile) {
                        return
                      }

                      const jsSource = assets[jsFile]

                      if (!jsSource) {
                        this.logger.warn("js file not found:", jsFile)
                        return
                      }

                      const rawJsSource = jsSource.source().toString("utf-8")

                      // TODO: more reliable way to get all modules
                      const modules = compilation.chunkGraph
                        .getChunkModules(chunk)
                        .flatMap((mod) =>
                          mod instanceof ConcatenatedModule
                            ? (mod as ConcatenatedModule).modules
                            : mod
                        )

                      const externalModules = modules.filter(
                        (dep): dep is ExternalModule => dep instanceof ExternalModule
                      )

                      const requires = compact(
                        await Promise.all(
                          externalModules.map(async ({ userRequest: name, externalType }) => {
                            const version = getPackageDepVersion(
                              (await projectPackageJson)?.data,
                              name
                            )

                            let packageVersion: string | undefined

                            if (version) {
                              packageVersion = require(name).version
                            }

                            return this.requireResolver({
                              name,
                              externalType,
                              version,
                              packageVersion,
                            })
                          })
                        )
                      )

                      const newJsSource = new ConcatSource(
                        generateMetaBlock(rawJsSource, userscript.meta, { requires }),
                        "\n\n",
                        rawJsSource
                      )

                      compilation.updateAsset(jsFile, newJsSource)
                    })
                  )
                })
              )
            }
          )

          compilation.hooks.processAssets.tap(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
            },
            (assets) => {
              for (const chunk of compilation.chunks) {
                const jsFile = findOneOrNoneJsFile(chunk)
                const cssFiles = Array.from(chunk.files).filter((file) => file.endsWith(".css"))

                if (!jsFile || !cssFiles.length) {
                  continue
                }

                const jsSource = assets[jsFile]

                if (!jsSource) {
                  this.logger.warn("js file not found:", jsFile)
                  continue
                }

                const concatenatedCss = new ConcatSource()

                for (const cssFile of cssFiles) {
                  const cssAsset = assets[cssFile]

                  if (cssAsset) {
                    this.logger.info("inlining CSS:", cssFile)

                    concatenatedCss.add(cssAsset)
                    compilation.deleteAsset(cssFile)
                  } else {
                    this.logger.warn("css file not found:", cssFile)
                  }
                }

                const newJsSource = new ConcatSource(
                  jsSource,
                  "\nGM_addStyle(`\n",
                  concatenatedCss,
                  "`)\n"
                )
                compilation.updateAsset(jsFile, newJsSource)
              }
            }
          )
        }
      }
    )
  }
}
