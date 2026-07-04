# Mini Admin CMS on Netlify — Design & Contract

**Date:** 2026-07-03
**Goal:** Replace Google Sheet with a self-contained CMS on Netlify (Functions + Blobs) so the CS team can manage all content + images through an admin UI, with instant updates and no git/redeploy per change.

## Decisions (from brainstorming)

| # | Decision |
|---|---|
| 1 | Approach: **Netlify Blobs + Functions** (Netlify is backend + database + image store). No Google Sheet at runtime. |
| 2 | Scope: **full content + images** — CMS manages every record type (script / promotion / store / menu / note) and image uploads. |
| 3 | Auth: **single shared password** in env var `CMS_PASSWORD`, checked by write functions. |
| 4 | Images: **one source going forward = Blobs via CMS.** Existing images stay in place (repo `images/`, jsDelivr, Drive) so nothing breaks; missing/updated ones are re-uploaded manually through the CMS. No automated image migration. |
| 5 | Admin UI shares the **same visual tone** as the public app (reuse `style.css` palette). |
| 6 | Data migration: one-time **records only** via `scripts/build-seed.mjs` → `content.seed.json`, auto-seeded into Blobs on first `/api/data` read. |

## Item shape (stored in Blobs, served as-is to the app)

```jsonc
{
  "id": "string (slug)",
  "type": "script | promotion | store | menu | note",
  "brand": "TUTIMI | SEKAI | ...",
  "title": "string",
  "category": "string?",
  "content": "string?",
  "phone": "string?", "managerName": "string?", "managerPhone": "string?",
  "storePhone1": "string?", "storePhone2": "string?",
  "address": "string?", "hours": "string?", "notes": "string?",
  "startDate": "YYYY-MM-DD?", "endDate": "YYYY-MM-DD?",
  "imageUrl": "string? (/api/img/<key> | external URL | images/x.jpg)",
  "imageLabel": "string?",
  "updatedAt": "ISO string?",
  "tags": ["string"], "channels": ["string"]
}
```

## Blobs layout

- Store `cms`, key `content` → `{ items: Item[], updatedAt: string }`
- Store `images`, key `<imgKey>` → binary; metadata `{ contentType, filename, uploadedAt }`

## API (Netlify Functions v2 — each file sets `export const config = { path }`)

| # | File | Path | Method | Auth | Behavior |
|---|---|---|---|---|---|
| 1 | `data.mjs` | `/api/data` | GET | no | Return `content`; if empty, seed from bundled `content.seed.json` and persist. |
| 2 | `img.mjs` | `/api/img/:key` | GET | no | Stream image bytes from `images` store with its `Content-Type`, `Cache-Control: public, max-age=31536000, immutable`. 404 if absent. |
| 3 | `save.mjs` | `/api/save` | POST | yes | Body `{ items }`; overwrite `content` with `{ items, updatedAt }`. |
| 4 | `upload.mjs` | `/api/upload` | POST | yes | `multipart/form-data` field `file`; validate `image/*` ≤ 10MB; store; return `{ url: "/api/img/<key>", key }`. |
| 5 | `login.mjs` | `/api/login` | POST | — | Body `{ password }`; 200 `{ ok:true }` if matches `CMS_PASSWORD`, else 401. |

**Auth:** request header `x-cms-password` must equal `process.env.CMS_PASSWORD` (401 otherwise). Admin stores the password in `sessionStorage` after `/api/login` and sends it on every write.

## Components

| # | Path | New/Edit | Purpose |
|---|---|---|---|
| 1 | `netlify/functions/*.mjs` | new | 5 functions above |
| 2 | `netlify/functions/content.seed.json` | generated | seed records (from Sheet) |
| 3 | `admin/index.html` + `admin.js` + `admin.css` | new | CMS UI (login → list/filter → CRUD form → image upload) |
| 4 | `script.js` | edit | data source Google Sheet → `/api/data` (UI unchanged) |
| 5 | `netlify.toml`, `package.json`, `.gitignore` | edit | functions dir, deps, ignores |
| 6 | `scripts/build-seed.mjs` | new | one-time Sheet → seed JSON |

## Error handling

- Functions: 401 (bad password), 400 (bad input / non-image / too big), 404 (missing image), 500 (server). Admin surfaces errors via toast.
- App: `/api/data` failure → fall back to existing `localStorage` cache (logic already present).

## Verification

- Local: `npm install`, `netlify dev` (runs Functions + local Blobs sandbox, no account needed).
- Browser-verify with Playwright: admin login → add item → upload image → save → public app shows the new item + image.
- Deploy is a **separate, gated** step (needs the Netlify site/account + `CMS_PASSWORD` env): test context first → confirm → prod.

## Out of scope (YAGNI for v1)

Per-item API, multi-user accounts/audit, image migration off legacy sources, orphaned-image cleanup, rich text. Revisit if needed.
