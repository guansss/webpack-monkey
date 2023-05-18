import { debounce } from "lodash-es"
import { log } from "./log"

const linkElements = /*#__PURE__*/ new Set<HTMLLinkElement>()

export async function loadCss(url: string) {
  const element = GM_addElement("link", {
    rel: "stylesheet",
    href: url,
  })

  linkElements.add(element)
}

export function styleLoaderInsertStyleElement(options: any) {
  options.styleTagTransform = function monkeyStyleTagTransform(
    css: string,
    styleElement: HTMLStyleElement
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
  // const css = await GM_fetch(url).then((res) => res.text())

  return debounce(() => {
    // TODO: reload on demand
    reloadAllCss()
  }, 50)
}

function reloadAllCss() {
  log("reloading all css")

  // clone the set to avoid concurrent modification
  const oldLinks = Array.from(linkElements)

  oldLinks.forEach((element) => {
    element.remove()
    linkElements.delete(element)

    loadCss(element.href.replace(/\?.*$/, "") + "?" + Date.now())

    // TODO: verbose log here
  })
}
