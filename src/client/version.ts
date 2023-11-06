import { DEV_SCRIPT_VERSION } from "../shared/constants"
import { log } from "./log"

const requestUrl = (document.currentScript as HTMLScriptElement | null)?.src

// the request URL only exist when the client script is loaded first time,
// and not exist when the client script is reloaded by HMR
if (requestUrl) {
  const version = requestUrl.match(/v=([0-9.]+)/)?.[1]

  if (!version || isNaN(+version) || +version < +DEV_SCRIPT_VERSION) {
    log(
      `the installed dev script is out of date, please reinstall it. (current: ${version}, latest: ${DEV_SCRIPT_VERSION})`,
    )
  }
}
