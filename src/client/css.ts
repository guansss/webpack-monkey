import { debounce } from "lodash"
import { GM_fetch } from "./counterfeits/fetch"
import { log } from "./log"

const styleElements = /*#__PURE__*/ new Map<string, HTMLStyleElement>()

/**
 * The stylesheet is fetched by the userscript manager instead of being referenced by a
 * `<link>` element, otherwise the page itself would request the dev server, which triggers
 * Chrome's Local Network Access check and requires GM_addElement to be available.
 */
export async function loadCss(url: string) {
  const separator = url.includes("?") ? "&" : "?"
  const css = await GM_fetch(url + separator + "t=" + Date.now()).then((res) => res.text())

  const element = GM_addStyle(css)

  styleElements.get(url)?.remove()
  styleElements.set(url, element)
}

export function styleLoaderInsertStyleElement(options: any) {
  options.styleTagTransform = function monkeyStyleTagTransform(
    css: string,
    styleElement: HTMLStyleElement,
  ) {
    styleElement?.remove()
    GM_addStyle(css)
  }

  return document.createElement("style")
}

/**
 * Compatible with mini-css-extract-plugin and style-loader
 * @see https://github.com/webpack-contrib/mini-css-extract-plugin/blob/65519d0701b3c5d60585468b8220159cbbfbe6b8/src/hmr/hotModuleReplacement.js#L254-L285
 */
export function miniCssExtractHmr(moduleId: string | undefined, options: object) {
  return debounce(() => {
    // TODO: reload on demand
    reloadAllCss()
  }, 50)
}

function reloadAllCss() {
  log("reloading all css")

  // clone the keys to avoid concurrent modification
  Array.from(styleElements.keys()).forEach((url) => {
    loadCss(url).catch((e) => log(`failed to reload css (${url}):`, e))
  })
}
