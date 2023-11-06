;(async function () {
  "use strict"

  const { clientScript, runtimeScript } = __MK_DEV_INJECTION__

  if (!clientScript || !runtimeScript) {
    console.warn("[Monkey Dev] client script not found")
    return
  }

  console.log("[Monkey Dev] running")

  loadScript(runtimeScript).then(() => loadScript(clientScript))

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
