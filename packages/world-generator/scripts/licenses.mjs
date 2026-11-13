import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../node_modules/', import.meta.url);
const rows = [];
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    if (!item.isDirectory() || item.name.startsWith('.')) continue;
    const path = new URL(item.name + '/', dir);
    if (item.name.startsWith('@')) { await walk(path); continue; }
    try {
      const p = JSON.parse(await readFile(new URL('package.json', path), 'utf8'));
      const files = await readdir(path);
      let licenseFile = files.find(n => /^licen[sc]e(?:\..*)?$/i.test(n));
      let licensePath = licenseFile ? `${p.name}/${licenseFile}` : undefined;
      // Rolldown publishes platform bindings without a duplicated license file.
      // Their manifest points to the same repository/directory as the exact-version
      // parent package, whose license and transitive notice are installed alongside.
      if (!licensePath && p.name.startsWith('@rolldown/binding-')) {
        const parent = JSON.parse(await readFile(new URL('rolldown/package.json', root), 'utf8'));
        if (parent.version === p.version && parent.license === p.license) licensePath = 'rolldown/LICENSE';
      }
      if (!p.license || !licensePath) throw Error(`Missing license metadata/text: ${p.name}`);
      await readFile(new URL(licensePath, root), 'utf8');
      rows.push({ package: p.name, version: p.version, license: p.license, license_file: licensePath });
    } catch (error) { throw new Error(`License inspection failed for ${path}: ${error.message}`); }
  }
}
await walk(root);
rows.sort((a, b) => a.package < b.package ? -1 : a.package > b.package ? 1 : 0);
const result = { scope: 'Exact installed Windows x64 dependency tree, including dev tooling. Lockfile optional binaries for other OSes retain their upstream licenses.', packages: rows };
await writeFile(new URL('../docs/DEPENDENCY_LICENSES.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
// Runtime redistribution notice contains exact upstream text, not paraphrases.
const runtime = ['rot-js', 'ajv', 'ajv-formats', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string'];
let notices = '# Third-party runtime notices\n\nGenerated from the exact locked packages by `npm run licenses`. Dev dependencies\nretain their own package notices and are listed in docs/DEPENDENCY_LICENSES.json.\nVite includes bundled transitive notices in its LICENSE.md. No art/audio imported.\n';
for (const name of runtime) {
  const row = rows.find(p => p.package === name); if (!row) throw Error(`Runtime package missing: ${name}`);
  notices += `\n## ${name} ${row.version} — ${row.license}\n\nSource: https://www.npmjs.com/package/${name}/v/${row.version}\n\n\`\`\`text\n${(await readFile(new URL(row.license_file, root), 'utf8')).replace(/[ \t]+$/gm, '').trim()}\n\`\`\`\n`;
}
await writeFile(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), notices);
console.log(`Inspected ${rows.length} installed packages; all have license metadata and license text.`);
console.log([...new Set(rows.map(p => p.license))].sort().join(', '));
