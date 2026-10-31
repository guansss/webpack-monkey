// ==UserScript==
// @name     CSS Example
// @grant    GM_addStyle
// @match    *://*/*
// @version  1.0.0
// ==/UserScript==

;(() => {
  "use strict"
  const styles_module = { title: "styles-module__title--bB9b" }
  console.log("Title class:", styles_module.title)
})()

GM_addStyle(`
body {
  background-color: #1a1a2e;
  color: #eaeaea;
  font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans, sans-serif;
}

.styles-module__title--bB9b {
  font-size: 2rem;
  font-weight: bold;
}

`)
