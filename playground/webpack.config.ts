import { globSync } from "glob"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import path from "path"
import postcssPresetEnv from "postcss-preset-env"
import { DefinePlugin } from "webpack"
import { monkey } from "../src"

export default (env: Record<string, string | boolean>, { mode }: { mode: string }) => {
  const isServing = !!env.WEBPACK_SERVE

  const entryFiles = globSync(["userscripts/*/index.ts", "userscripts/*/index.js"], {
    cwd: __dirname,
    absolute: true,
  })

  return monkey({
    monkey: {
      debug: true,
      devScript: {
        meta: {
          match: ["http://localhost/*", "http://127.0.0.1/*"],
        },
      },
    },
    mode: isServing ? "development" : "production",
    entry: Object.fromEntries(
      entryFiles.map((entryFile) => [path.basename(path.dirname(entryFile)), entryFile]),
    ),
    plugins: [
      new MiniCssExtractPlugin(),
      new DefinePlugin({
        BUILD_TIME: Date.now(),
        DEV: process.env.NODE_ENV === "development",
      }),
    ],
    devServer: {
      port: 9526,
      static: [__dirname, path.resolve(__dirname, "../tests")],
      headers(req, res, context) {
        if (req.path.includes("strict-csp.html")) {
          return new Headers({
            "Content-Security-Policy": "default-src 'self'",
          })
        }
        return {}
      },
    },
    externals: {
      ...(isServing
        ? null
        : {
            lodash: "_",
          }),
    },
    output: {
      path: path.resolve(__dirname, "dist"),
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    devtool: false,
    module: {
      rules: [
        {
          resourceQuery: /raw/,
          type: "asset/source",
        },
        {
          test: /\.([cm]?ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: true,
            },
          },
        },
        {
          test: /\.css$/i,
          use: [
            // "style-loader",
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                modules: {
                  auto: true,
                  localIdentName: "[name]__[local]--[hash:base64:4]",
                },
              },
            },
            {
              loader: "postcss-loader",
              options: {
                postcssOptions: {
                  plugins: [postcssPresetEnv()],
                },
              },
            },
          ],
        },
      ],
    },
  })
}
