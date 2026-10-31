import type { Page } from "@playwright/test"
import type webpack from "webpack"
import { merge } from "webpack-merge"
import { createHotLoaderRule, type SourceReplacer } from "../utils/hot-loader"
import { useDevServer, type UseDevServerContext } from "../utils/webpack"

export interface HotDevServerContext extends UseDevServerContext {
  hotReload(replacers: Record<string, SourceReplacer>): Promise<void>
}

export async function useHotDevServer(
  page: Page,
  config: webpack.Configuration,
  fn: (context: HotDevServerContext) => Promise<void>,
) {
  const hotLoaderRule = createHotLoaderRule()
  const hotConfig = merge({}, config, {
    module: {
      rules: [hotLoaderRule],
    },
  })

  await useDevServer(hotConfig, async (context) => {
    await fn({
      ...context,
      async hotReload(replacers) {
        Object.assign(hotLoaderRule.options.replacers, replacers)

        await Promise.all([
          page.waitForEvent("console", (message) => message.text() === "[HMR] App is up to date."),
          new Promise<void>((resolve) => context.server.invalidate(resolve)),
        ])
      },
    })
  })
}
