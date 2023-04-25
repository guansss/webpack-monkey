console.log("[hello] executing a")

export const a = 1

module.hot.dispose(() => {
  console.log("[hello] disposing a")
})
