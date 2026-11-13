import { copyFile, mkdir } from 'node:fs/promises';
// The root schemas remain canonical. Never maintain a second handwritten schema.
const target = new URL('../src/schema/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['project-snapshot', 'world-blueprint']) {
  await copyFile(new URL(`../../../schema/${name}.schema.json`, import.meta.url), new URL(`${name}.json`, target));
}
