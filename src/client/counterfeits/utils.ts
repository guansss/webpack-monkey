export function assertXHRMethod(method: string): asserts method is "GET" | "POST" | "HEAD" {
  if (!["GET", "POST", "HEAD"].includes(method.toUpperCase())) {
    throw new Error(`Unsupported XHR method: ${method}`)
  }
}

export function parseHeaders(headers: string): Record<string, string> {
  return headers
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(": "))
    .reduce((headers, [name, value]) => {
      headers[name!] = value!
      return headers
    }, {} as Record<string, string>)
}
