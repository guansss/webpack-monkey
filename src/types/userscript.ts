import { UserscriptMeta } from "../shared/meta"

export interface UserscriptInfo {
  dir: string
  name: string
  entry: string
  url: string
  meta: UserscriptMeta
  assets: string[]
}

export interface MonkeyInjection {
  origin: string
  userscripts: UserscriptInfo[]
}

export interface MonkeyDevInjection {
  clientScript: string
  runtimeScript: string
}
