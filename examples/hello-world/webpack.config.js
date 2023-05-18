const path = require("path")
const { monkeyWebpack } = require("webpack-monkey")

module.exports = monkeyWebpack({
  terserPluginOptions: {
    terserOptions: {
      compress: {
        // remove `if (false);` which is converted from `if (module.hot) { ... }`
        // TODO: remove this when `if (module.hot)` is no longer needed
        conditionals: true,
      },
    },
  },
})({
  entry: "./src/index.js",
  output: {
    filename: "hello-word.user.js",
    path: path.resolve(__dirname, "dist"),
  },
})
