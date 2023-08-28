const glob = require("glob")
const _ = require("lodash")

const availableExtensions = _.memoize(() => {
  const dirs = glob.sync("*/", { cwd: __dirname, absolute: true })

  if (dirs.length === 0) {
    throw new Error("No extensions found, please run `npm run setup` to install the extensions.")
  }

  return dirs
})

module.exports = {
  availableExtensions,
}
