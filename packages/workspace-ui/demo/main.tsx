import { createRoot } from "react-dom/client";
import { CommandHall } from "./CommandHall";
import { ScoutHall } from "./ScoutHall";

createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).get("source") === "scout" ? (
    <ScoutHall />
  ) : (
    <CommandHall />
  ),
);
