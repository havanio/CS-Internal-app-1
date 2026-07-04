// One-shot: migrate every remaining relative-path image (images/...) referenced
// in the live data into Netlify Blobs via the CMS upload endpoint, then rewrite
// the imageUrl in both the live prod data and the committed seed to /api/img/<key>.
//
// Usage: PWFILE=/path/to/cms-pass.txt node scripts/migrate-images-to-blobs.mjs
//
// Reliable single-process replacement for the flaky bash+curl loop.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const BASE = process.env.BASE || "https://ttmi-cs-internal.netlify.app";
const SEED = "netlify/functions/content.seed.json";
const PW = (await readFile(process.env.PWFILE, "utf8")).trim();

const json = async (r) => {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { _raw: t.slice(0, 200), status: r.status }; }
};

async function main() {
  const data = await json(await fetch(`${BASE}/api/data`));
  const paths = [...new Set(
    data.items.map((i) => i.imageUrl).filter((u) => typeof u === "string" && u.startsWith("images/"))
  )];
  console.log(`to migrate: ${paths.length}`);

  const map = {};
  for (const p of paths) {
    const file = `public/${p}`;
    if (!existsSync(file)) { console.log(`  MISSING ${file}`); continue; }
    const buf = await readFile(file);
    const fd = new FormData();
    fd.append("file", new Blob([buf], { type: "image/jpeg" }), p.split("/").pop());
    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      headers: { "x-cms-password": PW },
      body: fd,
    });
    const j = await json(res);
    if (j.url) { map[p] = j.url; console.log(`  ${p} -> ${j.url}`); }
    else console.log(`  FAIL ${p}: ${JSON.stringify(j)}`);
  }

  // rewrite live prod data
  let ch = 0;
  for (const it of data.items) if (map[it.imageUrl]) { it.imageUrl = map[it.imageUrl]; ch++; }
  const save = await json(await fetch(`${BASE}/api/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cms-password": PW },
    body: JSON.stringify({ items: data.items }),
  }));
  console.log(`PROD_UPDATED ${ch} ok=${save.ok}`);

  // rewrite committed seed
  const seed = JSON.parse(await readFile(SEED, "utf8"));
  let sc = 0;
  for (const it of seed.items) if (map[it.imageUrl]) { it.imageUrl = map[it.imageUrl]; sc++; }
  await writeFile(SEED, `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`SEED_UPDATED ${sc}`);

  // verify nothing left outside Blobs
  const d2 = await json(await fetch(`${BASE}/api/data`));
  const rem = [...new Set(
    d2.items.map((i) => i.imageUrl).filter((u) => u && !String(u).startsWith("/api/img/"))
  )];
  console.log(`REMAINING_NON_BLOB ${JSON.stringify(rem)}`);
  console.log("MIGRATION_DONE");
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
