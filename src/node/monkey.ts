import { isNil, isObject } from "lodash"
import { Configuration } from "webpack"
import { merge } from "webpack-merge"
import { MonkeyWebpackMinimizer, MonkeyWebpackMinimizerOptions } from "./MonkeyWebpackMinimizer"
import { MonkeyWebpackPlugin, MonkeyWebpackPluginOptions } from "./MonkeyWebpackPlugin"

interface MonkeyWebpackOptions extends MonkeyWebpackPluginOptions, MonkeyWebpackMinimizerOptions {}

export function monkeyWebpack(options?: MonkeyWebpackOptions) {
  return (config: Configuration) => {
    const plugin = new MonkeyWebpackPlugin(options)

    const isServe = options?.serve ?? process.env.WEBPACK_SERVE === "true"

    const userDefinedPortNumber = Number(config?.devServer?.port)
    const userDefinedPortIsValid = isFinite(userDefinedPortNumber)

    if (userDefinedPortIsValid) {
      plugin.port.set(userDefinedPortNumber)
    }

    type RuntimeChunkValue = NonNullable<Configuration["optimization"]>["runtimeChunk"]
    const runtimeChunkValue: RuntimeChunkValue = isServe ? "single" : false
    const userDefinedRuntimeChunkValue = config?.optimization?.runtimeChunk

    if (
      !isNil(userDefinedRuntimeChunkValue) &&
      userDefinedRuntimeChunkValue !== runtimeChunkValue
    ) {
      console.warn(
        `MonkeyWebpackPlugin: "optimization.runtimeChunk" is set to "${userDefinedRuntimeChunkValue}", which does not match the required value "${runtimeChunkValue}". Overriding it to "${runtimeChunkValue}".`
      )
    }

    let devClient = config?.devServer?.client

    if (!isObject(devClient)) {
      devClient = {}
    }

    return merge(
      {
        devServer: {
          hot: "only",
        },
        output: {
          filename: "[name].user.js",
        },
      },
      // ====================================================
      config,
      // ====================================================
      {
        plugins: [plugin],

        devServer: {
          webSocketServer: "sockjs",
          client: {
            ...devClient,
            webSocketTransport: "sockjs",
            webSocketURL: {
              port: config?.devServer?.port,
              ...(isObject(devClient.webSocketURL) ? devClient.webSocketURL : null),

              protocol: "ws",

              // TODO: SockJS will throw if the hostname is not a loopback address,
              // maybe we can patch it to allow other hostnames e.g. "localhost"
              hostname: "127.0.0.1",
            },
          },

          ...(!userDefinedPortIsValid && {
            onListening: (server) => {
              const { port } = server.server!.address() as import("net").AddressInfo

              if (plugin.port.port === undefined) {
                plugin.port.set(port)
              }
            },
          }),
        },

        optimization: {
          runtimeChunk: runtimeChunkValue,
          minimizer: [new MonkeyWebpackMinimizer(options)],
        },

        externalsType: "var",

        ...(isServe && {
          // remove all user-defined externals so that they are available during development
          externals: [],
        }),
      }
    )
  }
}
