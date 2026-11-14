import type { Agent } from "./model";

const robes = {
  supervisor: "#71d2bc",
  worker: "#f4b45b",
  reviewer: "#b9a7ed",
  unknown: "#afc1cb",
};
// Original 16×20 pixel glyphs; integer rectangles, not imported game sprites.
const shape = [
  ".......aa.......",
  "......aaaa......",
  ".....aaaaaa.....",
  "....aaaaaaaa....",
  "...aaaaaaaaaa...",
  "..bbbbbbbbbbbb..",
  ".....cccccc.....",
  ".....cdccdc.....",
  ".....cccccc.....",
  "......cccc......",
  "....aaaaaa.e....",
  "...aaaaaaaae....",
  "..aa.aaaa.ae....",
  "..cc.aaaa.cce...",
  ".....aaaa..e....",
  "....aaaaaa.e....",
  "....aaaaaa.e....",
  "...aaaaaaaae....",
  "....ff..ff.e....",
  "...fff..fffe....",
];
export function PixelAgent({
  role,
  className = "",
}: {
  role: Agent["role"];
  className?: string;
}) {
  const colors: Record<string, string> = {
    a: robes[role],
    b: "#303e50",
    c: "#e8c69a",
    d: "#1b2230",
    e: "#b9a480",
    f: "#526b7a",
  };
  return (
    <svg
      className={`dw-pixel-agent ${className}`}
      aria-hidden="true"
      viewBox="0 0 16 20"
      shapeRendering="crispEdges"
    >
      {shape.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          pixel === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              fill={colors[pixel]}
            />
          ),
        ),
      )}
      {role === "worker" && (
        <>
          <rect x="4" y="0" width="8" height="4" fill="#b9a480" />
          <rect x="3" y="4" width="10" height="2" fill="#f4b45b" />
        </>
      )}
      {role === "reviewer" && (
        <>
          <rect x="4" y="0" width="8" height="5" fill="#b9a7ed" />
          <rect x="2" y="4" width="12" height="2" fill="#526b7a" />
        </>
      )}
    </svg>
  );
}
