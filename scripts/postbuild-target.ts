import { green } from "colorette"
import fs from "fs"
import * as glob from "glob"
import path from "path"
import tsconfig from "../tsconfig.json"

const target = process.argv[2] as "node" | "client"

const renamedShared = "shared-" + target

function main() {
  const jsDir = resolveFromProjectRoot(tsconfig.compilerOptions.outDir)
  const dtsDir = resolveFromProjectRoot(tsconfig.compilerOptions.declarationDir)

  if (!jsDir || !dtsDir) {
    throw new Error("outDir/declarationDir not defined in tsconfig.json")
  }

  renameDir(jsDir, "shared", renamedShared)
  renameDir(dtsDir, "shared", renamedShared)

  rewriteSharedImports([
    path.join(jsDir, `${target}/**/*.js`),
    path.join(dtsDir, `${target}/**/*.d.ts`),
  ])

  rewriteFile(path.resolve(dtsDir, "index.d.ts"), (content) =>
    content.replace("../../src/env.d.ts", "./env.d.ts")
  )
}

function resolveFromProjectRoot(p?: string) {
  return p && path.resolve(__dirname, "..", p)
}

function renameDir(root: string, from: string, to: string) {
  from = path.resolve(root, from)
  to = path.resolve(root, to)

  if (!fs.existsSync(from)) {
    throw new Error(`Directory ${from} does not exist`)
  }
  if (fs.existsSync(to)) {
    throw new Error(`Directory ${to} already exists`)
  }

  fs.renameSync(from, to)

  console.log(green(`Renamed "${from}" to "${to}"`))
}

function rewriteSharedImports(patterns: string[]) {
  let fileCount = 0

  glob
    .sync(patterns, {
      absolute: true,
      windowsPathsNoEscape: true,
    })
    .forEach((file) => {
      const success = rewriteFile(file, (content) =>
        content
          .replace(/from "(.+?)\/shared/g, `from "$1/${renamedShared}`)
          .replace(/require\("(.+?)\/shared/g, `require("$1/${renamedShared}`)
      )

      if (success) {
        fileCount++
      }
    })

  if (fileCount === 0) {
    throw new Error(`No files found with globs: ${patterns}`)
  }

  console.log(green(`Rewritten import/require paths in ${fileCount} files`))
}

function rewriteFile(file: string, rewriter: (content: string) => string) {
  const content = fs.readFileSync(file, "utf8")
  const newContent = rewriter(content)

  if (newContent === content) {
    return false
  }

  fs.writeFileSync(file, newContent, "utf8")
  return true
}

main()
