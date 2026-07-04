// Import the portable ./seed bundle into a Netlify project's Blobs: uploads every
// seed/images/* into the TARGET site's Blobs, then writes the content with the
// image refs rewritten to the new /api/img/<key> URLs.
//
// Run this AFTER the target site is deployed and CMS_PASSWORD is set on it.
//
// Usage:  BASE=https://<new-site>.netlify.app CMS_PASSWORD=<admin-pw> \
//           node scripts/seed-import.mjs
//         (or PWFILE=/path/to/pw instead of CMS_PASSWORD)

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE;
const PW = process.env.CMS_PASSWORD
  || (process.env.PWFILE ? (await readFile(process.env.PWFILE, "utf8")).trim() : "");
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = resolve(ROOT, "seed");
const IMG_DIR = resolve(SEED_DIR, "images");

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
};

async function main() {
  if (!BASE) throw new Error("Set BASE=<target site url> (e.g. https://your-site.netlify.app)");
  if (!PW) throw new Error("Set CMS_PASSWORD=<admin password> (or PWFILE=<file>)");

  const seed = JSON.parse(await readFile(resolve(SEED_DIR, "content.json"), "utf8"));
  const items = seed.items || [];

  const refs = [...new Set(
    items.map((i) => i.imageUrl).filter((u) => typeof u === "string" && u.startsWith("seed:"))
  )];
  console.log(`Target: ${BASE}\nImages to upload: ${refs.length}`);

  const map = {};
  for (const ref of refs) {
    const file = ref.slice("seed:".length);
    const path = resolve(IMG_DIR, file);
    if (!existsSync(path)) { console.log(`  ⚠ MISSING seed/images/${file}`); continue; }
    const buf = await readFile(path);
    const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type }), file);
    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST", headers: { "x-cms-password": PW }, body: fd,
    });
    const j = await res.json().catch(() => ({}));
    if (j.url) { map[ref] = j.url; console.log(`  ↑ ${file} -> ${j.url}`); }
    else console.log(`  ⚠ FAIL ${file}: HTTP ${res.status} ${JSON.stringify(j)}`);
  }

  for (const it of items) if (map[it.imageUrl]) it.imageUrl = map[it.imageUrl];

  const save = await fetch(`${BASE}/api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cms-password": PW },
    body: JSON.stringify({ items }),
  });
  const sj = await save.json().catch(() => ({}));
  if (!sj.ok) throw new Error(`/api/save failed: HTTP ${save.status} ${JSON.stringify(sj)}`);
  console.log(`\nIMPORTED ${items.length} items + ${Object.keys(map).length} images -> ${BASE}  ok=${sj.ok}`);
}

main().catch((e) => { console.error("ERR", e.message || e); process.exit(1); });
