import { expect } from "@jest/globals"
import fs from "fs"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import path from "path"
import postcssPresetEnv from "postcss-preset-env"
import webpack from "webpack"
import { merge } from "webpack-merge"

export async function testBuild(config: webpack.Configuration) {
  config = {
    ...config,
    mode: "production",
  }

  const stats = await webpackCompile(config)
  const files = stats.chunks!.flatMap((chunk) => chunk.files)

  expect(files).toHaveLength(1)

  const content = fs.readFileSync(`${config.output!.path}/${files[0]}`, "utf-8")

  expect(content).toMatchSnapshot()
}

export function webpackCompile(config: webpack.Configuration) {
  return new Promise<webpack.StatsCompilation>((resolve, reject) => {
    webpack(config, (err, stats) => {
      if (err) {
        if ((err as any).details) {
          err.message = `${err.message} (${(err as any).details})`
        }

        return reject(err)
      }

      if (!stats) {
        return reject(new Error("No stats"))
      }

      const info = stats.toJson()

      if (stats.hasErrors()) {
        console.error(info.errors)
        return reject(new Error("Failed to compile."))
      }

      if (stats.hasWarnings()) {
        console.warn(info.warnings)
      }

      resolve(info)
    })
  })
}

export function withCommonConfig(config: webpack.Configuration) {
  return merge({}, defaultWebpackConfig, config)
}

const defaultWebpackConfig: webpack.Configuration = {
  plugins: [new MiniCssExtractPlugin()],
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
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
  output: {
    clean: true,
  },
  devtool: false,
}
