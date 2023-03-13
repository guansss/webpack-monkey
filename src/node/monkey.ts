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

    // TODO: figure out the correct URL
    // config.devServer.open ??= `http://127.0.0.1:${config.devServer.port || 3000}/monkey-dev.user.js`

    if (config.devServer.client !== false) {
      config.devServer.webSocketServer = "sockjs"

      config.devServer.client = isObject(config.devServer.client) ? config.devServer.client : {}

      config.devServer.client.webSocketTransport = "sockjs"
      // config.devServer.client.webSocketURL = "ws://127.0.0.1:9526/ws"
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
