import { isFunction, isNil, isObject, isPlainObject } from "lodash"
import { Configuration } from "webpack"
import { merge } from "webpack-merge"
import { MonkeyMinimizer, MonkeyMinimizerOptions } from "./MonkeyMinimizer"
import { MonkeyPlugin, MonkeyPluginOptions } from "./MonkeyPlugin"

interface MonkeyOptions extends MonkeyPluginOptions, MonkeyMinimizerOptions {}

export function monkey({
  monkey: options,
  ...config
}: Configuration & {
  monkey?: MonkeyOptions
} = {}): Configuration {
  const plugin = new MonkeyPlugin(options)

  const userDefinedRuntimeChunk = config?.optimization?.runtimeChunk

  if (!isNil(userDefinedRuntimeChunk)) {
    console.warn(
      MonkeyPlugin.name +
        `: the value of "optimization.runtimeChunk" will be ignored. It will be overwritten to "single" when serving, and "false" when building.`,
    )
  }

  const userDefinedExternals = config?.externals

  if (
    !isNil(userDefinedExternals) &&
    !isPlainObject(userDefinedExternals) &&
    !isFunction(userDefinedExternals)
  ) {
    throw new Error(MonkeyPlugin.name + `: "externals" must be an object or a function.`)
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

        setupMiddlewares: (middlewares, server) => {
          plugin["setupServeMode"](server)

          return config.devServer?.setupMiddlewares?.(middlewares, server) ?? middlewares
        },
      },

      optimization: {
        runtimeChunk: {
          name: () => plugin.getRuntimeName(),
        },
        minimizer: [new MonkeyMinimizer(options)],

        // by default this is false in development mode, we turn it on to allow the plugin to
        // detect unexpected used exports unnamed external modules and then warn the user
        // TODO: this may lower the performance, maybe find a solution that doesn't require this option
        usedExports: options?.require?.exportsFromUnnamed ? undefined : true,
      },

      externalsType: "var",

      externals: (data, callback) => {
        return plugin.resolveExternals(data, callback, userDefinedExternals as any)
      },
    },
  )
}
