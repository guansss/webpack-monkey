const glob = require("glob")
const _ = require("lodash")
const path = require("path")

const extensionInfos = {
  tampermonkey: {
    id: "tm",
    name: "Tampermonkey",
    url: "https://data.tampermonkey.net/tampermonkey_stable.crx",
  },
  violentmonkey: {
    id: "vm",
    name: "Violentmonkey",
    url: "https://github.com/violentmonkey/violentmonkey/releases/download/v2.15.0/Violentmonkey-webext-v2.15.0.zip",
  },
}

const getInstalledExtensions = _.memoize(() => {
  const dirs = glob.sync("*/", { cwd: __dirname, absolute: true })

  if (dirs.length === 0) {
    throw new Error("No extensions found, please run `npm run setup` to install the extensions.")
  }

  return dirs
})

function getExtension(id) {
  const ext = Object.values(extensionInfos).find((ext) => ext.id === id)
  if (!ext) {
    throw new Error(`No extension found for "${id}"`)
  }
  return {
    ...ext,
    dir: getInstalledExtensions().find((dir) => extensionInfos[path.basename(dir)] === ext),
  }
}

module.exports = {
  extensionInfos,
  getInstalledExtensions,
  getExtension,
}
