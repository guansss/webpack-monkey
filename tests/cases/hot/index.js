const div = GM_addElement(document.body, "div", { id: "div1" })

module.hot?.monkeyReload()
module.hot?.dispose(() => {
  div.remove()
})

__NEXT__((s) => s.replace(`div1`, `div2`))
