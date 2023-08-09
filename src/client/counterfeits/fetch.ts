import { parseHeaders } from "./utils"

interface GM_fetchRequestInit extends RequestInit {
  _gm?: GM_xmlhttpRequestParams
}

export const GM_fetch: (
  input: RequestInfo | URL,
  init?: GM_fetchRequestInit
) => Promise<Response> = async (input, { _gm, method, headers, body, signal } = {}) => {
  let normalizedHeaders: Record<string, string>

  if (headers instanceof Headers) {
    normalizedHeaders = {}
    headers.forEach((value, name) => (normalizedHeaders[name] = value))
  } else if (Array.isArray(headers)) {
    normalizedHeaders = Object.fromEntries(headers)
  } else {
    normalizedHeaders = headers as Record<string, string>
  }

  const params: GM_xmlhttpRequestParams = {
    url: String(input),
    method,
    headers: normalizedHeaders,

    // Tampermonkey's docs say that the data should be a string, but we're not gonna validate it
    data: body as any,

    ..._gm,
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
