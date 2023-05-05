console.log("[hello] executing b")

export const b = 1

if (module.hot) {
  module.hot.dispose(() => {
    console.log("[hello] disposing b")
  })
}
