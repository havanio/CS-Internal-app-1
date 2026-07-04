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

    const form = await req.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      return Response.json({ ok: false, error: "no file" }, { status: 400 });
    }

    if (!file.type?.startsWith("image/")) {
      return Response.json(
        { ok: false, error: "unsupported type" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ ok: false, error: "too large" }, { status: 400 });
    }

    const ext =
      (file.name?.split(".").pop() || "bin")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 5) || "bin";
    const key = `img-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    await getStore("images").set(key, bytes, {
      metadata: {
        contentType: file.type,
        filename: file.name || key,
        uploadedAt: new Date().toISOString(),
      },
    });

    return Response.json({ ok: true, key, url: `/api/img/${key}` });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/upload" };
