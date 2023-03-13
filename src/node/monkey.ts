import { isObject } from "lodash"
import { Configuration } from "webpack"
import { MonkeyWebpackMinimizer, MonkeyWebpackMinimizerOptions } from "./MonkeyWebpackMinimizer"
import { MonkeyWebpackPlugin, MonkeyWebpackPluginOptions } from "./MonkeyWebpackPlugin"

interface MonkeyWebpackOptions extends MonkeyWebpackPluginOptions, MonkeyWebpackMinimizerOptions {}

export function monkeyWebpack(options?: MonkeyWebpackOptions) {
  return (config: Configuration) => {
    config ??= {}

    config.plugins ??= []
    config.plugins.push(new MonkeyWebpackPlugin(options))

    config.optimization ??= {}
    config.optimization.minimizer ??= []
    config.optimization.minimizer.push(new MonkeyWebpackMinimizer(options))

    config.devServer ??= {}
    config.devServer.hot ??= "only"

    if (config.devServer.client !== false) {
      config.devServer.webSocketServer = "sockjs"

      config.devServer.client = isObject(config.devServer.client) ? config.devServer.client : {}

      config.devServer.client.webSocketTransport = "sockjs"
      config.devServer.client.webSocketURL = {
        ...(isObject(config.devServer.client.webSocketURL)
          ? config.devServer.client.webSocketURL
          : null),
        port: config.devServer.port,
        hostname: "127.0.0.1",
        protocol: "ws",
      }
    }

    config.externalsType ??= "var"

    config.optimization ??= {}
    config.optimization.runtimeChunk ??= "single"

    config.output ??= {}
    config.output.filename ??= "[name].user.js"

    return config
  }
}
