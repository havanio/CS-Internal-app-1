import { getStore } from "@netlify/blobs";

const isAuthed = (req) =>
  Boolean(process.env.CMS_PASSWORD) &&
  req.headers.get("x-cms-password") === process.env.CMS_PASSWORD;

const normalizeDateValue = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeItemDates = (item) => ({
  ...item,
  startDate: normalizeDateValue(item?.startDate),
  endDate: normalizeDateValue(item?.endDate),
});

export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "method not allowed" },
        { status: 405 }
      );
    }

    if (!isAuthed(req)) {
      return Response.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    if (!Array.isArray(body.items)) {
      return Response.json(
        { ok: false, error: "items must be an array" },
        { status: 400 }
      );
    }

    const data = {
      items: body.items.map(normalizeItemDates),
      updatedAt: new Date().toISOString()
    };
    await getStore("cms").setJSON("content", data);

    return Response.json({
      ok: true,
      count: data.items.length,
      updatedAt: data.updatedAt,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/save" };
