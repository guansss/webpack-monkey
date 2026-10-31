export function parseHeaders(headers: string): Record<string, string> {
  // Tampermonkey separates the headers with CRLF, which would end up in the header names
  return (headers || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce(
      (headers, line) => {
        const separator = line.indexOf(":")

        if (separator > 0) {
          headers[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
        }

        return headers
      },
      {} as Record<string, string>,
    )
}
