import "./version"

import { compact } from "lodash"
import { urlMatch } from "../shared/utils"
import { MonkeyInjection, UserscriptInfo } from "../types/userscript"
import { WebpackModule } from "../types/webpack"
import { GM_fetch } from "./counterfeits/fetch"
import { loadCss, miniCssExtractHmr, styleLoaderInsertStyleElement } from "./css"
import { monkeyReload } from "./hmr"
import { log } from "./log"

interface MonkeyGlobal extends MonkeyInjection {
  GM_fetch: typeof GM_fetch
  loadScripts: (scripts: { url: string }[]) => Promise<unknown>
  miniCssExtractHmr: (moduleId: string, options: object) => () => void
  styleLoaderInsertStyleElement: (options: object) => HTMLStyleElement
}

declare global {
  var __MK_GLOBAL__: MonkeyGlobal
}

monkeyReload(module as unknown as WebpackModule)

declare const __MK_INJECTION__: MonkeyInjection

window.__MK_GLOBAL__ = {
  ...__MK_INJECTION__,
  GM_fetch,
  loadScripts,
  miniCssExtractHmr,
  styleLoaderInsertStyleElement,
}

const { userscripts } = __MK_GLOBAL__

const loadedScripts: UserscriptInfo[] = (module.hot?.data as any)?.loadedScripts || []

userscripts.filter(matchUserscript).forEach(loadUserscript)

export function matchUserscript({ name, meta }: UserscriptInfo) {
  const pageUrl = location.href

  try {
    const include = compact([meta.include, meta.match]).flat()

    if (include.some((pattern) => urlMatch(pattern, pageUrl))) {
      const exclude = compact([meta.exclude]).flat()

      if (!exclude.some((pattern) => urlMatch(pattern, pageUrl))) {
        return true
      }
    }
  } catch (e) {
    log(`Error matching script "${name}":`, e)
  }

  return false
}

export async function loadUserscript(script: UserscriptInfo) {
  if (loadedScripts.find(({ name }) => name === script.name)) {
    return
  }

  if (__MK_GLOBAL__.debug) {
    log("Loading script:", script.name)
    log("Loading externals:", ...script.requires)
  }

  await Promise.all([
    loadScripts([...script.requires.map((url) => ({ url })), script]),

    // when using mini-css-extract-plugin, we need to manually load css files
    ...script.assets.map((asset) => {
      if (asset.endsWith(".css")) {
        return loadCss(asset)
      }
    }),
  ])

  loadedScripts.push(script)
}

export async function loadScripts(scripts: { url: string }[]) {
  const contents = await Promise.all(
    scripts.map(({ url }) => GM_fetch(url).then((res) => res.text())),
  )

  contents.forEach((content) => {
    // make sure the evaluated code doesn't act like a module if it has a UMD wrapper
    const module = undefined
    const exports = undefined
    const require = undefined

    eval(content)
  })
}

module.hot?.dispose((data: any) => {
  data.loadedScripts = loadedScripts
})
