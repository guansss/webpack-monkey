import exNamed, { x1 } from "ex-named"
import exUrlNamed, { x3 } from "exUrlNamed@https://ex-url-named"
import exUrl, { x2 } from "https://ex-url"

import "exUrlGlobalNamed@https://ex-url-global-named"
import "https://ex-url-global"
import "https://ex-url-global2"
import "https://ex-url-global3"
import "ex"

window.externalTestResult = [
  [exNamed.x1, x1],
  [exUrl.x2, x2],
  [exUrlNamed.x3, x3],
  [exUrlGlobal.x1],
  [exUrlGlobalNamed.x1],
]
