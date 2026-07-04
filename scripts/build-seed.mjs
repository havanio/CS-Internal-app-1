// One-time migration: read the current Google Sheet and produce the seed data
// (netlify/functions/content.seed.json) that /api/data uses to bootstrap the
// Netlify Blobs store on first read. Re-run any time to refresh the seed.
//
// Usage: node scripts/build-seed.mjs
//
// The CSV parsing + item shaping below is ported verbatim from script.js so the
// seed items land in the exact internal shape the app already expects.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHEET_ID = "1_brDqDzZl13Sn1YlU2wMnBNAywG86fEVQ4pN0qeLlPQ";
const SHEET_GID = "0";
const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../netlify/functions/content.seed.json"
);

// ---- helpers (ported from script.js) ---------------------------------------
function normalize(value) {
  return String(value || "").toLowerCase();
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeContentType(value) {
  const type = slugify(value);
  const aliases = {
    chatscript: "script",
    chatscripts: "script",
    scripts: "script",
    promos: "promotion",
    promotions: "promotion",
    stores: "store",
    locations: "store",
    menus: "menu"
  };

  return aliases[type.replace(/-/g, "")] || type || "script";
}

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];

    if (inQuotes) {
      if (char === '"') {
        if (csvText[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const knownHeaders = new Set([
    "id", "type", "brand", "category", "title", "content", "phone",
    "managername", "managerphone", "storephone1", "storephone2", "address",
    "hours", "notes", "startdate", "enddate", "channels", "tags", "imageurl",
    "imagelabel", "updatedat"
  ]);
  const [headers = [], ...records] = rows;
  const normalizedHeaders = headers.map((header) => {
    const normalized = slugify(header).replace(/-/g, "");
    const firstToken = slugify(String(header).trim().split(/\s+/)[0]).replace(/-/g, "");
    return knownHeaders.has(firstToken) ? firstToken : normalized;
  });

  return records
    .filter((record) => record.some((cellValue) => cellValue.trim()))
    .map((record) =>
      normalizedHeaders.reduce((entry, header, index) => {
        entry[header] = (record[index] || "").trim();
        return entry;
      }, {})
    );
}

function buildItemFromSheetRow(row, index) {
  const item = {
    id: slugify(row.id) || slugify(`${row.type}-${row.brand}-${row.title}`) || `sheet-item-${index + 1}`,
    type: normalizeContentType(row.type),
    brand: row.brand || "General",
    title: row.title || "Untitled",
    tags: splitList(row.tags)
  };

  [
    "category", "content", "phone", "managerName", "managerPhone",
    "storePhone1", "storePhone2", "address", "hours", "notes",
    "startDate", "endDate", "imageUrl", "imageLabel", "updatedAt"
  ].forEach((field) => {
    const key = field.toLowerCase();
    if (row[key]) item[field] = row[key];
  });

  const channels = splitList(row.channels);
  if (channels.length) item.channels = channels;

  return item;
}

// ---- main ------------------------------------------------------------------
async function main() {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;
  console.log("Fetching sheet:", url);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
  const text = await response.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error("Got HTML instead of CSV — check sheet sharing settings.");
  }

  const rows = parseCsv(text);
  const items = rows
    .map(buildItemFromSheetRow)
    .filter(
      (item) =>
        item.brand &&
        item.type &&
        (item.title !== "Untitled" || item.content || item.address || item.imageUrl)
    );

  if (!items.length) throw new Error("No usable rows parsed from sheet.");

  const byType = items.reduce((acc, it) => {
    acc[it.type] = (acc[it.type] || 0) + 1;
    return acc;
  }, {});

  const payload = {
    generatedAt: new Date().toISOString(),
    source: `google-sheet:${SHEET_ID}`,
    count: items.length,
    items
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  console.log(`Wrote ${items.length} items -> ${OUT_PATH}`);
  console.log("By type:", byType);
}

main().catch((error) => {
  console.error("build-seed failed:", error.message);
  process.exit(1);
});
