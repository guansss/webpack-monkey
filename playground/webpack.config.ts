import { globSync } from "glob"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import path from "path"
import postcssPresetEnv from "postcss-preset-env"
import { DefinePlugin } from "webpack"
import { monkeyWebpack } from "../src"

export default (_env: unknown, { mode }: { mode: string }) => {
  const isDev = mode !== "production"

  const entryFiles = globSync(["userscripts/*/index.ts", "userscripts/*/index.js"], {
    cwd: __dirname,
    absolute: true,
  })

  return monkeyWebpack()({
    mode: mode === "production" ? "production" : "development",
    entry: Object.fromEntries(
      entryFiles.map((entryFile) => [path.basename(path.dirname(entryFile)), entryFile])
    ),
    plugins: [
      new MiniCssExtractPlugin(),
      new DefinePlugin({
        BUILD_TIME: Date.now(),
        DEV: isDev,
      }),
    ],
    devServer: {
      port: 9526,
    },
    externals: {
      ...(!isDev && {
        jquery: "$",
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
