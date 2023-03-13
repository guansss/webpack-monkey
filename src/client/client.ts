import { compact } from "lodash"
import { urlMatch } from "../shared/utils"
import { MonkeyInjection, UserscriptInfo } from "../types/userscript"
import { enableHMR } from "./hmr"
import { log } from "./log"

enableHMR(module)

interface MonkeyGlobal extends MonkeyInjection {
  loadScript: (url: string) => void
}

declare global {
  var __MK_GLOBAL__: MonkeyGlobal
}

console.log("Monkey Client Loaded", __MK_INJECTION__)

declare const __MK_INJECTION__: MonkeyInjection

Object.assign(__MK_GLOBAL__, __MK_INJECTION__)

const { userscripts } = __MK_GLOBAL__

const loadedScripts: UserscriptInfo[] = []

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
}
