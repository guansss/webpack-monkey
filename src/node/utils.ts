// @ts-ignore
// prettier-ignore
import { getDescriptionFile, getRequiredVersionFromDescriptionFile } from "webpack/lib/sharing/utils";

import { isArray, isBoolean, isNil, isObject, isString, trimEnd } from "lodash"
import { Compilation, sources } from "webpack"
import { getGMAPIs } from "../shared/GM"
import { META_FIELDS, META_FIELDS_I18N, UserscriptMeta } from "../shared/meta"
import { includes } from "../shared/utils"

export function getPackageDepVersion(packageJson: any, dep: string): string | undefined {
  if (!isObject(packageJson)) {
    return undefined
  }

  return getRequiredVersionFromDescriptionFile(packageJson, dep)
}

export function getPackageJson(fs: Compilation["inputFileSystem"], context: string) {
  return new Promise<{ data: object; path: string }>((resolve, reject) => {
    getDescriptionFile(fs, context, ["package.json"], (err: any, result: any) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export function pathSplit(path: string) {
  return path.replace(/\\/g, "/").split("/")
}

export function traverseAndFindSource(
  source: unknown,
  cb: (source: sources.Source) => void | true,
): sources.Source | undefined {
  if (!source || !(source instanceof sources.Source)) {
    return undefined
  }

  const found = cb(source)

  if (found === true) {
    return source
  }

  if ((source as any)._children) {
    for (const child of (source as any)._children as unknown[]) {
      const result = traverseAndFindSource(child, cb)

      if (result) {
        return result
      }
    }
  }

  return traverseAndFindSource((source as any)._source, cb)
}

export function generateMetaBlock(source: string, meta: UserscriptMeta) {
  let metaBlock = "// ==UserScript==\n"
  const fieldPrefix = "// @"

  const metaFields = Object.keys(meta)
  const maxFieldLength = Math.max(
    ...["grant", "require", ...metaFields].map((field) => {
      if (includes(META_FIELDS_I18N, field)) {
        const value = meta[field]

        if (isObject(value)) {
          const maxLangLength = Math.max(
            ...Object.keys(value).map((lang) => (lang === "default" ? 0 : lang.length)),
          )

          return field.length + maxLangLength
        }
      }

      return field.length
    }),
  )
  const indentSize = fieldPrefix.length + maxFieldLength + 2
  const indentEnd = (str: string) => str.padEnd(indentSize, " ")

  function putField(field: string, value: string | string[] | boolean) {
    let line = fieldPrefix + field

    if (isString(value)) {
      line = indentEnd(line) + value
    } else if (isArray(value)) {
      if (!value.length) {
        return
      }

      line = value.map((v) => indentEnd(line) + v).join("\n")
    } else if (isBoolean(value)) {
      // ignore false value
      if (!value) {
        return
      }
    } else {
      console.warn("Unknown type of value:", value)
    }

    metaBlock += line + "\n"
  }

  for (const field of META_FIELDS) {
    if (includes(META_FIELDS_I18N, field)) {
      const value = meta[field]

      if (value) {
        if (isString(value)) {
          putField(field, value)
        } else {
          for (const lang of Object.keys(value)) {
            putField(field + (lang === "default" ? "" : ":" + lang), value[lang]!)
          }
        }
      }
    } else if (field === "grant") {
      putField(
        "grant",
        getGMAPIs().filter((api) => source.includes(api)),
      )

      if (meta.grant) {
        putField("grant", meta.grant)
      }
    } else {
      if (!isNil(meta[field])) {
        putField(field, meta[field]!)
      }
    }
  }

  metaBlock += "// ==/UserScript=="

  return metaBlock
}

export interface ResolveExternalResult {
  type?: string
  identifier?: string
  url: string
  value: string
}

export function resolveUrlExternal(externalValue: string): ResolveExternalResult | undefined {
  // full example: "var foo@https://example.com"
  const match = externalValue.match(/^(.*? )?(.+?@)?(https?:\/\/.+)$/)

  if (!match) {
    return undefined
  }

  const type = match[1]?.trim()
  const identifier = match[2] && trimEnd(match[2], "@")
  const url = match[3]!
  const value = (type ? type + " " : "") + (identifier || JSON.stringify(url))

  const resolved: ResolveExternalResult = {
    type,
    identifier,
    url,
    value,
  }

  return resolved
}

export function getUnnamedUrlExternalErrorMessage(url?: string) {
  const exampleUrl = url || "https://example.com"
  return `Unexpected reference to unnamed external module with URL "${url || "<unknown URL>"}".
This happens when you import a module from a URL
but do not specify an identifier for it,
e.g. \`import foo from "${exampleUrl}"\`, which will cause
runtime errors in the generated code. To fix this,
either add a universally unique identifier to the import statement,
e.g. \`import foo from "foo@${exampleUrl}"\`,
or do not import anything from it,
e.g. \`import "${exampleUrl}"\`.`.replace(/\n/g, " ")
}
