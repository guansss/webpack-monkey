// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule"

import { access, readFile } from "fs/promises"
import {
  castArray,
  compact,
  find,
  isArray,
  isFunction,
  isObject,
  isString,
  uniq,
  without,
} from "lodash"
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
  WebpackError,
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
import { castTruthyArray } from "../shared/utils"
import { MonkeyDevInjection, MonkeyInjection, UserscriptInfo } from "../types/userscript"
import { ExtractFunction, MaybePromise } from "../types/utils"
import { colorize } from "./color"
import {
  generateMetaBlock,
  getPackageDepVersion,
  getPackageJson,
  getUnnamedUrlExternalErrorMessage,
  pathSplit,
  resolveUrlExternal,
} from "./utils"

const { RawSource, ConcatSource } = sources

interface OptionFunctionContext {
  logger: WebpackLogger | Console
}

type RequireResolver = (
  arg: {
    name: string
    externalType: string
    version?: string
    packageVersion?: string
    url?: string
  },
  context: OptionFunctionContext,
) => MaybePromise<string | undefined>

type CdnProvider = "jsdelivr" | "unpkg"

type MetaResolver = (
  arg: { entryName: string; entry: string },
  context: OptionFunctionContext,
) => MaybePromise<string | undefined>
type MetaLoader = (
  arg: { file: string },
  context: OptionFunctionContext,
) => MaybePromise<UserscriptMeta>
type metaTransformer = (
  arg: { meta: UserscriptMeta },
  context: OptionFunctionContext,
) => MaybePromise<UserscriptMeta>

type WebpackLogger = Compilation["logger"]
type EntryDependency = ReturnType<(typeof EntryPlugin)["createDependency"]>

export interface MonkeyPluginOptions {
  require?: {
    provider?: CdnProvider
    lockVersions?: boolean
    exportsFromUnnamed?: boolean
    resolve?: RequireResolver
  }
  meta?: {
    resolve?: string | string[] | MetaResolver
    load?: MetaLoader
    transform?: metaTransformer
    generateFile?: boolean
  }
  devScript?: {
    meta?:
      | Partial<UserscriptMeta>
      | ((arg: { meta: UserscriptMeta }, context: OptionFunctionContext) => UserscriptMeta)
    transform?: (arg: { content: string }, context: OptionFunctionContext) => string
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
  require: { lockVersions = true, provider, resolve } = {},
}: MonkeyPluginOptions): RequireResolver {
  return (arg, context) => {
    if (resolve) {
      return resolve(arg, context)
    }

    const { name, version, packageVersion, url } = arg

    if (url) {
      return url
    }

    const cdnProvider = provider || "unpkg"
    const baseUrl = cdnProviders[cdnProvider]

    if (!baseUrl) {
      throw new Error(`Unknown CDN provider: ${cdnProvider}`)
    }

    let versionDef = lockVersions ? packageVersion : version
    versionDef = versionDef ? `@${versionDef}` : ""

    return encodeURI(`${baseUrl}/${name}${versionDef}`)
  }
}

