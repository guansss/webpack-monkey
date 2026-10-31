;(async function () {
  "use strict"

  const { clientScript, runtimeScript } = __MK_DEV_INJECTION__

  if (!clientScript || !runtimeScript) {
    console.warn("[Monkey Dev] client script not found")
    return
  }

  console.log("[Monkey Dev] running")

  loadScript(runtimeScript)
    .then(() => loadScript(clientScript))
    .catch((e) => {
      if (isCSPEvalError(e)) {
        console.warn(
          "[Monkey Dev] This page's Content Security Policy blocks the dev client from " +
            "evaluating the fetched bundles (eval is disallowed). Userscripts can't run here " +
            "in development.\n" +
            "The production build is unaffected. To develop against this page, disable its CSP " +
            "with a browser extension, then reload:\n" +
            "- Chrome/Edge: https://github.com/lisonge/Disable-CSP\n" +
            "- Firefox: https://addons.mozilla.org/en-US/firefox/addon/disable-csp-for-a-minute/",
        )
        return
      }

      console.error("[Monkey Dev]", e)
    })

  // A strict CSP (e.g. default-src 'self' without 'unsafe-eval') makes eval() throw an
  // EvalError when the dev client tries to evaluate the fetched bundles.
  function isCSPEvalError(e) {
    return e instanceof Error && (e.name === "EvalError" || /unsafe-eval|eval/i.test(e.message))
  }

  function loadScript(url) {
    return new Promise((resolve, reject) => {
      const fail = (...args) => {
        reject(
          new Error(
            `failed to load script (${url}), please check if the server is running. Details: ${JSON.stringify(
              args,
            )}`,
          ),
        )
      }

      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (res) => {
          try {
            if (res.status === 404) {
              throw new Error(`Script not found (${url}).`)
            }

            const fakeScript = document.createElement("script")
            fakeScript.src = url

            // fake `document.currentScript` for webpack runtime
            Object.defineProperty(document, "currentScript", {
              get: () => fakeScript,
              configurable: true,
            })

            eval(res.responseText)

            delete document.currentScript

            resolve()
          } catch (e) {
            reject(e)
          }
        },
        onerror: fail,
        ontimeout: fail,
      })
    })
  }
})()
