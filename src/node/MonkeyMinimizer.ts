import { identity } from "lodash"
import TerserPlugin from "terser-webpack-plugin"
import type { MinifyOptions } from "terser"
import { Compiler } from "webpack"
import { isPatched, markAsPatched } from "../shared/patching"
import { parentUntil } from "../shared/utils"

type TerserPluginOptions = ConstructorParameters<typeof TerserPlugin>[0]

export interface MonkeyMinimizerOptions {
  terserPluginOptions?: TerserPluginOptions
  beautify?: {
    prettier?: boolean
  }
}

export class MonkeyMinimizer extends TerserPlugin {
  // TerserPlugin already defines this.options, we use a different name
  mkOptions: MonkeyMinimizerOptions

  logger = console

  prettierConfig?: object

  constructor(options: MonkeyMinimizerOptions = {}) {
    const terserPluginOptions = options.terserPluginOptions ?? {}
    const terserOptions: MinifyOptions = (terserPluginOptions as any)?.terserOptions ?? {}
    const comments = terserOptions.format?.comments ?? false

    super({
      ...terserPluginOptions,
      parallel: false, // TODO: figure out why I set this to false in the past
      // Exclude .meta.js files from minification
      exclude: /\.meta\.js$/,
      minify: async (
        file: TerserPlugin.Input,
        sourceMap: TerserPlugin.RawSourceMap | undefined,
        minifyOptions: any,
        extractComments: TerserPlugin.ExtractCommentsOptions | undefined,
      ) => {
        file = { ...file }

        for (const id in file) {
          file[id] = identity(file[id]!)
            // remove webpack's `CONCATENATED MODULE` comments,
            // as well as converting their type to `/* */` to prevent Terser
            // from moving them to the end of their previous lines
            .replace(/\/\/ CONCATENATED MODULE.*/g, "/*EMPTY_LINE*/")
            // remove webpack's /******/ comments
            .replace(/\/\*+\//g, "")
            // remove webpackBootstrap comments
            .replace(/\/\/ webpackBootstrap/g, "")
        }

        // run a dummy minify to allow `terserOptions.format.comments`
        // to patch the internal methods before running the real minify
        await TerserPlugin.terserMinify(
          { "dummy.js": "// dummy" },
          sourceMap,
          minifyOptions,
          extractComments,
        )

        const result = await TerserPlugin.terserMinify(
          file,
          sourceMap,
          minifyOptions,
          extractComments,
        )

        // restore empty lines from placeholders set by BabelPlugin
        if (result.code) {
          result.code = result.code.replace(/\/\*EMPTY_LINE\*\//g, "\n\n")

          result.code = await this.beautify(result.code)
        }

        return result
      },
      terserOptions: {
        ...terserOptions,
        compress: {
          defaults: false,
          dead_code: true,
          unused: true,
          side_effects: true,
          passes: 2,
          conditionals: true,
          ...(terserOptions?.compress as object),
        },
        mangle: false,
        format: {
          ...(terserOptions?.format as object),
          // The userscript meta block is prepended after minification, so it is unaffected.
          comments: (node: any, comment: any) => {
            try {
              this.patchOutputStream(node)
            } catch (e) {
              this.logger.warn("failed to patch Terser:", e)
            }

            if (typeof comments === "function") return comments(node, comment)
            if (comments instanceof RegExp) return comments.test(comment.value)
            if (comments === "some") {
              return (
                (comment.type === "comment1" || comment.type === "comment2") &&
                /@preserve|@copyright|@lic|@cc_on|^\**!/i.test(comment.value)
              )
            }
            return comments === true || comments === "all"
          },
        },
      },
    } as any)

    this.mkOptions = options
  }

  override apply(compiler: Compiler): void {
    super.apply(compiler)

    compiler.hooks.compilation.tap(MonkeyMinimizer.name, (compilation) => {
      this.logger = compilation.getLogger(MonkeyMinimizer.name) as any
    })
  }

  /**
   * This patch is based on the current version of source code. If it's not working,
   * check the latest source code and update the patch.
   * @see https://github.com/terser/terser/blob/6268e5fcbd0bad36603d5cd13d9b0da106c1a8dc/lib/output.js#L889-L912
   */
  patchOutputStream(node: any) {
    if (!isPatched(node)) {
      const AST_Node_prototype = parentUntil(
        node,
        (n) => Object.getPrototypeOf(n),
        (n) => n.TYPE === "Node",
      )

      if (AST_Node_prototype) {
        markAsPatched(AST_Node_prototype)

        const { print } = AST_Node_prototype

        const self = this

        AST_Node_prototype.print = function (this: unknown, output: any, ...rest: any[]) {
          if (!output || !("indent" in output)) {
            self.logger.warn(
              "failed to patch Terser's OutputStream: not getting an OutputStream instance.",
            )
          } else if (!isPatched(output)) {
            markAsPatched(output)

            self.preserveLineBreakInTemplateString(output)
          }

          return print.call(this, output, ...rest)
        }
      }
    }
  }

  /**
   * Prevents Terser from replacing line breaks in template strings with `\n`.
   *
   * ```js
   * // input
   * const str = `line1
   * line2`
   *
   * // output before patch
   * const str = `line1\nline2`
   *
   * // output after patch, same as input
   * const str = `line1
   * line2`
   * ```
   *
   * This patch is based on the current version of source code. If it's not working,
   * check the latest source code and update the patch.
   * @see https://github.com/terser/terser/blob/6268e5fcbd0bad36603d5cd13d9b0da106c1a8dc/lib/output.js#L851-L854
   */
  preserveLineBreakInTemplateString(output: any) {
    const { print_template_string_chars } = output

    if (!print_template_string_chars) {
      this.logger.warn(
        'could not get Terser to preserve line breaks in template strings, because "output.print_template_string_chars" is undefined.',
      )
      return
    }

    const self = this

    output.print_template_string_chars = function (this: unknown, str: string, ...rest: any) {
      const fakeStr = new String(str)

      fakeStr.replace = function (this: String, searchValue, replacer) {
        try {
          if (searchValue instanceof RegExp) {
            // prevent the newline from being matched, so they won't be escaped
            if (searchValue.source.includes("\\n")) {
              searchValue = new RegExp(searchValue.source.replace("\\n", ""), searchValue.flags)
            }
          }
        } catch (e) {
          self.logger.warn("failed to preserve line breaks:", e)
        }

        return str.replace(searchValue as any, replacer as any)
      }

      try {
        return print_template_string_chars.call(this, fakeStr, ...rest)
      } catch (e) {
        self.logger.warn("failed to preserve line breaks:", e)

        return print_template_string_chars.call(this, str, ...rest)
      }
    }
  }

  async beautify(code: string) {
    const explicitlyEnabled = this.mkOptions.beautify?.prettier === true
    const explicitlyDisabled = this.mkOptions.beautify?.prettier === false

    if (!explicitlyDisabled) {
      try {
        const prettier = require("prettier")

        if (!this.prettierConfig) {
          const config: object | null = await prettier.resolveConfig(process.cwd())

          if (config) {
            this.prettierConfig = config
          }
        }

        return prettier.format(code, {
          ...this.prettierConfig,

          // prettier will use the extension to determine the parser
          filepath: "dummy.js",
        })
      } catch (e) {
        if (explicitlyEnabled) {
          throw new Error(`Failed to beautify code with Prettier: ${e}`)
        }
        // else ignore
      }
    }

    return code
  }
}
