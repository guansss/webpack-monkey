// the ID will be string in development mode and number in production mode
export type WebpackModuleId = string | number

export interface WebpackModule extends Omit<NodeModule, "children"> {
  parents: WebpackModuleId[]
  children: WebpackModuleId[]
}
