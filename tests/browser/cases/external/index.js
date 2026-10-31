import exVendor from "ex"

const div = document.createElement("div")
div.className = "external-ready"
div.textContent = exVendor.message
document.body.appendChild(div)
