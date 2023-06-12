import type { LoaderDefinition, RuleSetRule } from "webpack"

export interface FakeLoaderOptions {
  replacers: Record<string, SourceReplacer | undefined>
}

export type SourceReplacer = (s: string) => string

const loader: LoaderDefinition<FakeLoaderOptions> = function (source) {
  const { resourcePath } = this
  const { replacers } = this.getOptions()

  this.cacheable(false)

  if (replacers[resourcePath]) {
    source = replacers[resourcePath]!(source)
  }

  return source
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
