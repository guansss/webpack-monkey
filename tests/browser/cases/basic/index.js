GM_log("basic userscript loaded")
GM_setValue("basic", "basic ready")

const div = document.createElement("div")
div.className = "basic-ready"
div.textContent = GM_getValue("basic")
document.body.appendChild(div)
