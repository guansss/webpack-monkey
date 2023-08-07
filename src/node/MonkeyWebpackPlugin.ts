// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule"

import { access, readFile } from "fs/promises"
import { castArray, compact, find, isFunction, isObject, isString, without } from "lodash"
import path from "path"
import {
  Chunk,
  Compilation,
  Compiler,
  Configuration,
  EntryPlugin,
  ExternalItemFunctionData,
  ExternalItemValue,
  ExternalModule,
  sources,
} from "webpack"
import type WebpackDevServer from "webpack-dev-server"
import { getGMAPIs } from "../shared/GM"
import {
  CLIENT_SCRIPT,
  DEV_SCRIPT,
  DEV_SCRIPT_VERSION,
  VAR_MK_DEV_INJECTION,
  VAR_MK_INJECTION,
} from "../shared/constants"
import { UserscriptMeta } from "../shared/meta"
import { MonkeyDevInjection, MonkeyInjection, UserscriptInfo } from "../types/userscript"
import { ExtractFunction, LiteralUnion, MaybePromise } from "../types/utils"
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
    match?: string[] | LiteralUnion<"exact">
    transform?: (content: string) => string
  }
  debug?: boolean
}

export interface ServerInfo {
  host: string
  port: number
  origin: string
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

const externalAssets = {
  clientEntry: require.resolve("../client/client"),
  patchesEntry: require.resolve("../client/patches"),
  devScript: require.resolve("../dev.user.js"),
} as const

export class MonkeyWebpackPlugin {
  compiler?: Compiler

  options: MonkeyWebpackPluginOptions
  requireResolver: RequireResolver
  metaResolver: MetaResolver
  metaLoader: MetaLoader
  metaTransformer?: metaTransformer

  userscripts: Omit<UserscriptInfo, "url">[] = []
  userscriptsLoaded = Promise.resolve()

  serveMode = false
  serverInfo?: ServerInfo

  logger: WebpackLogger | typeof console = console
  infraLogger: WebpackLogger | typeof console = console

  fileCache = new Map<string, Promise<string>>()

  constructor(options: MonkeyWebpackPluginOptions = {}) {
    this.options = options
    this.requireResolver = createRequireResolver(options)
    this.metaResolver = createMetaResolver(options)
    this.metaLoader = createMetaLoader(options)
    this.metaTransformer = options.meta?.transform
  }

