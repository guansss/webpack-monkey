import { resolveUrlExternal } from "../src/node/utils"

it("resolves URL externals to valid external values", () => {
  expect(resolveUrlExternal("zzz", "var foo@https://example.com")).toMatchObject({
    type: "var",
    identifier: "foo",
    url: "https://example.com",
    value: "var foo",
  })

  expect(resolveUrlExternal("zzz", "foo@https://example.com")).toMatchObject({
    type: undefined,
    identifier: "foo",
    url: "https://example.com",
    value: "foo",
  })

  expect(resolveUrlExternal("zzz", "https://example.com")).toMatchObject({
    type: undefined,
    identifier: undefined,
    url: "https://example.com",
    value: '"https://example.com"',
  })

  expect(resolveUrlExternal("zzz", "foo")).toBeUndefined()
})
