const colorette = require("colorette")
const fs = require("fs")
const glob = require("glob")
const path = require("path")
const tsconfig = require("../tsconfig.json")

const target = process.argv[2] // "node" or "client"

const globPattern = target === "node" ? "node/**/*.js" : "client/**/*.js"
const newNameForShared = target === "node" ? "shared-node" : "shared-client"

const outDir = tsconfig.compilerOptions.outDir

if (!outDir) {
  throw new Error("outDir not defined in tsconfig.json")
}

// rename shared dir

const sharedDir = path.resolve(outDir, "shared")
const newSharedDir = path.resolve(outDir, newNameForShared)

if (!fs.existsSync(sharedDir)) {
  throw new Error(`Directory ${sharedDir} does not exist`)
}

if (fs.existsSync(newSharedDir)) {
  console.log(colorette.yellow(`Already exists: "${newSharedDir}", deleting...`))
  fs.rmdirSync(newSharedDir, { recursive: true })
}

fs.renameSync(sharedDir, newSharedDir)

console.log(colorette.green(`Renamed "${sharedDir}" to "${newSharedDir}"`))

// rewrite import/require paths

let fileCount = 0

glob.sync(globPattern, { cwd: outDir }).forEach((file) => {
  const filePath = path.resolve(outDir, file)
  let content = fs.readFileSync(filePath, "utf8")

  let replaced = false

  content = content
    .replace(/from "(.+?)\/shared/g, (_, p1) => {
      replaced = true
      return `from "${p1}/${newNameForShared}`
    })
    .replace(/require\("(.+?)\/shared/g, (_, p1) => {
      replaced = true
      return `require("${p1}/${newNameForShared}`
    })

  if (!replaced) {
    return
  }

  fs.writeFileSync(filePath, content, "utf8")
  fileCount++
})

if (fileCount === 0) {
  throw new Error(`No files found with glob pattern ${globPattern}`)
}

console.log(colorette.green(`Rewrote import/require paths in ${fileCount} files`))
