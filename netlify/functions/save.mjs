import { getStore } from "@netlify/blobs";

const isAuthed = (req) =>
  Boolean(process.env.CMS_PASSWORD) &&
  req.headers.get("x-cms-password") === process.env.CMS_PASSWORD;

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

    const data = { items: body.items, updatedAt: new Date().toISOString() };
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
