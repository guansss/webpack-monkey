import { isPlainObject } from "lodash-es"
import { assertXHRMethod, parseHeaders } from "./utils"

type CounterfeitFetch = (
  input: RequestInfo | URL,
  init?: CounterfeitRequestInit
) => Promise<Response>

interface CounterfeitRequestInit extends RequestInit {
  _mk?: {
    responseType?: "text" | "json"
  }
}

export const GM_fetch: CounterfeitFetch = async (
  input,
  { _mk, method = "GET", headers, body, signal } = {}
) => {
  assertXHRMethod(method)

  if (body && typeof body !== "string") {
    throw new Error("GM_fetch only supports string body")
  }

  const responseType = _mk?.responseType ?? "text"

  headers ||= {}

  // ensure headers is a plain object
  if (!isPlainObject(headers)) {
    if (Array.isArray(headers)) {
      headers = Object.fromEntries(headers)
    } else {
      const h: Record<string, string> = {}
      ;(headers as Headers).forEach((value, name) => (h[name] = value))
      headers = h
    }
  }

  const params: GM_xmlhttpRequestParams = {
    url: String(input),
    method,
    responseType,
    headers: headers as Record<string, string>,
    data: body ?? undefined,
  }

  return new Promise((resolve, reject) => {
    params.onload = (resp) => {
      if (resp.status >= 200 && resp.status < 300) {
        resolve(
          new Response(resp.responseText, {
            status: resp.status,
            statusText: resp.statusText,
            headers: parseHeaders(resp.responseHeaders),
          })
        )
      } else {
        reject(resp)
      }
    }

    const { abort } = GM_xmlhttpRequest(params)

    if (signal) {
      signal.addEventListener("abort", abort)
    }
  })
}
