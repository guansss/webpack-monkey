import { expect } from "@jest/globals"
import fs from "fs"
import MiniCssExtractPlugin from "mini-css-extract-plugin"
import path from "path"
import postcssPresetEnv from "postcss-preset-env"
import webpack from "webpack"
import WebpackDevServer from "webpack-dev-server"
import { merge } from "webpack-merge"
import { FakeLoaderOptions, createFakeLoaderRule } from "./fake-update-loader"

export async function testBuild(config: webpack.Configuration) {
  config = {
    ...config,
    mode: "production",
  }

  const compiler = webpack(config)
  const stats = await webpackRun(compiler)
  const files = stats.chunks!.flatMap((chunk) => chunk.files)

  expect(files).toHaveLength(1)

  const content = fs.readFileSync(`${config.output!.path}/${files[0]}`, "utf-8")

  expect(content).toMatchSnapshot()
}

export function webpackRun(compiler: webpack.Compiler) {
  return new Promise<webpack.StatsCompilation>((resolve, reject) => {
    compiler.run((err, stats) => {
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

      compiler.close((err) => {
        if (err) {
          return reject(err)
        }

        resolve(info)
      })
    })
  })
}

export function webpackCompile(compiler: webpack.Compiler) {
  return new Promise<webpack.Compilation>((resolve, reject) => {
    compiler.compile((err, compilation) => {
      if (err) {
        if ((err as any).details) {
          err.message = `${err.message} (${(err as any).details})`
        }

        return reject(err)
      }

      if (!compilation) {
        return reject(new Error("No compilation"))
      }

      resolve(compilation)
    })
  })
}

export async function usingDevServer(
  config: webpack.Configuration,
  fn: (server: WebpackDevServer) => Promise<void>
) {
  const compiler = webpack(config)
  const server = new WebpackDevServer(config.devServer, compiler)

  try {
    await server.start()
    await fn(server)
  } finally {
    await server.stop().catch(console.warn)
  }
}

export async function usingDevServerHot(
  config: webpack.Configuration,
  fn: (server: WebpackDevServer) => Promise<void>
) {
  const fakeLoaderOptions: FakeLoaderOptions = {
    updateIndex: 0,
    invalidateUrlPath: "/mk_invalidate",
  }

  config = merge({}, config, {
    module: {
      rules: [createFakeLoaderRule(fakeLoaderOptions)],
    },
  })

  return usingDevServer(config, (server) => {
    server.app!.get(fakeLoaderOptions.invalidateUrlPath, (req, res) => {
      fakeLoaderOptions.updateIndex++
      server.invalidate()
      res.end()
    })

    return fn(server)
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
  watch: false,
  stats: "errors-warnings",
}
