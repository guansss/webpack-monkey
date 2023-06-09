import fs from "fs"
import * as glob from "glob"
import path from "path"

const rootDir = path.resolve(__dirname, "..")
const distDir = path.resolve(__dirname, "../dist")

function main() {
  copyFilesToDist()
}

function copyFilesToDist() {
  const targets = [{ from: "package.json", to: "package.json" }]
  const globbingTargets = [
    { from: "src/**/*.d.ts", to: "types/", base: "src/" },
    { from: "src/**/*.js", to: "lib/", base: "src/" },
  ]

  globbingTargets.forEach(({ from, to, base }) => {
    const files = glob.sync(from, { cwd: rootDir })

    if (!files.length) {
      throw new Error(`no files found for glob ${from}`)
    }

    files.forEach((file) => {
      targets.push({
        from: file,
        to: path.join(to, path.relative(base, file)),
      })
    })
  })

  targets.forEach(({ from, to }) => {
    from = path.resolve(rootDir, from)
    to = path.resolve(distDir, to)

    console.log(`copying ${from} to ${to}`)

    if (!to.startsWith(distDir)) {
      throw new Error(`to path ${to} is not in distDir ${distDir}`)
    }

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  })
}

main()
