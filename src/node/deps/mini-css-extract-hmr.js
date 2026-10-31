module.exports = function () {
  if (typeof __MK_GLOBAL__ !== "undefined") {
    return __MK_GLOBAL__.miniCssExtractHmr.apply(null, arguments)
  }
  // In production, HMR is not active — return a no-op function.
  return function () {}
}
