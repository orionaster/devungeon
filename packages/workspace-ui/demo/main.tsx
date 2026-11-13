import { createRoot } from "react-dom/client";
import { CommandHall } from "./CommandHall";
import { ScoutHall } from "./ScoutHall";
import { lazy, Suspense } from "react";

const HeroHall = lazy(() => import("./HeroWorkspaceHall"));
const PrimaryGame = lazy(() => import("./PrimaryGame"));
const source = new URLSearchParams(location.search).get("source");

const root = createRoot(document.getElementById("root")!);
root.render(
  source === "game" ? (
    <Suspense fallback={<p>正在进入 Devungeon…</p>}>
      <PrimaryGame />
    </Suspense>
  ) : source === "hero" ? (
    <Suspense fallback={<p>正在进入 3D 工坊…</p>}>
      <HeroHall
        source={
          new URLSearchParams(location.search).get("connection") === "scout"
            ? "scout"
            : new URLSearchParams(location.search).get("connection") === "codex" ? "codex" : "demo"
        }
      />
    </Suspense>
  ) : source === "scout" ? (
    <ScoutHall />
  ) : (
    <CommandHall />
  ),
);

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
