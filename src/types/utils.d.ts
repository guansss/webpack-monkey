export type MaybePromise<T> = T | Promise<T>

/** Maps the property types of an object. Only one level deep. */
export type MapValues<T extends object, U extends [any, any]> = {
  [K in keyof T]: MapSingleValue<T[K], U> extends never ? T[K] : MapSingleValue<T[K], U>[1]
}

type MapSingleValue<T, U extends [any, any]> = U extends any ? (U[0] extends T ? U : never) : never

export type ExtractFunction<T> = T extends (...args: any[]) => any ? T : never

export type LiteralUnion<T extends U, U = string> = T | (U & { zz_IGNORE_ME?: never })
