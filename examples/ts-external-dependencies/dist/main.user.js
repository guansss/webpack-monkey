// ==UserScript==
// @name     TS External Dependencies
// @require  https://cdn.jsdelivr.net/npm/axios@1.1.2
// @require  https://unpkg.com/jquery@3.7.0
// @require  https://unpkg.com/mitt/dist/mitt.umd.js
// @match    *://*/*
// @version  1.0.0
// ==/UserScript==

;(() => {
  "use strict"

  const external_$_namespaceObject = $

  mitt

  axios.get("https://www.example.com")
  ;(0, external_$_namespaceObject.merge)([1, 2], [3, 4])
  mitt()
})()
