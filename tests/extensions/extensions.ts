import axios from "axios"
import fs, { existsSync } from "fs"
import JSZip from "jszip"
import path from "path"

const extensionInfos = {
  tampermonkey: {
    name: "Tampermonkey",
    url: "https://data.tampermonkey.net/tampermonkey_stable.crx",
    dir: path.resolve(__dirname, "tampermonkey"),
    installed: existsSync(path.resolve(__dirname, "tampermonkey")),
    check: (extension: any) => extension.name === "Tampermonkey",
  },
  violentmonkey: {
    name: "Violentmonkey",
    url: "https://github.com/violentmonkey/violentmonkey/releases/download/v2.15.0/Violentmonkey-webext-v2.15.0.zip",
    dir: path.resolve(__dirname, "violentmonkey"),
    installed: existsSync(path.resolve(__dirname, "violentmonkey")),
    check: (extension: any) => extension.homepageUrl === "https://violentmonkey.github.io/",
  },
}

export async function installExtensions() {
  await Promise.all(
    Object.entries(extensionInfos).map(async ([name, info]) => {
      const outDir = path.resolve(__dirname, name)

      console.log(`Installing extension ${name} to ${outDir}`)

      if (fs.existsSync(outDir)) {
        if (fs.readdirSync(outDir).length > 0) {
          console.warn(
            `Warning: extension directory ${outDir} already exists, skipping to avoid overwriting. If you want to reinstall it, please delete the directory first.`
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

async function downloadAndUnzip(url: string, outDir: string) {
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

      const content = await zip.file(zipEntry.name)!.async("nodebuffer")

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

export function mustGetExtension(id: string) {
  const ext = extensionInfos[id as keyof typeof extensionInfos]
  if (!ext) {
    throw new Error(`No extension found for "${id}"`)
  }
  if (!ext.installed) {
    throw new Error(`Extension "${id}" is not installed. Run "npm run setup" first.`)
  }
  return ext
}
