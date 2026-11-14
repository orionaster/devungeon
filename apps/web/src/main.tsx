import { createRoot } from "react-dom/client";
import WorkspaceGame from "./WorkspaceGame";
import { I18nProvider } from "../../../packages/workspace-ui/src/i18n";
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <WorkspaceGame />
  </I18nProvider>,
);
