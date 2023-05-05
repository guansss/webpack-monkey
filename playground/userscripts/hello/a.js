console.log("[hello] executing a")

export const a = 1

if (module.hot) {
  module.hot.dispose(() => {
    console.log("[hello] disposing a")
  })
}
