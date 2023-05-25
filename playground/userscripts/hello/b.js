console.log("[hello] executing b")

export const b = 1

module.hot?.dispose(() => {
  console.log("[hello] disposing b")
})
