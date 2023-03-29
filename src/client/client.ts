import { compact } from "lodash"
import { urlMatch } from "../shared/utils"
import { MonkeyInjection, UserscriptInfo } from "../types/userscript"
import { loadCss, miniCssExtractHmr, styleLoaderInsertStyleElement } from "./css"
import { enableHMR } from "./hmr"
import { log } from "./log"

enableHMR(module)

interface MonkeyGlobal extends MonkeyInjection {
  loadScript: (url: string) => void
  miniCssExtractHmr: (moduleId: string, options: object) => () => void
  styleLoaderInsertStyleElement: (options: object) => HTMLStyleElement
}

declare global {
  var __MK_GLOBAL__: MonkeyGlobal
}

console.log("Monkey Client Loaded", __MK_INJECTION__)

declare const __MK_INJECTION__: MonkeyInjection

Object.assign(__MK_GLOBAL__, {
  ...__MK_INJECTION__,
  miniCssExtractHmr,
  styleLoaderInsertStyleElement,
} satisfies Omit<MonkeyGlobal, "loadScript">)

const { userscripts } = __MK_GLOBAL__

const loadedScripts: UserscriptInfo[] = (module.hot?.data as any)?.loadedScripts || []

userscripts.filter(matchScript).forEach(loadScript)

function matchScript({ name, meta }: UserscriptInfo) {
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

function loadScript(script: UserscriptInfo) {
  if (loadedScripts.find(({ name }) => name === script.name)) {
    return
  }

  log("Loading script:", script.name)

  loadedScripts.push(script)

  __MK_GLOBAL__.loadScript(script.url)

  // when using mini-css-extract-plugin, we need to manually load css files
  for (const asset of script.assets) {
    if (asset.endsWith(".css")) {
      loadCss(asset)
    }
  }
}

module.hot?.dispose((data: any) => {
  data.loadedScripts = loadedScripts
})
