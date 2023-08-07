import { SetOptional } from "type-fest"
import type { LoaderDefinition, RuleSetRule } from "webpack"

export interface HotLoaderOptions {
  // use a function as the base object to prevent webpack-merge from cloning it,
  // so that we can keep the object's reference and modify it from outside
  replacers: Record<string, SourceReplacer | undefined> & Function
}

export type SourceReplacer = (s: string) => string

const loader: LoaderDefinition<HotLoaderOptions> = function (source) {
  const { resourcePath } = this
  const { replacers } = this.getOptions()

  this.cacheable(false)

  if (replacers[resourcePath]) {
    source = replacers[resourcePath]!(source)
  }

  return source
}

export default loader

export function createHotLoaderRule(options: Omit<HotLoaderOptions, "replacers">) {
  return {
    test: (file) => file.includes("tests/cases") || file.includes("tests\\cases"),
    loader: __filename,
    enforce: "pre",
    options: {
      ...options,
      replacers: new Function() as HotLoaderOptions["replacers"],
    } satisfies HotLoaderOptions,
  } satisfies RuleSetRule
}
