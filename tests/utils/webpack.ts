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
  const stats = await compilerRun(compiler)
  const files = stats.chunks!.flatMap((chunk) => chunk.files)

  expect(files).toHaveLength(1)

  const content = fs.readFileSync(`${config.output!.path}/${files[0]}`, "utf-8")

  expect(content).toMatchSnapshot()
}

export function compilerRun(compiler: webpack.Compiler) {
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

      compilerClose(compiler)
        .then(() => resolve(info))
        .catch(reject)
    })
  })
}

export function compilerClose(compiler: webpack.Compiler) {
  return new Promise<void>((resolve, reject) => {
    compiler.close((err) => (err ? reject(err) : resolve()))
  })
}

export function compilerCompile(compiler: webpack.Compiler) {
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
    await compilerClose(compiler)
  }
}

export async function usingDevServerHot(
  config: webpack.Configuration,
  fn: (server: WebpackDevServer, replacers: FakeLoaderOptions["replacers"]) => Promise<void>
) {
  const fakeLoaderOptions: FakeLoaderOptions = {
    replacers: {},
  }

  config = merge({}, config, {
    module: {
      rules: [createFakeLoaderRule(fakeLoaderOptions)],
    },
  })

  return usingDevServer(config, (server) => {
    return fn(server, fakeLoaderOptions.replacers)
  })
}

export function withCommonConfig(...config: webpack.Configuration[]) {
  return merge({}, defaultWebpackConfig, ...config)
}

const defaultWebpackConfig: webpack.Configuration = {
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
    ],
  },
  output: {
    clean: true,
  },
  devtool: false,
  watch: false,
  stats: "errors-warnings",
}

const commonCssRule = {
  test: /\.css$/i,
  use: [
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
}

export function withMiniCssExtract(config?: webpack.Configuration): webpack.Configuration {
  const overrides = {
    plugins: [new MiniCssExtractPlugin()],
    module: {
      rules: [
        {
          ...commonCssRule,
          use: [MiniCssExtractPlugin.loader, ...commonCssRule.use],
        },
      ],
    },
  }
  return config ? merge({}, config, overrides) : overrides
}

export function withStyleLoader(config?: webpack.Configuration): webpack.Configuration {
  const overrides = {
    module: {
      rules: [
        {
          ...commonCssRule,
          use: ["style-loader", ...commonCssRule.use],
        },
      ],
    },
  }
  return config ? merge({}, config, overrides) : overrides
}
