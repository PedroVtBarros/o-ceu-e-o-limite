import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./theme.css";
import "./goals.css";
import "./checklist.css";
import "./analytics.css";
import "./routines.css";
import "./journey.css";
import "./backup.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
