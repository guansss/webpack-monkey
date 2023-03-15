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

export interface MonkeyDevInjection {
  clientScript: string
  runtimeScript: string
}

export const VAR_MK_INJECTION = "__MK_INJECTION__"
export const VAR_MK_DEV_INJECTION = "__MK_DEV_INJECTION__"
