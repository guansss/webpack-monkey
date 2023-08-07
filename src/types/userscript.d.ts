import { UserscriptMeta } from "../shared/meta"

export interface UserscriptInfo {
  dir: string
  name: string
  entry: string
  url: string
  meta: UserscriptMeta
  requires: string[]
  assets: string[]
}

export interface MonkeyInjection {
  debug: boolean
  origin: string
  userscripts: UserscriptInfo[]
}

export interface MonkeyDevInjection {
  clientScript: string
  runtimeScript: string
}
