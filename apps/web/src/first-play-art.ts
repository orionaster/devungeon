/** Ninja Adventure (Pixel-Boy + AAA), CC0. Sample-only skin.
 * Exact unmodified bytes and frame recipes: public/assets/first-play/manifest.json.
 * Art is cropped from licensed PNGs; legacy source-painted art is not used here. */
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace } from "three";
import type { SpriteFacing, SpriteKind, TileKind } from "./art";

export type FirstPlayPose = "idle" | "move" | "attack" | "dodge" | "hurt" | "dead";
const BASE = "/assets/first-play/";
const images = new Map<string, Promise<HTMLImageElement>>();
const textures = new Map<string, CanvasTexture>();

function image(name: string) {
  let pending = images.get(name);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load licensed sample art: ${name}`));
      img.src = BASE + name + ".png";
    });
    images.set(name, pending);
  }
  return pending;
}

/** Native pixel crop with a stable canvas/texture identity during asynchronous load. */
export function firstPlayCrop(name: string, x: number, y: number, width: number, height: number): CanvasTexture {
  const key = `${name}:${x}:${y}:${width}:${height}`;
  let texture = textures.get(key);
  if (texture) return texture;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.name = `Ninja Adventure CC0 / ${key}`;
  textures.set(key, texture);
  const target = texture;
  void image(name).then((img) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    target.needsUpdate = true;
  }).catch((error: unknown) => {
    // Host preload surfaces the failure and keeps Start disabled. Texture ports
    // must still never leave an unhandled async rejection on a missing asset.
    target.userData.loadError = error instanceof Error ? error.message : String(error);
  });
  return texture;
}

const facingColumn: Record<SpriteFacing, number> = { front: 0, left: 1, back: 2, right: 3 };
const heroPose: Record<FirstPlayPose, string> = { idle: "idle", move: "walk", attack: "attack", dodge: "roll", hurt: "hit", dead: "dead" };

function sprite(kind: SpriteKind, frame = 0, facing: SpriteFacing = "front", pose: FirstPlayPose = "idle") {
  const direction = facingColumn[facing];
  if (kind === "hero") {
    const count = pose === "dodge" ? 3 : pose === "hurt" || pose === "dead" ? 2 : 4;
    // Every ordinary frame has the same foot baseline y=24. The transparent
    // bottom eight pixels are removed, so center=[.5,0] sits on collision feet.
    const row = pose === "dodge" ? Math.min(frame, count - 1) : frame % count;
    return firstPlayCrop(`hero-${heroPose[pose]}`, pose === "dead" ? 0 : direction * 32, row * 32, 32, 24);
  }
  if (kind === "scout" || kind === "builder" || kind === "wizard") {
    if (pose === "attack") return firstPlayCrop("guide-attack", direction * 16, 0, 16, 16);
    return pose === "move"
      ? firstPlayCrop("guide-walk", direction * 16, (frame % 4) * 16, 16, 16)
      : firstPlayCrop("guide-idle", direction * 16, 0, 16, 16);
  }
  if (kind === "slime" || kind === "sentinel") return firstPlayCrop(kind === "slime" ? "slime" : "slime-red", (frame % 4) * 16, 0, 16, 16);
  if (kind === "chest") return firstPlayCrop("chest", 0, 0, 16, 14);
  return firstPlayCrop("flame", (frame % 8) * 12, 0, 12, 12);
}

function tile(kind: TileKind) {
  if (kind === "wall") return firstPlayCrop("interior-floor", 192, 208, 16, 16);
  if (kind === "trim") return firstPlayCrop("interior-wall", 16, 96, 16, 16);
  if (kind === "locked") return firstPlayCrop("interior-floor", 192, 112, 16, 16);
  return firstPlayCrop("interior-floor", 208, 208, 16, 16);
}

export const firstPlayVisuals = {
  sprite,
  tile,
  size(kind: SpriteKind): [number, number] {
    if (kind === "hero") return [2.2, 1.65];
    if (kind === "chest") return [1.05, 0.91875];
    if (kind === "flame") return [0.5, 0.5];
    return [1.1, 1.1];
  },
  hideBaseEnvironment: true,
  hideLegacyDecorations: true,
};

/** Optional verification/loading port: does not touch gameplay or source state. */
export function loadFirstPlayArt() {
  return Promise.all(["hero-idle", "hero-walk", "hero-attack", "hero-roll", "hero-hit", "hero-dead", "guide-idle", "guide-walk", "guide-attack", "slime", "slime-red", "interior-floor", "interior-wall", "furniture", "dungeon", "chest", "book", "scroll", "gem", "flame"].map(image));
}
