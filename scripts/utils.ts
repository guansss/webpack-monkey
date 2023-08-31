import fs from "fs"
import path from "path"

export const rootDir = path.resolve(__dirname, "..")

export function copyFiles(files: { from: string; to: string }[], failOnOverwrite = true) {
  const normalizedFiles = files.map(({ from, to }) => {
    if (!path.isAbsolute(from)) {
      throw new Error(`from path ${from} is not absolute.`)
    }
    if (!path.isAbsolute(to)) {
      throw new Error(`to path ${to} is not absolute.`)
    }

    const relativeFrom = path.relative(rootDir, from)
    const relativeTo = path.relative(rootDir, to)

    if (!path.normalize(to).startsWith(rootDir)) {
      throw new Error(`copy destination ${to} is outside root dir.`)
    }

    if (fs.existsSync(to) && failOnOverwrite) {
      throw new Error(`copy destination ${to} already exists.`)
    }

    return { from, to, relativeFrom, relativeTo }
  })

  const maxLeftWidth = Math.max(...normalizedFiles.map(({ relativeFrom }) => relativeFrom.length))

  normalizedFiles.forEach(({ from, to, relativeFrom, relativeTo }) => {
    console.log(`copying ${relativeFrom.padEnd(maxLeftWidth)} -> ${relativeTo}`)

    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(from, to)
  })
}

export function rewriteFile(
  file: string,
  rewriter: (content: string) => string,
  { failOnUnchanged }: { failOnUnchanged?: boolean } = {}
) {
  const content = fs.readFileSync(file, "utf8")
  const newContent = rewriter(content)

  if (newContent.length === content.length && newContent === content) {
    if (failOnUnchanged) {
      throw new Error(`rewriteFile: file ${file} is unchanged.`)
    }
    return false
  }

  fs.writeFileSync(file, newContent, "utf8")
  return true
}
