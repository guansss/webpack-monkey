module.exports = function () {
  if (typeof __MK_GLOBAL__ !== "undefined") {
    return __MK_GLOBAL__.styleLoaderInsertStyleElement.apply(null, arguments)
  }

  // Fallback for production builds where __MK_GLOBAL__ is not defined.
  // In this case, we use GM_addStyle directly via styleTagTransform.
  var options = arguments[0] || {}
  options.styleTagTransform = function monkeyStyleTagTransform(css, styleElement) {
    if (styleElement) styleElement.remove()
    GM_addStyle(css)
  }
  return document.createElement("style")
}
