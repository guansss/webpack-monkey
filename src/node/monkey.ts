import { isNil, isObject } from "lodash"
import { Configuration } from "webpack"
import { MonkeyWebpackMinimizer, MonkeyWebpackMinimizerOptions } from "./MonkeyWebpackMinimizer"
import { MonkeyWebpackPlugin, MonkeyWebpackPluginOptions } from "./MonkeyWebpackPlugin"

interface MonkeyWebpackOptions extends MonkeyWebpackPluginOptions, MonkeyWebpackMinimizerOptions {}

export function monkeyWebpack(options?: MonkeyWebpackOptions) {
  return (config: Configuration) => {
    const plugin = new MonkeyWebpackPlugin(options)

    const isServing = process.env.WEBPACK_SERVE === "true"

    config ??= {}

    config.plugins ??= []
    config.plugins.push(plugin)

    config.optimization ??= {}
    config.optimization.minimizer ??= []
    config.optimization.minimizer.push(new MonkeyWebpackMinimizer(options))

    type RuntimeChunkValue = NonNullable<Configuration["optimization"]>["runtimeChunk"]
    const runtimeChunkValue: RuntimeChunkValue = isServing ? "single" : false

    if (
      !isNil(config.optimization.runtimeChunk) &&
      config.optimization.runtimeChunk !== runtimeChunkValue
    ) {
      console.warn(
        `MonkeyWebpackPlugin: "optimization.runtimeChunk" is specified as a value other than "${runtimeChunkValue}". Overriding it to "${runtimeChunkValue}".`
      )
    }

    config.optimization.runtimeChunk = runtimeChunkValue

    config.devServer ??= {}
    config.devServer.hot ??= "only"

    if (isFinite(Number(config.devServer.port))) {
      plugin.setPort(Number(config.devServer.port))
    } else {
      const onListening = config.devServer.onListening

      config.devServer.onListening = (server) => {
        const { port } = server.server!.address() as import("net").AddressInfo

        plugin.setPort(port)

        onListening?.(server)
      }
    }

    if (config.devServer.client !== false) {
      config.devServer.webSocketServer = "sockjs"

      config.devServer.client = isObject(config.devServer.client) ? config.devServer.client : {}

      config.devServer.client.webSocketTransport = "sockjs"
      config.devServer.client.webSocketURL = {
        ...(isObject(config.devServer.client.webSocketURL)
          ? config.devServer.client.webSocketURL
          : null),
        port: config.devServer.port,
        protocol: "ws",

        // TODO: SockJS will throw if the hostname is not a loopback address,
        // maybe we can patch it to allow other hostnames e.g. "localhost"
        hostname: "127.0.0.1",
      }
    }

    config.externalsType ??= "var"

    config.output ??= {}
    config.output.filename ??= "[name].user.js"

    return config
  }
}
