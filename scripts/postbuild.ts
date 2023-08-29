import * as glob from "glob"
import path from "path"
import { copyFiles, rewriteFile } from "./utils"

const rootDir = path.resolve(__dirname, "..")
const distDir = path.resolve(__dirname, "../dist")

function main() {
  copyFilesToDist()

  rewriteFile(path.resolve(distDir, "lib/index.d.ts"), (content) => {
    const result = content.replace("../../src/env.d.ts", "./env.d.ts")

    if (result === content) {
      throw new Error("rewrite failed")
    }

    return result
  })
}

function copyFilesToDist() {
  const patterns = [
    { from: "src/**/*.d.ts", to: "lib/", fromBase: "src/" },
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
      .map((file) => {
        const relativePath = fromBase ? path.relative(fromBase, file) : file

        return {
          from: path.resolve(rootDir, file),
          to: path.resolve(distDir, to, relativePath),
        }
      })
  })

  copyFiles(targets)
}

main()
