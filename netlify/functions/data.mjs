import { getStore } from "@netlify/blobs";
import seed from "./content.seed.json" with { type: "json" };

export default async (req, context) => {
  try {
    if (req.method !== "GET") {
      return Response.json(
        { ok: false, error: "method not allowed" },
        { status: 405 }
      );
    }

    const store = getStore("cms");
    let data = await store.get("content", { type: "json" });

    if (!data || !Array.isArray(data.items) || data.items.length === 0) {
      data = { items: seed.items, updatedAt: new Date().toISOString() };
      await store.setJSON("content", data);
    }

    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/data" };
