// @ts-ignore
import ConcatenatedModule from "webpack/lib/optimize/ConcatenatedModule"

import { access, readFile } from "fs/promises"
import { castArray, compact, isObject, isString } from "lodash"
import path from "path"
import { Chunk, Compilation, Compiler, EntryPlugin, ExternalModule, sources } from "webpack"
import { getGMAPIs } from "../shared/GM"
import { UserscriptMeta } from "../shared/meta"
import { UserscriptInfo } from "../types/userscript"
import { MaybePromise } from "../types/utils"
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

    return `${baseUrl}/${name}${versionDef}`
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

  userscripts: UserscriptInfo[] = []
  userscriptFinished = Promise.resolve()

  // assume that we won't call it before ready
  logger!: WebpackLogger

  constructor(options: MonkeyWebpackPluginOptions = {}) {
    this.options = options
    this.requireResolver = createRequireResolver(options)
    this.metaResolver = createMetaResolver(options)
    this.metaLoader = createMetaLoader(options)
  }

  apply(compiler: Compiler) {
    const isDev = compiler.options.mode !== "production"

    new EntryPlugin(compiler.context, require.resolve("../client/client.ts"), {
      name: "monkey-client",
    }).apply(compiler)

    new EntryPlugin(compiler.context, require.resolve("../client/patches.ts"), {
      name: undefined,
    }).apply(compiler)

    // new EntryPlugin(compiler.context, require.resolve("../client/dev.user.ts"), {
    //   name: "monkey-dev",
    //   chunkLoading: false,
    //   runtime: false,
    // }).apply(compiler)

    // new IgnorePlugin({
    //   checkResource(resource, context) {
    //     console.log(resource, context)
    //     return false
    //   },
    // }).apply(compiler)

    // new DefinePlugin({
    //   __MK_INJECTION__: DefinePlugin.runtimeValue(() => {
    //     let value: MonkeyInjection

    //     console.log("----------------------replace")

    //     if (isDev) {
    //       value = {
    //         userscripts: this.userscripts,
    //       }
    //     } else {
    //       this.logger.warn("__MK_INJECTION__ should not be used in production.")
    //       value = { userscripts: [] }
    //     }

    //     return JSON.stringify(value)
    //   }),
    // }).apply(compiler)

    // compiler.hooks.make.tapAsync(this.constructor.name, async (compilation, cb) => {
    //   const userscripts: UserscriptInfo[] = []

    //   await Promise.all(
    //     Array.from(compilation.entries).map(async ([name, { dependencies }]) => {
    //       const entryFile = (dependencies[0] as EntryDependency)?.request

    //       if (!entryFile) {
    //         return
    //       }

    //       const metaFile = await this.metaResolver({ entryName: name, entry: entryFile }, this)

    //       if (!metaFile) {
    //         return
    //       }

    //       const meta = await this.metaLoader({ file: metaFile }, this)

    //       userscripts.push({
    //         name,
    //         entry: entryFile,
    //         dir: path.dirname(entryFile),
    //         meta,
    //       })
    //     })
    //   )

    //   console.log("----------------------userscripts", userscripts)

    //   this.userscripts = userscripts

    //   cb()
    // })

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        this.logger = compilation.getLogger(this.constructor.name)

        // TODO: find a solid way to get the server's origin
        const origin = `http://127.0.0.1:${compiler.options.devServer?.port || 3000}`

        const projectPackageJson = getPackageJson(
          compilation.inputFileSystem,
          compiler.context
        ).catch(() => undefined)

        function findOneOrNoneJsFile(chunk: Chunk) {
          const jsFiles = Array.from(chunk.files).filter((file) => file.endsWith(".js"))

          if (jsFiles.length > 1) {
            throw new Error(`multiple js files in chunk ${chunk.name}:\n- ${jsFiles.join("\n- ")}`)
          }

          return jsFiles[0]
        }

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

            const userscript: UserscriptInfo = {
              name,
              entry: entryFile,
              dir: path.dirname(entryFile),
              url: `${origin}/${name}.user.js`,
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
          async () => {
            await this.userscriptFinished

            for (const [file, source] of Object.entries(compilation.assets)) {
              if (file.endsWith(".js")) {
                const newSource = new ConcatSource(
                  `window.__MK_INJECTION__ = ${JSON.stringify({
                    userscripts: this.userscripts,
                  })};`,
                  "\n\n",
                  source
                )

                compilation.updateAsset(file, newSource)
              }
            }

            const devJs = "monkey-dev.user.js"

            let content = await readFile(path.resolve(__dirname, "../dev.user.js"), "utf-8")

            content =
              `window.__MK_DEV_INJECTION__ = ${JSON.stringify({
                // TODO: reliable filename
                clientScript: `${origin}/monkey-client.user.js`,
                runtimeScript: `${origin}/runtime.user.js`,
              })};` +
              "\n\n" +
              content

            content =
              generateMetaBlock(getGMAPIs().join("\n"), {
                name: "Monkey Dev",
                version: "1.0.0",
                match: ["*://127.0.0.1/*", "*://localhost/*"],
                connect: "*",
              }) +
              "\n\n" +
              content

            if (this.options.transformDevEntry) {
              content = this.options.transformDevEntry(content)
            }

            const source = new RawSource(content)

            compilation.emitAsset(devJs, source)
          }
        )

        // a: {
        //   break a
        //   let restoreAddChunk: (() => void) | undefined
        //   let restoreGlobalEntry: (() => void) | undefined

        //   compilation.hooks.beforeChunks.tap(this.constructor.name, () => {
        //     overrideValue(compilation, "addChunk", (addChunk, restore) => {
        //       restoreAddChunk = () => {
        //         restoreAddChunk = undefined
        //         restore()
        //       }

        //       return function (this: Compilation, chunk) {
        //         if (chunk === "monkey-dev") {
        //           overrideValue(
        //             compilation.globalEntry,
        //             "dependencies",
        //             (_, restoreDependencies) => {
        //               overrideValue(
        //                 compilation.globalEntry,
        //                 "includeDependencies",
        //                 (_, restoreIncludeDependencies) => {
        //                   restoreGlobalEntry = () => {
        //                     restoreGlobalEntry = undefined
        //                     restoreDependencies()
        //                     restoreIncludeDependencies()
        //                   }
        //                   return []
        //                 }
        //               )
        //               return []
        //             }
        //           )
        //         } else {
        //           restoreGlobalEntry?.()
        //         }

        //         return addChunk.call(this, chunk)
        //       }
        //     })
        //   })

        //   compilation.hooks.afterChunks.tap(this.constructor.name, () => {
        //     restoreAddChunk?.()
        //     restoreGlobalEntry?.()
        //   })
        // }

        // if (0) {
        //   compilation.hooks.processAssets.tap(
        //     {
        //       name: this.constructor.name,
        //       stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        //     },
        //     (assets) => {
        //       const devEntry = compilation.entrypoints.get("monkey-dev")
        //       const devJs = "monkey-dev.user.js"
        //       const source = assets[devJs]

        //       if (!source) {
        //         return
        //       }

        //       const jsContentSource = traverseAndFindSource(source, (s) => {
        //         const firstChild = ((s as any)._children as unknown[])?.[0]

        //         if (firstChild && firstChild instanceof RawSource) {
        //           const content = firstChild.source().toString("utf-8")

        //           if (content.startsWith("/*!") && content.includes("dev.user.ts")) {
        //             return true
        //           }
        //         }
        //       })

        //       if (jsContentSource) {
        //         compilation.updateAsset(devJs, jsContentSource)
        //       }
        //     }
        //   )
        // }

        compiler.hooks.emit.tap(this.constructor.name, (chunks) => {
          debugger
        })

        if (!isDev) {
          // compilation.hooks.additionalTreeRuntimeRequirements.tap(
          //   {
          //     name: this.constructor.name,
          //     stage: 10000,
          //   },
          //   (chunk, requirements) => {
          //     if (chunk.name === "monkey-dev") {
          //       console.log(
          //         "------------------------clear",
          //         requirements.size,
          //         "------------------------"
          //       )
          //       requirements.clear()
          //     }
          //   }
          // )

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
