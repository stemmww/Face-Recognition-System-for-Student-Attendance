import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";
import "./i18n";
import App from "./App";
import { applyBrandCssVars } from "./styles/theme";

applyBrandCssVars();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/student-app-sw.js").catch(() => {});
  });
}
