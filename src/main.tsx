import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App"
import "highlight.js/styles/github-dark.css"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
