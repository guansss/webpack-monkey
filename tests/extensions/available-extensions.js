const glob = require("glob")

function availableExtensions() {
  return glob.sync("*/", { cwd: __dirname, absolute: true })
}

module.exports = {
  availableExtensions,
}
