// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule"

import { access, readFile } from "fs/promises"
import { castArray, compact, find, isObject, isString } from "lodash"
import path from "path"
import { Writable } from "type-fest"
import {
  Chunk,
  Compilation,
  Compiler,
  EntryPlugin,
  ExternalModule,
  RuntimeModule,
  sources,
} from "webpack"
import {
  CLIENT_SCRIPT,
  DEV_SCRIPT,
  VAR_MK_DEV_INJECTION,
  VAR_MK_INJECTION,
} from "../shared/constants"
import { getGMAPIs } from "../shared/GM"
import { UserscriptMeta } from "../shared/meta"
import { overrideValue } from "../shared/patching"
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

type WebpackLogger = Compilation["logger"]
type EntryDependency = ReturnType<(typeof EntryPlugin)["createDependency"]>

export interface MonkeyWebpackPluginOptions {
  serve?: boolean
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
  }
  transformDevEntry?: (content: string) => string
}

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
        `"exactVersion" is enabled but the package version could not be found, probably because the package is not installed.`
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

  userscripts: Omit<UserscriptInfo, "url">[] = []
  userscriptFinished = Promise.resolve()

  receivePort: Promise<number>
  readonly setPort!: (port: number) => void

  // assume that we won't call it before ready
  logger!: WebpackLogger

  constructor(options: MonkeyWebpackPluginOptions = {}) {
    this.options = options
    this.requireResolver = createRequireResolver(options)
    this.metaResolver = createMetaResolver(options)
    this.metaLoader = createMetaLoader(options)

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

  apply(compiler: Compiler) {
    const isBuild = !compiler.options.mode || compiler.options.mode === "production"

    const isServing = !!(
      process.env
        .WEBPACK_SERVE /* a TODO in webpack-dev-server says this will change in next major release, I'm not sure what it will be */ ||
      this.options.serve
    )

    if (isServing) {
      new EntryPlugin(compiler.context, require.resolve("../client/client.ts"), {
        name: "monkey-client",
        filename: CLIENT_SCRIPT,
      }).apply(compiler)

      new EntryPlugin(compiler.context, require.resolve("../client/patches.ts"), {
        name: undefined,
      }).apply(compiler)
    }

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        this.logger = compilation.getLogger(this.constructor.name)

        if (!isServing && !isBuild && this.options.serve === undefined) {
          this.logger.warn(
            "Not in build or serve mode, this plugin will do nothing. If this is not intended, set `serve: true` in the plugin options to explicitly enable serve mode, otherwise, set `serve: false` to suppress this warning."
          )

          return
        }

        const projectPackageJson = getPackageJson(
          compilation.inputFileSystem,
          compiler.context
        ).catch(() => undefined)

        function findOneOrNoneJsFile(chunk: Chunk) {
          const jsFiles = Array.from(chunk.files).filter((file) => file.endsWith(".js"))

          if (isBuild && jsFiles.length > 1) {
            throw new Error(`multiple js files in chunk ${chunk.name}:\n- ${jsFiles.join("\n- ")}`)
          }

          return jsFiles[0]
        }

        if (isServing) {
          const getOrigin = () =>
            this.receivePort.then(
              (port) => `http://${compiler.options.devServer?.host || "localhost"}:${port}`
            )

          const getAssetUrl = async (asset: string) =>
            getOrigin().then((origin) => `${origin}/${asset}`)

          getAssetUrl(DEV_SCRIPT).then((url) => {
            this.logger.info(`[webpack-monkey] dev userscript: ${colorize("cyan", url)}`)
          })

          compilation.hooks.succeedEntry.tap(this.constructor.name, (dependency, { name }) => {
            if (!name) {
              // do not process global entries
              return
            }

            const entryFile = (dependency as EntryDependency)?.request

            if (!entryFile) {
              return
            }

            const promise = (async () => {
              const metaFile = await this.metaResolver({ entryName: name, entry: entryFile }, this)

              if (!metaFile) {
                return
              }

              const meta = await this.metaLoader({ file: metaFile }, this)

              const userscript: Omit<UserscriptInfo, "url"> = {
                name,
                entry: entryFile,
                dir: path.dirname(entryFile),
                meta,
              }

              const existing = this.userscripts.find((u) => u.name === name)

              if (existing) {
                Object.assign(existing, userscript)
              } else {
                this.userscripts.push(userscript)
              }
            })()

            this.userscriptFinished = this.userscriptFinished.then(() => promise)
          })

          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            async (assets) => {
              await this.userscriptFinished

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
                    url: await getAssetUrl(file),
                  })
                } else {
                  this.logger.warn("URL not found for userscript:", name)
                  continue
                }
              }

              if (!runtimeScript || !assets[runtimeScript]) {
                throw new Error("runtime script not found")
              }

              const runtimeSource = assets[runtimeScript]!

              const newRuntimeSource = new ConcatSource(
                `window.${VAR_MK_INJECTION} = ${JSON.stringify({
                  userscripts: qualifiedUserscripts,
                })};\n\n`,
                runtimeSource
              )

              compilation.updateAsset(runtimeScript, newRuntimeSource)

              let content = await readFile(path.resolve(__dirname, "../dev.user.js"), "utf-8")

              const devInjection: MonkeyDevInjection = {
                clientScript: await getAssetUrl(CLIENT_SCRIPT),
                runtimeScript: await getAssetUrl(runtimeScript),
              }

              content =
                `window.${VAR_MK_DEV_INJECTION} = ${JSON.stringify(devInjection)};\n\n` + content

              content =
                generateMetaBlock(getGMAPIs().join("\n"), {
                  name: "Monkey Dev",
                  version: "1.0.0",
                  // TODO: change to *://*/*
                  match: ["*://127.0.0.1/*", "*://localhost/*"],
                  connect: "*",
                }) +
                "\n\n" +
                content

              if (this.options.transformDevEntry) {
                content = this.options.transformDevEntry(content)
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
