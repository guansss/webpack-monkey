import type { LoaderDefinition, RuleSetRule } from "webpack"

export interface HotLoaderOptions {
  replacers: Record<string, SourceReplacer | undefined> & Function
}

export type SourceReplacer = (source: string) => string

const loader: LoaderDefinition<HotLoaderOptions> = function (source) {
  const replacer = this.getOptions().replacers[this.resourcePath]

  this.cacheable(false)
  return replacer ? replacer(source) : source
}

export default loader

export function createHotLoaderRule(replacers: Record<string, SourceReplacer | undefined> = {}) {
  const mutableReplacers = new Function() as HotLoaderOptions["replacers"]
  Object.assign(mutableReplacers, replacers)

  return {
    test: (file) => file.includes("/cases/") || file.includes("\\cases\\"),
    loader: __filename,
    enforce: "pre",
    options: {
      replacers: mutableReplacers,
    } satisfies HotLoaderOptions,
  } satisfies RuleSetRule
}
