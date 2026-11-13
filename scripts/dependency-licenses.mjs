import fs from "node:fs";
import path from "node:path";
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const rows = [],
  notices = [
    "Devungeon S1 third-party notices. Generated from the exact npm lockfile and installed packages.",
    "Source game code/art: Apache-2.0. See repository LICENSE and NOTICE.",
    "",
  ];
for (const [key, p] of Object.entries(lock.packages)) {
  if (
    p.link ||
    !key.includes("node_modules/") ||
    !fs.existsSync(path.join(key, "package.json"))
  )
    continue;
  const manifest = JSON.parse(
    fs.readFileSync(path.join(key, "package.json"), "utf8"),
  );
  const license = manifest.license ?? p.license ?? "UNKNOWN";
  if (
    ![
      "MIT",
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC",
      "0BSD",
      "MPL-2.0",
    ].includes(license)
  )
    throw Error(`Review ${manifest.name}: ${license}`);
  rows.push({
    name: manifest.name,
    version: manifest.version,
    license,
    dev: !!p.dev,
    source:
      typeof manifest.repository === "string"
        ? manifest.repository
        : (manifest.repository?.url ?? manifest.homepage ?? ""),
  });
  notices.push(`${manifest.name}@${manifest.version} — ${license}`);
  const files = fs
    .readdirSync(key)
    .filter((f) => /^(license|licence|copying|notice)([.-]|$)/i.test(f));
  for (const file of files)
    if (fs.statSync(path.join(key, file)).isFile())
      notices.push(fs.readFileSync(path.join(key, file), "utf8"));
  if (!files.length)
    notices.push(
      `Package manifest declares ${license}. Upstream: ${rows.at(-1).source}. The full Apache-2.0 license is included with Devungeon for Apache-licensed packages.`,
    );
  notices.push("\n" + "=".repeat(72) + "\n");
}
rows.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(
  "docs/HERO_LICENSES.json",
  JSON.stringify(
    { lockfileVersion: lock.lockfileVersion, packages: rows },
    null,
    2,
  ) + "\n",
);
fs.mkdirSync("apps/web/public", { recursive: true });
fs.writeFileSync(
  "apps/web/public/THIRD_PARTY_NOTICES.txt",
  notices
    .join("\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trimEnd() + "\n",
);
console.log(
  `Reviewed ${rows.length} installed dependency manifests; compatible licenses only. Platform-optional packages absent on this host remain in lockfile.`,
);
