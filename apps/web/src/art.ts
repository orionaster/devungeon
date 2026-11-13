/**
 * Original Devungeon pixel artwork, authored in source for HERO S1.
 * Copyright 2026 Devungeon contributors. SPDX-License-Identifier: Apache-2.0
 * See ART_LICENSE.md. No external sprites, fonts, or image bytes are used.
 */
import {
  CanvasTexture,
  NearestFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

export type SpriteKind =
  | "hero"
  | "slime"
  | "sentinel"
  | "wizard"
  | "builder"
  | "scout"
  | "flame"
  | "chest";
export type SpriteFacing = "front" | "back" | "left" | "right";
export type TileKind = "floor" | "wall" | "trim" | "locked";

const textures = new Map<string, CanvasTexture>();
const C = {
  ink: "#17232e",
  deep: "#263342",
  stone: "#354956",
  slate: "#526b7a",
  tealDark: "#285760",
  teal: "#458c8b",
  mint: "#88d2bb",
  amberDark: "#b06e3f",
  amber: "#f4b45b",
  light: "#ffe0a0",
  skin: "#d7a47e",
  skinLight: "#f2c59a",
  roseDark: "#843f56",
  rose: "#e56e77",
  paleRose: "#f7b9a9",
  violetDark: "#443e68",
  violet: "#8274b1",
  lavender: "#c3a8e8",
  greenDark: "#3f634f",
  green: "#85b96e",
  lime: "#d0df8f",
};

type PixelContext = CanvasRenderingContext2D;
const rect = (
  g: PixelContext,
  c: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
) => {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
};

function canvasTexture(
  width: number,
  height: number,
  paint: (g: PixelContext) => void,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Devungeon pixel art needs a 2D canvas context.");
  g.imageSmoothingEnabled = false;
  paint(g);
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.name = "Devungeon original pixel art";
  return texture;
}

function boots(g: PixelContext, step: number, color = C.slate) {
  const left = step === 1 ? 1 : 0;
  const right = step === 3 ? 1 : 0;
  rect(g, C.ink, 4, 19, 4, 4 - left);
  rect(g, C.ink, 9, 19, 4, 4 - right);
  rect(g, color, 5, 19, 2, 2 - left);
  rect(g, color, 10, 19, 2, 2 - right);
  rect(g, C.deep, 4, 22 - left, 4);
  rect(g, C.deep, 9, 22 - right, 4);
}

function personBody(
  g: PixelContext,
  step: number,
  facing: SpriteFacing,
  primary: string,
  highlight: string,
  dark: string,
) {
  boots(g, step);
  const bob = step === 1 || step === 3 ? 1 : 0;
  g.translate(0, bob);
  // Small, heavy feet and broad shoulders keep the silhouette readable.
  rect(g, C.ink, 4, 11, 9, 9);
  rect(g, primary, 5, 12, 7, 7);
  rect(g, dark, 5, 17, 7, 2);
  rect(g, highlight, 5, 12, 3, 2);
  rect(g, C.ink, 3, 12, 2, 6);
  rect(g, primary, 3, 13, 2, 3);
  rect(g, C.skin, 3, 16, 2, 2);
  rect(g, C.ink, 12, 12, 2, 6);
  rect(g, dark, 12, 13, 2, 3);
  rect(g, C.skin, 12, 16, 2, 2);
  rect(g, C.amberDark, 5, 17, 7);
  rect(g, C.amber, 8, 17, 2);
  if (facing === "back") {
    rect(g, dark, 6, 13, 5, 4);
    rect(g, primary, 7, 13, 3, 5);
  } else {
    rect(g, dark, 8, 14, 1, 3);
  }
}

function face(
  g: PixelContext,
  facing: SpriteFacing,
  helmet: string,
  light: string,
) {
  // Helmet: a split crest, distinctive asymmetrical bronze temple rivet.
  rect(g, C.ink, 5, 4, 7, 8);
  rect(g, C.ink, 4, 6, 9, 5);
  rect(g, helmet, 5, 5, 7, 5);
  rect(g, light, 6, 5, 4);
  rect(g, helmet, 4, 7, 2, 3);
  rect(g, C.tealDark, 11, 6, 2, 4);
  rect(g, C.amber, 11, 7);
  if (facing === "back") {
    rect(g, light, 6, 6, 1, 4);
    rect(g, C.deep, 6, 10, 5);
    rect(g, C.tealDark, 7, 7, 4, 3);
  } else if (facing === "left" || facing === "right") {
    rect(g, C.skin, 9, 8, 4, 3);
    rect(g, C.skinLight, 11, 8, 2, 2);
    rect(g, C.ink, 11, 8);
    rect(g, C.deep, 5, 10, 4);
  } else {
    rect(g, C.skin, 6, 8, 5, 3);
    rect(g, C.skinLight, 7, 8, 3, 2);
    rect(g, C.ink, 6, 8);
    rect(g, C.ink, 10, 8);
    rect(g, C.amberDark, 8, 10, 2);
  }
}

function hero(g: PixelContext, frame: number, facing: SpriteFacing) {
  personBody(g, frame, facing, C.teal, C.mint, C.tealDark);
  face(g, facing, C.teal, C.mint);
  // Amber neck wrap trails to the side; back view has the wrap's knot.
  rect(g, C.ink, 4, 10, 8, 3);
  rect(g, C.amber, 5, 11, 6);
  rect(g, C.amberDark, 6, 12, 4);
  rect(g, C.amber, 3, 12, 3, 3);
  rect(g, C.light, 3, 12, 2);
  if (frame === 1 || frame === 3) rect(g, C.amber, 2, 13, 2, 2);
  // Short straight steel blade, always attached to the right hand.
  if (facing !== "back") {
    const lift = frame === 3 ? 3 : 0;
    rect(g, C.ink, 13, 11 - lift, 2, 8);
    rect(g, C.mint, 14, 11 - lift, 1, 5);
    rect(g, C.light, 14, 11 - lift);
    rect(g, C.amber, 12, 16 - lift, 4);
    rect(g, C.amberDark, 14, 17 - lift, 1, 2);
  } else {
    rect(g, C.ink, 5, 13, 2, 6);
    rect(g, C.slate, 6, 13, 1, 5);
  }
}

function wizard(g: PixelContext, frame: number, facing: SpriteFacing) {
  personBody(g, frame, facing, C.violet, C.lavender, C.violetDark);
  // A square-cut hood and drooping pointed cap distinguish the caster.
  rect(g, C.ink, 5, 5, 7, 8);
  rect(g, C.violet, 5, 5, 7, 6);
  rect(g, C.violetDark, 4, 7, 2, 5);
  rect(g, C.violetDark, 11, 7, 2, 5);
  rect(g, C.ink, 3, 6, 11, 2);
  rect(g, C.ink, 5, 4, 7, 3);
  rect(g, C.ink, 6, 2, 5, 3);
  rect(g, C.ink, 9, 1, 3, 3);
  rect(g, C.violet, 6, 4, 5, 3);
  rect(g, C.violet, 7, 3, 3);
  rect(g, C.violet, 9, 2, 2);
  rect(g, C.lavender, 7, 4, 2);
  rect(g, C.amber, 4, 6, 9);
  if (facing !== "back") {
    rect(g, C.deep, 6, 8, 5, 3);
    rect(g, C.mint, facing === "front" ? 6 : 9, 8);
    rect(g, C.mint, 10, 8);
  }
  rect(g, C.violetDark, 4, 17, 9, 4);
  rect(g, C.lavender, 5, 18, 1, 2);
  // Tuning-fork wand with a small floating ember.
  rect(g, C.ink, 1, 9, 2, 12);
  rect(g, C.amberDark, 2, 11, 1, 9);
  rect(g, C.lavender, 1, 9, 3, 2);
  rect(g, C.mint, 2, 6 - (frame % 2), 2, 2);
  rect(g, C.light, 2, 6 - (frame % 2));
}

function builder(g: PixelContext, frame: number, facing: SpriteFacing) {
  personBody(g, frame, facing, C.slate, C.mint, C.tealDark);
  face(g, facing, C.slate, C.mint);
  // Cyan work apron, single brass fastener, broad flat cap.
  rect(g, C.ink, 4, 5, 9, 3);
  rect(g, C.mint, 5, 5, 7);
  rect(g, C.teal, 4, 6, 9);
  rect(g, C.tealDark, 6, 13, 5, 6);
  rect(g, C.teal, 7, 13, 3, 4);
  rect(g, C.amber, 8, 14);
  rect(g, C.ink, 13, 13 - (frame === 3 ? 4 : 0), 2, 8);
  rect(g, C.amberDark, 14, 14 - (frame === 3 ? 4 : 0), 1, 6);
  rect(g, C.ink, 11, 12 - (frame === 3 ? 4 : 0), 5, 3);
  rect(g, C.mint, 12, 12 - (frame === 3 ? 4 : 0), 4);
  rect(g, C.slate, 12, 13 - (frame === 3 ? 4 : 0), 4);
}

function scout(g: PixelContext, frame: number, facing: SpriteFacing) {
  personBody(g, frame, facing, C.green, C.lime, C.greenDark);
  face(g, facing, C.green, C.lime);
  rect(g, C.greenDark, 4, 5, 9, 3);
  rect(g, C.green, 5, 4, 7, 3);
  rect(g, C.lime, 5, 5, 6);
  rect(g, C.ink, 11, 2, 2, 4);
  rect(g, C.lime, 12, 2, 1, 3);
  if (facing === "back") {
    rect(g, C.ink, 6, 13, 6, 5);
    rect(g, C.amberDark, 7, 13, 4, 4);
    rect(g, C.amber, 8, 14, 2);
  } else {
    rect(g, C.amberDark, 5, 13, 1, 2);
    rect(g, C.amberDark, 6, 15, 1, 2);
    rect(g, C.amberDark, 7, 17);
  }
  rect(g, C.ink, 13, 15, 3, 5);
  rect(g, C.amberDark, 14, 16, 2, 3);
  rect(g, C.lime, 14, 16);
}

function slime(g: PixelContext, frame: number) {
  const rise = frame === 1 || frame === 3 ? 1 : 0;
  const width = frame === 2 ? 1 : 0;
  rect(g, C.ink, 3 - width, 14 - rise, 10 + width * 2, 8 + rise);
  rect(g, C.ink, 5, 12 - rise, 6, 2);
  rect(g, C.greenDark, 3 - width, 16 - rise, 10 + width * 2, 5 + rise);
  rect(g, C.green, 4 - width, 14 - rise, 8 + width * 2, 6 + rise);
  rect(g, C.lime, 5, 13 - rise, 5, 2);
  rect(g, C.lime, 4, 15 - rise, 2, 3);
  rect(g, C.greenDark, 5, 20, 7);
  rect(g, C.ink, 5, 17 - rise, 2, 2);
  rect(g, C.ink, 10, 17 - rise, 2, 2);
  rect(g, C.light, 5, 17 - rise);
  rect(g, C.light, 10, 17 - rise);
  rect(g, C.roseDark, 8, 19 - rise, 2);
  rect(g, C.paleRose, 3, 19 - rise, 2);
  rect(g, C.paleRose, 12, 19 - rise);
  // A little broken copper crown: these are forge-ooze, not generic blobs.
  rect(g, C.amberDark, 6, 11 - rise, 4);
  rect(g, C.amber, 6, 10 - rise);
  rect(g, C.amber, 9, 10 - rise);
}

function sentinel(g: PixelContext, frame: number, facing: SpriteFacing) {
  boots(g, frame, C.roseDark);
  const bob = frame % 2;
  g.translate(0, bob);
  rect(g, C.ink, 3, 10, 11, 9);
  rect(g, C.roseDark, 4, 11, 9, 7);
  rect(g, C.rose, 4, 11, 4, 6);
  rect(g, C.paleRose, 4, 11, 3);
  rect(g, C.ink, 2, 11, 3, 5);
  rect(g, C.rose, 2, 11, 3, 2);
  rect(g, C.ink, 12, 11, 3, 5);
  rect(g, C.roseDark, 12, 11, 3, 2);
  rect(g, C.ink, 5, 5, 7, 7);
  rect(g, C.paleRose, 5, 5, 7, 5);
  rect(g, C.roseDark, 5, 9, 7, 2);
  rect(g, C.ink, 4, 3, 2, 4);
  rect(g, C.ink, 11, 3, 2, 4);
  rect(g, C.amber, 4, 3, 1, 3);
  rect(g, C.amber, 12, 3, 1, 3);
  if (facing !== "back") {
    rect(g, C.ink, 6, 7, 5, 2);
    rect(g, C.amber, facing === "front" ? 6 : 9, 7);
    rect(g, C.amber, 10, 7);
  } else rect(g, C.rose, 7, 6, 3, 3);
  rect(g, C.ink, 7, 13, 3, 3);
  rect(g, C.amber, 8, 13, 1, 2);
  // The sentinel's heavy one-sided gauntlet.
  rect(g, C.ink, 12, 15 - (frame === 3 ? 3 : 0), 4, 5);
  rect(g, C.slate, 13, 15 - (frame === 3 ? 3 : 0), 3, 3);
  rect(g, C.paleRose, 13, 15 - (frame === 3 ? 3 : 0), 2);
}

function flame(g: PixelContext, frame: number) {
  const flick = (frame % 3) - 1;
  rect(g, C.ink, 6, 17, 5, 6);
  rect(g, C.amberDark, 7, 17, 3, 5);
  rect(g, C.deep, 4, 17, 9, 2);
  rect(g, C.roseDark, 5, 12, 7, 5);
  rect(g, C.amberDark, 6, 8, 5, 8);
  rect(g, C.amber, 6, 10, 5, 6);
  rect(g, C.amber, 8 + flick, 6, 2, 6);
  rect(g, C.rose, 5, 12, 2, 3);
  rect(g, C.light, 7, 12, 3, 4);
  rect(g, C.light, 8, 10 + (frame % 2), 2, 4);
  if (frame === 1) rect(g, C.amber, 5, 5);
  if (frame === 3) rect(g, C.amber, 11, 3);
}

function chest(g: PixelContext, frame: number) {
  rect(g, C.ink, 2, 12, 12, 10);
  rect(g, C.ink, 3, 10, 10, 4);
  rect(g, C.amberDark, 3, 12, 10, 8);
  rect(g, "#754b3b", 4, 17, 8, 3);
  rect(g, C.amber, 4, 11, 8, 2);
  rect(g, C.amber, 3, 14, 10);
  rect(g, C.amber, 4, 15, 1, 5);
  rect(g, C.amber, 11, 15, 1, 5);
  rect(g, C.ink, 7, 14, 3, 4);
  rect(g, C.light, 8, 14, 1, 2);
  if (frame > 1) {
    rect(g, C.ink, 3, 13, 10, 2);
    rect(g, C.light, 5, 13, 6);
    rect(g, C.amber, 7, 7 - frame, 1, 3);
    rect(g, C.light, 6, 8 - frame, 3);
  }
}

/** 16×24px transparent sprite. Display at 1×1.5 world units for 16px/unit. */
export function spriteTexture(
  kind: SpriteKind,
  frame = 0,
  facing: SpriteFacing = "front",
): CanvasTexture {
  const f = ((Math.floor(frame) % 4) + 4) % 4;
  const key = `${kind}:${f}:${facing}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const texture = canvasTexture(16, 24, (g) => {
    if (facing === "left") {
      g.translate(16, 0);
      g.scale(-1, 1);
    }
    if (kind === "hero") hero(g, f, facing);
    else if (kind === "wizard") wizard(g, f, facing);
    else if (kind === "builder") builder(g, f, facing);
    else if (kind === "scout") scout(g, f, facing);
    else if (kind === "sentinel") sentinel(g, f, facing);
    else if (kind === "slime") slime(g, f);
    else if (kind === "flame") flame(g, f);
    else chest(g, f);
  });
  texture.name = `Devungeon ${key}`;
  textures.set(key, texture);
  return texture;
}

/** 16×16px tile. Repeat/magnify only with nearest sampling. */
export function tileTexture(kind: TileKind): CanvasTexture {
  const key = `tile:${kind}`;
  const cached = textures.get(key);
  if (cached) return cached;
  const texture = canvasTexture(16, 16, (g) => {
    if (kind === "wall") {
      rect(g, C.deep, 0, 0, 16, 16);
      rect(g, C.slate, 1, 1, 14, 6);
      rect(g, C.stone, 1, 2, 14, 5);
      rect(g, "#68808a", 2, 1, 10);
      rect(g, C.slate, 0, 9, 7, 6);
      rect(g, C.stone, 0, 10, 7, 5);
      rect(g, C.slate, 9, 9, 7, 6);
      rect(g, C.stone, 9, 10, 7, 5);
      rect(g, "#68808a", 10, 9, 5);
      rect(g, C.deep, 12, 4, 2);
      rect(g, C.deep, 11, 5);
    } else if (kind === "trim") {
      rect(g, C.ink, 0, 0, 16, 16);
      rect(g, C.tealDark, 1, 1, 14, 14);
      rect(g, C.teal, 2, 2, 12);
      rect(g, C.deep, 2, 3, 12, 11);
      rect(g, C.tealDark, 4, 5, 8, 6);
      rect(g, C.mint, 7, 5, 2, 6);
      rect(g, C.mint, 5, 7, 6, 2);
      rect(g, C.teal, 7, 7, 2, 2);
    } else if (kind === "locked") {
      rect(g, C.ink, 0, 0, 16, 16);
      rect(g, "#302e45", 1, 1, 14, 14);
      rect(g, C.violetDark, 2, 2, 12);
      rect(g, C.violetDark, 2, 13, 12);
      rect(g, C.violetDark, 2, 3, 1, 10);
      rect(g, C.violetDark, 13, 3, 1, 10);
      rect(g, C.violet, 6, 5, 4);
      rect(g, C.violet, 5, 6, 1, 4);
      rect(g, C.violet, 10, 6, 1, 4);
      rect(g, C.lavender, 6, 10, 4);
      rect(g, C.lavender, 7, 7, 2, 2);
    } else {
      rect(g, "#2e3c49", 0, 0, 16, 16);
      rect(g, "#354551", 1, 1, 14, 14);
      rect(g, "#3c4e59", 1, 1, 14);
      rect(g, "#3c4e59", 1, 2, 1, 13);
      rect(g, "#293743", 3, 14, 12);
      rect(g, "#293743", 14, 3, 1, 11);
      rect(g, "#40535e", 4, 4, 3);
      rect(g, "#2e3c49", 10, 8, 2);
      rect(g, "#2e3c49", 11, 9, 1, 2);
      rect(g, "#40535e", 5, 11);
    }
  });
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.name = `Devungeon ${key}`;
  textures.set(key, texture);
  return texture;
}

/** Call only when the entire renderer is being permanently torn down. */
export function disposeArtTextures(): void {
  for (const texture of textures.values()) texture.dispose();
  textures.clear();
}
