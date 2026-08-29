import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App"

// Geist is what shadcn/ui itself uses. Self-hosted rather than pulled from
// Google Fonts so the service worker can precache it and the app renders with
// the right type offline, with no third-party request on first paint.
import "@fontsource-variable/geist"
import "@fontsource-variable/geist-mono"

import "highlight.js/styles/github-dark.css"
import "./index.css"

const root = document.getElementById("root")
if (!root) throw new Error("Missing #root element")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
