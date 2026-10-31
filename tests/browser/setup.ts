import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"

export const VIOLENTMONKEY_VERSION = "2.49.0"

export const EXTENSIONS_DIR = path.resolve(__dirname, "../extensions")
export const VIOLENTMONKEY_DIR = path.join(EXTENSIONS_DIR, "violentmonkey")
export const TAMPERMONKEY_DIR = path.join(EXTENSIONS_DIR, "tampermonkey")

export const managers = {
  violentmonkey: {
    name: "Violentmonkey",
    dir: VIOLENTMONKEY_DIR,
    url: `https://github.com/violentmonkey/violentmonkey/releases/download/v${VIOLENTMONKEY_VERSION}/Violentmonkey-mv3-v${VIOLENTMONKEY_VERSION}.zip`,
  },
  tampermonkey: {
    name: "Tampermonkey",
    dir: TAMPERMONKEY_DIR,
    url: "https://data.tampermonkey.net/tampermonkey_stable.crx",
  },
} as const

export type ManagerId = keyof typeof managers

export async function installManager(id: ManagerId) {
  const { name, dir, url } = managers[id]

  if (fs.existsSync(path.join(dir, "manifest.json"))) return

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download ${name}: ${response.status} ${response.statusText}`)
  }

  await extract(stripCrxHeader(Buffer.from(await response.arrayBuffer())), dir)
}

/**
 * CRX archives are ZIPs prefixed with a signature header, which has to be cut off.
 */
function stripCrxHeader(buffer: Buffer) {
  if (buffer.subarray(0, 4).toString() !== "Cr24") return buffer

  const version = buffer.readUInt32LE(4)

  if (version === 2) {
    const publicKeyLength = buffer.readUInt32LE(8)
    const signatureLength = buffer.readUInt32LE(12)
    return buffer.subarray(16 + publicKeyLength + signatureLength)
  }
  if (version === 3) {
    return buffer.subarray(12 + buffer.readUInt32LE(8))
  }

  throw new Error(`Unsupported CRX version: ${version}`)
}

async function extract(archive: Buffer, dir: string) {
  const zip = await JSZip.loadAsync(archive)

  await fs.promises.mkdir(dir, { recursive: true })

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) return

      // Chrome refuses to load unpacked extensions containing reserved "_" entries
      if (entry.name.split("/")[0]?.startsWith("_metadata")) return

      const outputFile = path.resolve(dir, entry.name)
      const relativePath = path.relative(dir, outputFile)
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`Refusing to extract unsafe ZIP entry: ${entry.name}`)
      }

      await fs.promises.mkdir(path.dirname(outputFile), { recursive: true })
      await fs.promises.writeFile(outputFile, await entry.async("nodebuffer"))
    }),
  )
}

if (require.main === module) {
  Promise.all(
    (Object.keys(managers) as ManagerId[]).map(async (id) => {
      await installManager(id)
      console.log(`${managers[id].name} installed in ${managers[id].dir}`)
    }),
  )
}
