import { UserscriptMeta } from "../shared/meta"

export interface UserscriptInfo {
  dir: string
  name: string
  entry: string
  url: string
  meta: UserscriptMeta
}

export interface MonkeyInjection {
  userscripts: UserscriptInfo[]
}
