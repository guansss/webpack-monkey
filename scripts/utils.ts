import fs from "fs"
import path from "path"

const rootDir = path.resolve(__dirname, "..")

export function copyFiles(files: { from: string; to: string }[], failOnOverwrite = true) {
  files.forEach(({ from, to }) => {
    if (!path.isAbsolute(from)) {
      throw new Error(`from path ${from} is not absolute.`)
    }
    if (!path.isAbsolute(to)) {
      throw new Error(`to path ${to} is not absolute.`)
    }

    const relativeFrom = path.relative(rootDir, from)
    const relativeTo = path.relative(rootDir, to)

    console.log(`copying ${relativeFrom} to ${relativeTo}`)

    if (!path.normalize(to).startsWith(rootDir)) {
      throw new Error(`copy destination ${to} is outside root dir.`)
    }

    if (fs.existsSync(to) && failOnOverwrite) {
      throw new Error(`copy destination ${to} already exists.`)
    }

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  })
}
