import { isObject } from "lodash"
import { Configuration } from "webpack"
import { MonkeyWebpackMinimizer, MonkeyWebpackMinimizerOptions } from "./MonkeyWebpackMinimizer"
import { MonkeyWebpackPlugin, MonkeyWebpackPluginOptions } from "./MonkeyWebpackPlugin"

interface MonkeyWebpackOptions extends MonkeyWebpackPluginOptions, MonkeyWebpackMinimizerOptions {}

export function monkeyWebpack(options?: MonkeyWebpackOptions) {
  return (config: Configuration) => {
    const plugin = new MonkeyWebpackPlugin(options)

    config ??= {}

    config.plugins ??= []
    config.plugins.push(plugin)

    config.optimization ??= {}
    config.optimization.runtimeChunk ??= "single"
    config.optimization.minimizer ??= []
    config.optimization.minimizer.push(new MonkeyWebpackMinimizer(options))

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
