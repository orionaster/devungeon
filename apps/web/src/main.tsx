import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import { I18nProvider } from "../../../packages/workspace-ui/src/i18n";
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <App />
  </I18nProvider>,
);
