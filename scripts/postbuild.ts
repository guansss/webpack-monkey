import fs from "fs"
import * as glob from "glob"
import path from "path"

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
    const files = glob.sync(from, { cwd: rootDir, root: "" })

    if (!files.length) {
      throw new Error(`no files found for glob ${from}`)
    }

    return files
      .filter((f) => !excludes.some((exclude) => f.includes(exclude)))
      .map((file) => ({
        from: file,
        to,
        fromBase,
      }))
  })

  targets.forEach(({ from, to, fromBase }) => {
    const relativePath = fromBase ? path.relative(fromBase, from) : from

    console.log(`copying ${relativePath} to ${to}`)

    from = path.resolve(rootDir, from)
    to = path.resolve(distDir, to, relativePath)

    if (!to.startsWith(distDir)) {
      throw new Error(`destination ${to} is not in distDir ${distDir}`)
    }

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  })
}

main()
