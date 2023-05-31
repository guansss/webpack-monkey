import type { LoaderDefinition, RuleSetRule } from "webpack"

export interface FakeLoaderOptions {
  updateIndex: number
  invalidateUrlPath: string
}

/**
 * @param updateIndex starts from 1
 */
export type SourceReplacer = (s: string, updateIndex: number) => string

const replacers: Record<string, { replacer: SourceReplacer }> = {}

const loader: LoaderDefinition<FakeLoaderOptions> = function (source) {
  const { request } = this
  const { updateIndex, invalidateUrlPath } = this.getOptions()

  const match = source.match(/__NEXT__\(([^]+)\)/)

  if (!match) {
    return source
  }

  this.cacheable(false)

  const replacerRaw = match[1]!

  if (!replacers[request]) {
    replacers[request] = { replacer: eval(replacerRaw) }
  }

  const replacer = replacers[request]!.replacer

  const realSource = source.slice(0, match.index!) + source.slice(match.index! + match[0]!.length)
  const isFirstLoad = updateIndex === 0

  let updatedSource: string

  if (isFirstLoad) {
    updatedSource = realSource
  } else {
    updatedSource = replacer(realSource, updateIndex)
  }

  const nextUpdatedSource = replacer(realSource, updateIndex + 1)

  if (updatedSource !== nextUpdatedSource) {
    updatedSource += (() => {
      __MK_GLOBAL__.GM_fetch(__MK_GLOBAL__.origin + "%")
    })
      .toString()
      .replace(/\(\) => \{/, "")
      .replace(/}$/, "")
      .replace(/%/, invalidateUrlPath)
  }

  return updatedSource
}

export default loader

export function createFakeLoaderRule(options: FakeLoaderOptions): RuleSetRule {
  return {
    test: (file) => file.includes("tests/cases") || file.includes("tests\\cases"),
    loader: __filename,
    enforce: "pre",
    options: options,
  }
}
