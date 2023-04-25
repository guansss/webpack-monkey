;(async function () {
  "use strict"

  const { clientScript, runtimeScript } = __MK_DEV_INJECTION__

  if (!clientScript || !runtimeScript) {
    console.warn("[Monkey Dev] client script not found")
    return
  }

  window.__MK_GLOBAL__ = unsafeWindow.__MK_GLOBAL__ = {
    loadScript: (url) => {
      return new Promise((resolve, reject) => {
        const fail = () => {
          reject(
            new Error(`failed to load script (${url}), please check if the server is running.`)
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
    },
  }

  console.log("[Monkey Dev] running")

  __MK_GLOBAL__.loadScript(runtimeScript).then(() => __MK_GLOBAL__.loadScript(clientScript))
})()
