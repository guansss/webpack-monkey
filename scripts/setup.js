const axios = require("axios")
const fs = require("fs")
const JSZip = require("jszip")
const path = require("path")

const extensionInfos = {
  tampermonkey: {
    url: "https://data.tampermonkey.net/tampermonkey_stable.crx",
  },
}

const extensionDir = path.resolve(__dirname, "../tests/extensions")

async function main() {
  await installExtensions()
}

async function installExtensions() {
  if (!fs.existsSync(extensionDir)) {
    throw new Error(`Extension directory ${extensionDir} not exists`)
  }

  await Promise.all(
    Object.entries(extensionInfos).map(async ([name, info]) => {
      const outDir = path.resolve(extensionDir, name)

      console.log(`Installing extension ${name} to ${outDir}`)

      if (fs.existsSync(outDir)) {
        if (fs.readdirSync(outDir).length > 0) {
          console.warn(
            `Extension directory ${outDir} already exists, skipping to avoid overwrite. If you want to reinstall it, please delete the directory first.`
          )
          return
        }
      } else {
        fs.mkdirSync(outDir)
      }

      await downloadAndUnzip(info.url, outDir)
    })
  )
}

async function downloadAndUnzip(url, outDir) {
  const resp = await axios({
    url,
    method: "get",
    responseType: "arraybuffer",
  })
  const zip = await JSZip.loadAsync(resp.data)

  // Extract each file to the output directory
  await Promise.all(
    Object.values(zip.files).map(async (zipEntry) => {
      if (zipEntry.dir) {
        return
      }

      console.log("Extracting", zipEntry.name)

      const content = await zip.file(zipEntry.name).async("nodebuffer")

      const outFile = path.resolve(outDir, zipEntry.name)

      if (outFile === zipEntry.name) {
        throw new Error(
          `Aborting dangerous operation: writing to ${outFile}, because the entry's path seems like an absolute path and overwrites the output path.`
        )
      }

      if (!fs.existsSync(path.dirname(outFile))) {
        fs.mkdirSync(path.dirname(outFile), { recursive: true })
      }

      await fs.promises.writeFile(outFile, content)
    })
  )
}

main()