  private setupServeMode(server: WebpackDevServer) {
    const compiler = this.compiler

    if (!compiler) {
      this.infraLogger.warn("Compiler not set up, cannot setup serving.")
      return
    }

    this.serveMode = true

    const port = +(server.options.port || NaN)
    const host = server.options.host || "localhost"

    if (isNaN(port)) {
      throw new Error(`[${this.constructor.name}] Invalid port: ${server.options.port}`)
    }

    this.serverInfo = {
      host,
      port,
      origin: `http://${host}:${port}`,
    }

    new EntryPlugin(compiler.context, externalAssets.clientEntry, {
      name: "monkey-client",
      filename: CLIENT_SCRIPT,
    }).apply(compiler)

    new EntryPlugin(compiler.context, externalAssets.patchesEntry, {
      // make it a global entry
      name: undefined,
    }).apply(compiler)

    this.infraLogger.info(
      `Dev script hosted at: ${colorize(
        "cyan",
        `http://${this.serverInfo.host}:${this.serverInfo.port}/${DEV_SCRIPT}`
      )}`
    )
  }

  apply(compiler: Compiler) {
    this.compiler = compiler
    this.infraLogger = compiler.getInfrastructureLogger(MonkeyWebpackPlugin.name)

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

        const findOneOrNoneJsFile = (chunk: Chunk) => {
          const jsFiles = Array.from(chunk.files).filter((file) => file.endsWith(".js"))

          if (!this.serveMode && jsFiles.length > 1) {
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

        if (this.serveMode) {
          const { origin } = this.serverInfo!
          const assetUrl = (asset: string) => `${origin}/${asset}`

          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
            },
            async (assets) => {
              await this.userscriptsLoaded

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
                    url: assetUrl(file),

                    // when using mini-css-extract-plugin, the CSS is extracted into a separate file,
                    // we provide their URLs to the client script
                    assets: without(Array.from(chunk.files), file).map(assetUrl),
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

              const monkeyInjection: MonkeyInjection = {
                origin: origin!,
                userscripts: qualifiedUserscripts,
              }

              const newRuntimeSource = new ConcatSource(
                this.options.debug ? `console.log("runtime");\n\n` : "",
                `window.${VAR_MK_INJECTION} = ${JSON.stringify(monkeyInjection)};\n\n`,
                runtimeSource
              )

              compilation.updateAsset(runtimeScript, newRuntimeSource)

              const devScriptContent = await this.generateDevScript({
                runtimeScript,
                projectPackageJson: (await projectPackageJson)?.data,
              })

              compilation.emitAsset(DEV_SCRIPT, new RawSource(devScriptContent))
            }
          )
        }

        if (!this.serveMode) {
          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
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

                      let jsContent = jsSource.source().toString("utf-8")

                      // inline CSS
                      const cssFiles = Array.from(chunk.files).filter((file) =>
                        file.endsWith(".css")
                      )

                      if (cssFiles.length) {
                        let concatenatedCss = ""

                        for (const cssFile of cssFiles) {
                          const cssSource = assets[cssFile]

                          if (cssSource) {
                            this.logger.info("inlining CSS:", cssFile)

                            concatenatedCss += cssSource.source().toString("utf-8")
                            compilation.deleteAsset(cssFile)
                          } else {
                            this.logger.warn("css file not found:", cssFile)
                          }
                        }

                        if (concatenatedCss) {
                          jsContent += "\nGM_addStyle(`\n" + concatenatedCss + "`)\n"
                        }
                      }

                      // inject meta block
                      jsContent =
                        generateMetaBlock(jsContent, userscript.meta, { requires }) +
                        "\n\n" +
                        jsContent

                      const newJsSource = new RawSource(jsContent)

                      compilation.updateAsset(jsFile, newJsSource)
                    })
                  )
                })
              )
            }
          )
        }
      }
    )
  }

  async generateDevScript({
    runtimeScript,
    projectPackageJson,
  }: {
    runtimeScript: string
    projectPackageJson?: any
  }) {
    if (!this.serverInfo) {
      throw new Error("missing serverInfo")
    }

    let { name, match, transform } = this.options.devScript || {}

    if (!name) {
      name = `[Dev] ${projectPackageJson?.name || "untitled project"}`
    }

    if (!match) {
      match = "*://*/*"
    } else if (match === "exact") {
      match = this.userscripts.flatMap((u) => u.meta.match || [])
    }

    let content = await this.readFile(externalAssets.devScript)

    const devInjection: MonkeyDevInjection = {
      clientScript: `${this.serverInfo.origin}/${CLIENT_SCRIPT}?v=${DEV_SCRIPT_VERSION}`,
      runtimeScript: `${this.serverInfo.origin}/${runtimeScript}?v=${DEV_SCRIPT_VERSION}`,
    }

    content = `window.${VAR_MK_DEV_INJECTION} = ${JSON.stringify(devInjection)};\n\n` + content

    content =
      generateMetaBlock("", {
        name,
        version: DEV_SCRIPT_VERSION,
        match,

        // put everything in these fields because we don't know what the userscripts will do
        connect: "*",
        grant: getGMAPIs(),
      }) +
      "\n\n" +
      content

    if (transform) {
      content = transform(content)
    }

    return content
  }

  getRuntimeName() {
    // this is equivalent to:
    // `optimization.runtimeChunk = "single"` in serve mode
    // `optimization.runtimeChunk = false` in build mode
    return this.serveMode ? "runtime" : undefined
  }

  resolveExternals(
    data: ExternalItemFunctionData,
    callback: (err?: Error, result?: ExternalItemValue) => void,
    userDefinedExternals:
      | Record<string, ExternalItemValue>
      | ExtractFunction<Configuration["externals"]>
  ): void {
    // disable externals in serve mode
    if (this.serveMode) {
      return callback()
    }

    if (isFunction(userDefinedExternals)) {
      const maybePromise = userDefinedExternals(data, callback)
      maybePromise?.then((result) => callback(undefined, result), callback)
      return
    }

    const { request } = data

    if (request && Object.prototype.hasOwnProperty.call(userDefinedExternals, request)) {
      return callback(undefined, userDefinedExternals[request])
    }

    return callback()
  }

  private readFile(file: string) {
    if (this.fileCache.has(file)) {
      return this.fileCache.get(file)
    }

    const promise = readFile(file, "utf-8")
    this.fileCache.set(file, promise)
    return promise
  }
}
