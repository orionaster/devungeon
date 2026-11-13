import { createRoot } from "react-dom/client";
import { CommandHall } from "./CommandHall";
import { ScoutHall } from "./ScoutHall";
import { lazy, Suspense } from "react";
import { I18nProvider, useI18n } from "../src/i18n";

const HeroHall = lazy(() => import("./HeroWorkspaceHall"));
const PrimaryGame = lazy(() => import("./PrimaryGame"));
const source = new URLSearchParams(location.search).get("source");

const root = createRoot(document.getElementById("root")!);
function Application() {
  const { t } = useI18n();
  return source === "game" ? (
    <Suspense fallback={<p>{t("loading.world")}</p>}>
      <PrimaryGame />
    </Suspense>
  ) : source === "hero" ? (
    <Suspense fallback={<p>{t("loading.forge")}</p>}>
      <HeroHall
        source={
          new URLSearchParams(location.search).get("connection") === "scout"
            ? "scout"
            : new URLSearchParams(location.search).get("connection") === "codex"
              ? "codex"
              : "demo"
        }
      />
    </Suspense>
  ) : source === "scout" ? (
    <ScoutHall />
  ) : (
    <CommandHall />
  );
}
root.render(
  <I18nProvider>
    <Application />
  </I18nProvider>,
);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
