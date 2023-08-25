import "https://cdn.jsdelivr.net/npm/axios@1.1.2"
import { merge } from "jquery"
import "mitt"

declare global {
  var axios: import("axios").AxiosStatic
  var mitt: typeof import("mitt").default
}

axios.get("https://www.example.com")

merge([1, 2], [3, 4])

mitt()
