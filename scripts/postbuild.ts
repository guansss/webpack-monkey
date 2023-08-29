import * as glob from "glob"
import path from "path"
import { copyFiles } from "./utils"

const rootDir = path.resolve(__dirname, "..")
const distDir = path.resolve(__dirname, "../dist")

function main() {
  copyFilesToDist()
}

function copyFilesToDist() {
  const patterns = [
    { from: "src/**/*.d.ts", to: "lib/", fromBase: "src/" },
    { from: "src/**/*.js", to: "lib/", fromBase: "src/" },
    { from: "package.json", to: "." },
  ]
  const excludes = ["env-dev.d.ts"]

  const targets = patterns.flatMap(({ from, to, fromBase }) => {
    const files = glob.sync(from, { cwd: rootDir, root: "", windowsPathsNoEscape: true })

    if (!files.length) {
      throw new Error(`no files found for glob ${from}`)
    }

    return files
      .filter((f) => !excludes.some((exclude) => f.includes(exclude)))
      .map((from) => {
        const relativePath = fromBase ? path.relative(fromBase, from) : from

        from = path.resolve(rootDir, from)
        to = path.resolve(distDir, to, relativePath)

        return { from, to }
      })
  })

  copyFiles(targets)
}

main()