function createMetaResolver({ meta: { resolve } = {} }: MonkeyPluginOptions): MetaResolver {
  if (typeof resolve === "function") {
    return resolve
  }

  return async (args, { logger }) => {
    const { entry } = args

    // if the entry has no extension, we assume it's a directory
    const dir = path.extname(entry) ? path.dirname(entry) : entry

    const candidates = compact(castArray(resolve)).concat(["meta.js", "meta.ts", "meta.json"])

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

function createMetaLoader({ meta: { load } = {} }: MonkeyPluginOptions): MetaLoader {
  if (typeof load === "function") {
    return load
  }

  return async ({ file }) => {
    const ext = path.extname(file)
    const supportedExtensions = [".ts", ".js", ".json"]

    if (!supportedExtensions.includes(ext)) {
      throw new Error(
        `Unknown meta file extension: "${file}". Expected one of: ${supportedExtensions.join(
          ", ",
        )}`,
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

export interface ResolvedExternal {
  userRequest: string
  type?: string
  identifier?: string
  url: string
  value: string
  used: boolean
}

export class MonkeyPlugin {
  compiler?: Compiler

  options: MonkeyPluginOptions
  requireResolver: RequireResolver
  metaResolver: MetaResolver
  metaLoader: MetaLoader
  metaTransformer?: metaTransformer

  userscripts: Omit<UserscriptInfo, "url">[] = []
  userscriptsLoaded = Promise.resolve()

  serveMode = false
  serverInfo?: ServerInfo

  resolvedExternals = new Map<string, ResolvedExternal>()

  logger: WebpackLogger | Console = console
  infraLogger: WebpackLogger | Console = console

  fileCache = new Map<string, Promise<string>>()

  constructor(options: MonkeyPluginOptions = {}) {
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
        `http://${this.serverInfo.host}:${this.serverInfo.port}/${DEV_SCRIPT}`,
      )}`,
    )
  }

  apply(compiler: Compiler) {
    this.compiler = compiler
    this.infraLogger = compiler.getInfrastructureLogger(MonkeyPlugin.name)

    compiler.resolverFactory.hooks.resolver.for("normal").tap(MonkeyPlugin.name, (resolver) => {
      resolver.hooks.result.tap(MonkeyPlugin.name, (result, ctx) => {
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

        // clear the cache on each compilation
        this.resolvedExternals.clear()

        const projectPackageJsonPromise = getPackageJson(
          compilation.inputFileSystem,
          compiler.context,
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
                meta = await this.metaTransformer({ meta }, this)
              }

              const userscript: Omit<UserscriptInfo, "url"> = {
                name,
                entry: entryFile,
                dir: path.dirname(entryFile),
                meta,
                requires: castTruthyArray(meta.require),
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
          },
        )

        // detect named/default imports of unnamed external modules and warn the user,
        // detect used exports from unnamed external modules and then warn the user,
        // or throw an error when building for production
        if (!this.options.require?.exportsFromUnnamed) {
          compilation.hooks.afterChunks.tap(this.constructor.name, (chunks) => {
            const externalModules = [...compilation.modules].filter(
              (m): m is ExternalModule => m instanceof ExternalModule,
            )

            for (const module of externalModules) {
              const exportsInfo = compilation.moduleGraph.getExportsInfo(module)
              const runtimes = uniq([...chunks].map((c) => c.runtime))

              if (
                !runtimes.some(
                  // check if the module is imported with named import or default import
                  // e.g. `import { foo } from "bar"` or `import foo from "bar"`
                  (runtime) => exportsInfo.isModuleUsed(runtime) && exportsInfo.isUsed(runtime),
                )
              ) {
                continue
              }

              const resolved = this.resolvedExternals.get(module.userRequest)

              if (resolved) {
                resolved.used = true

                if (!resolved.identifier) {
                  if (this.serveMode) {
                    this.logger.warn(getUnnamedUrlExternalErrorMessage(resolved.url))
                  } else {
                    compilation.errors.push(
                      new WebpackError(getUnnamedUrlExternalErrorMessage(resolved.url)),
                    )
                  }
                }
              }
            }
          })
        }

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

              const entrypoints = Array.from(compilation.entrypoints.entries())

              await Promise.all(
                entrypoints.map(async ([name, entrypoint]) => {
                  if (!runtimeScript) {
                    const runtimeChunk = find(entrypoint.chunks, { name: "runtime" })

                    if (runtimeChunk) {
                      runtimeScript = findOneOrNoneJsFile(runtimeChunk)
                    }
                  }

                  const userscript = find(this.userscripts, { name })

                  if (!userscript) {
                    return
                  }

                  const chunk = find(entrypoint.chunks, { name })

                  if (!chunk) {
                    this.logger.warn("Chunk not found for userscript:", name)
                    return
                  }

                  const file = findOneOrNoneJsFile(chunk)

                  if (!(file && assets[file])) {
                    this.logger.warn("file not found for userscript:", name)
                    return
                  }

                  const qualifiedUserscript: UserscriptInfo = {
                    ...userscript,
                    url: assetUrl(file),
                    requires: [
                      ...userscript.requires,
                      ...(await this.getRequiresFromExternalModules({
                        compilation,
                        chunk,
                        projectPackageJson: await projectPackageJsonPromise,
                      })),
                    ],

                    // when using mini-css-extract-plugin, the CSS is extracted into a separate file,
                    // we provide their URLs to the client
                    assets: without(Array.from(chunk.files), file).map(assetUrl),
                  }

                  qualifiedUserscripts.push(qualifiedUserscript)
                }),
              )

              if (!runtimeScript || !assets[runtimeScript]) {
                this.logger.error("runtime script not found")
                return
              }

              const runtimeSource = assets[runtimeScript]!

              const monkeyInjection: MonkeyInjection = {
                debug: this.options.debug || false,
                origin: origin!,
                userscripts: qualifiedUserscripts,
              }

              const newRuntimeSource = new ConcatSource(
                this.options.debug ? `console.log("runtime");\n\n` : "",
                `window.${VAR_MK_INJECTION} = ${JSON.stringify(monkeyInjection)};\n\n`,
                runtimeSource,
              )

              compilation.updateAsset(runtimeScript, newRuntimeSource)

              const devScriptContent = await this.generateDevScript({
                runtimeScript,
                projectPackageJson: (await projectPackageJsonPromise)?.data,
              })

              compilation.emitAsset(DEV_SCRIPT, new RawSource(devScriptContent))
            },
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

                      let jsContent = jsSource.source().toString("utf-8")

                      // inline CSS
                      const cssFiles = Array.from(chunk.files).filter((file) =>
                        file.endsWith(".css"),
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

                      // Generate the meta block
                      const metaBlock = generateMetaBlock(jsContent, {
                        ...userscript.meta,
                        require: [
                          ...castTruthyArray(userscript.meta.require),
                          ...(await this.getRequiresFromExternalModules({
                            compilation,
                            chunk,
                            projectPackageJson: await projectPackageJsonPromise,
                          })),
                        ],
                      })

                      // Generate meta file for userscript (*.meta.js)
                      if (this.options.meta?.generateFile ?? true) {
                        const metaFile = jsFile.replace(/\.user\.js$/, ".meta.js")
                        compilation.emitAsset(metaFile, new RawSource(metaBlock))
                        chunk.auxiliaryFiles.add(metaFile)
                      }

                      // Generate userscript file (*.user.js)
                      jsContent = metaBlock + "\n\n" + jsContent
                      compilation.updateAsset(jsFile, new RawSource(jsContent))
                    }),
                  )
                }),
              )
            },
          )
        }
      },
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

    const { meta: userDefinedMeta, transform } = this.options.devScript || {}

    let meta: UserscriptMeta = {
      name: `[Dev] ${projectPackageJson?.name || "untitled project"}`,
      match: "*://*/*",
      version: DEV_SCRIPT_VERSION,
      // put everything in these fields because we don't know what the userscripts will do
      connect: "*",
      grant: getGMAPIs(),
    }

    if (isFunction(userDefinedMeta)) {
      meta = userDefinedMeta({ meta }, this)
    } else if (isObject(userDefinedMeta)) {
      meta = { ...meta, ...userDefinedMeta }
    }

    if (meta.match === "exact") {
      meta.match = this.userscripts.flatMap((u) => u.meta.match || [])
    }

    let content = await this.readFile(externalAssets.devScript)

    const devInjection: MonkeyDevInjection = {
      clientScript: `${this.serverInfo.origin}/${CLIENT_SCRIPT}?v=${DEV_SCRIPT_VERSION}`,
      runtimeScript: `${this.serverInfo.origin}/${runtimeScript}?v=${DEV_SCRIPT_VERSION}`,
    }

    content = `window.${VAR_MK_DEV_INJECTION} = ${JSON.stringify(devInjection)};\n\n` + content

    content = generateMetaBlock("", meta) + "\n\n" + content

    if (transform) {
      content = transform({ content }, this)
    }

    return content
  }

  async getRequiresFromExternalModules({
    compilation,
    chunk,
    projectPackageJson,
  }: {
    compilation: Compilation
    chunk: Chunk
    projectPackageJson?: any
  }) {
    // TODO: more reliable way to get all modules
    const modules = compilation.chunkGraph
      .getChunkModules(chunk)
      .flatMap((mod) =>
        mod instanceof ConcatenatedModule ? (mod as ConcatenatedModule).modules : mod,
      )

    const externalModules = modules.filter(
      (dep): dep is ExternalModule => dep instanceof ExternalModule,
    )

    const requires = compact(
      await Promise.all(
        externalModules.map(async ({ userRequest, externalType }) => {
          const version = getPackageDepVersion((await projectPackageJson)?.data, userRequest)

          let packageVersion: string | undefined

          if (version) {
            try {
              const entryPath = require.resolve(userRequest)
              const segments = pathSplit(entryPath)
              const packageJsonPath = path.join(
                ...segments.slice(0, segments.indexOf("node_modules") + 2),
                "package.json",
              )
              packageVersion = require(packageJsonPath).version
            } catch (e) {
              this.logger.warn(`could not find installed package "${userRequest}":`, e)
            }
          }

          const resolved = this.resolvedExternals.get(userRequest)

          return this.requireResolver(
            {
              name: userRequest,
              externalType,
              version,
              packageVersion,
              url: resolved?.url,
            },
            this,
          )
        }),
      ),
    )

    return requires
  }

  getRuntimeName() {
    // this is equivalent to:
    // `optimization.runtimeChunk = "single"` in serve mode
    // `optimization.runtimeChunk = false` in build mode
    return this.serveMode ? "runtime" : undefined
  }

  resolveExternals(
    data: ExternalItemFunctionData,
    callback: Parameters<ExtractFunction<Configuration["externals"]>>[1] & {},
    userDefinedExternals?:
      | Record<string, ExternalItemValue>
      | ExtractFunction<Configuration["externals"]>,
  ): void {
    const { request } = data

    const wrappedCallback: typeof callback = (err, result) => {
      if (err) {
        return callback(err, result)
      }

      if (request) {
        if (result) {
          result = this.resolveExternalWithUrl(request, result)
        } else {
          // there may be a URL in the request
          const converted = this.resolveExternalWithUrl(request, request)

          // if successful, the request will have its URL removed
          if (converted !== request) {
            result = converted
          }
        }
      }

      return callback(err, result)
    }

    if (isFunction(userDefinedExternals)) {
      const maybePromise = userDefinedExternals(data, callback)
      maybePromise?.then((result) => wrappedCallback(undefined, result), wrappedCallback)
      return
    }

    if (
      isObject(userDefinedExternals) &&
      request &&
      Object.prototype.hasOwnProperty.call(userDefinedExternals, request)
    ) {
      return wrappedCallback(undefined, userDefinedExternals[request])
    }

    return wrappedCallback()
  }

  /**
   * Resolves an external request. If the request contains a URL, the resolved result will be
   * stored into `resolvedExternals` for later use, and this function will return the converted
   * request with the URL removed.
   * @returns The converted request, or the original request if it doesn't contain a URL.
   * @example
   * ```ts
   * resolveExternalWithUrl("zzz", "var foo@https://example.com") // => "var foo"
   * resolveExternalWithUrl("zzz", "foo@https://example.com") // => "foo"
   * resolveExternalWithUrl("zzz", "https://example.com") // => "EXTERNAL("https://example.com")"
   * resolveExternalWithUrl("zzz", "foo") // => "foo" (not resolved)
   * ```
   */
  resolveExternalWithUrl(userRequest: string, value: ExternalItemValue): ExternalItemValue {
    const resolveAndConvert = (strValue: string) => {
      const result = resolveUrlExternal(strValue)

      if (!result) {
        return strValue
      }

      this.resolvedExternals.set(userRequest, {
        ...result,
        userRequest,
        used: false,
      })

      return result.value
    }

    if (isString(value)) {
      return resolveAndConvert(value)
    }
    if (isArray(value)) {
      return [resolveAndConvert(value[0]), ...value.slice(1)]
    }
    return value
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
