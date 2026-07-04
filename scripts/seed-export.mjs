// Export a live site's content + images from Netlify Blobs into a portable
// ./seed bundle so the whole dataset travels WITH the source code and can be
// re-imported into any other Netlify project.
//
//   Produces:  seed/content.json      (135 items; image refs -> "seed:<file>")
//              seed/images/<file>...   (every image, downloaded from Blobs)
//
// Usage:  BASE=https://<your-site>.netlify.app node scripts/seed-export.mjs
//         (BASE defaults to the current production site)

import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "https://ttmi-cs-internal.netlify.app";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_DIR = resolve(ROOT, "seed");
const IMG_DIR = resolve(SEED_DIR, "images");

async function main() {
  const res = await fetch(`${BASE}/api/data`);
  if (!res.ok) throw new Error(`GET /api/data -> ${res.status}`);
  const data = await res.json();
  const items = data.items || [];

  await rm(SEED_DIR, { recursive: true, force: true });
  await mkdir(IMG_DIR, { recursive: true });

  const seen = new Map(); // "/api/img/<key>" -> "seed:<file>"
  let imgs = 0;
  for (const it of items) {
    const u = it.imageUrl;
    if (typeof u === "string" && u.startsWith("/api/img/")) {
      if (!seen.has(u)) {
        const file = u.split("/").pop();
        const r = await fetch(`${BASE}${u}`);
        if (!r.ok) { console.log(`  ⚠ skip ${u}: HTTP ${r.status}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        await writeFile(resolve(IMG_DIR, file), buf);
        seen.set(u, `seed:${file}`);
        imgs++;
        console.log(`  ↓ ${file} (${buf.length}b)`);
      }
      it.imageUrl = seen.get(u) || u;
    }
    // any non-Blob imageUrl (external/absolute) is left untouched — it is
    // already portable and will be written to the target verbatim.
  }

  await writeFile(
    resolve(SEED_DIR, "content.json"),
    `${JSON.stringify({ exportedFrom: BASE, count: items.length, items }, null, 2)}\n`
  );
  console.log(`\nEXPORTED ${items.length} items + ${imgs} images -> seed/`);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
