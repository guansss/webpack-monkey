// @ts-ignore
// prettier-ignore
export { getDescriptionFile, getRequiredVersionFromDescriptionFile } from "webpack/lib/sharing/utils";

import { isArray, isBoolean, isNil, isObject, isString } from "lodash"
import { Compilation, sources } from "webpack"
import { getGMAPIs } from "../shared/GM"
import { META_FIELDS, META_FIELDS_WITH_LOCALIZATION, UserscriptMeta } from "../shared/meta"
import { includes } from "../shared/utils"

export function getPackageDepVersion(packageJson: any, dep: string): string | undefined {
  if (!isObject(packageJson)) {
    return undefined
  }

  // @ts-ignore
  return getRequiredVersionFromDescriptionFile(packageJson, dep)
}

export function getPackageJson(fs: Compilation["inputFileSystem"], context: string) {
  return new Promise<{ data: object; path: string }>((resolve, reject) => {
    // @ts-ignore
    getDescriptionFile(fs, context, ["package.json"], (err: any, result: any) => {
      if (err) {
        reject(err)
      } else {
        resolve(result)
      }
    })
  })
}

export function traverseAndFindSource(
  source: unknown,
  cb: (source: sources.Source) => void | true
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

export function generateMetaBlock(
  source: string,
  meta: UserscriptMeta,
  { requires }: { requires?: string[] } = {}
) {
  let metaBlock = "// ==UserScript==\n"
  const fieldPrefix = "// @"

  const metaFields = Object.keys(meta)
  const maxFieldLength = Math.max(
    ...["grant", "require", ...metaFields].map((field) => field.length)
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
    if (includes(META_FIELDS_WITH_LOCALIZATION, field)) {
      const value = meta[field]

      if (value) {
        if (isString(value)) {
          putField(field, value)
        } else {
          for (const lang in value) {
            putField(field + (lang === "default" ? "" : ":" + lang), value[lang]!)
          }
        }
      }
    } else if (field === "grant") {
      putField(
        "grant",
        getGMAPIs().filter((api) => source.includes(api))
      )

      if (meta.grant) {
        putField("grant", meta.grant)
      }
    } else if (field === "require") {
      if (requires) {
        putField("require", requires)
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
