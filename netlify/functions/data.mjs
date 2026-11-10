import { getStore } from "@netlify/blobs";
import policies from "./after-sales.json" with { type: "json" };
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

    // Add approved policies only when the ID is absent. Existing CMS records,
    // including archived records, always win. Deployment never rewrites storage.
    const ids = new Set(data.items.map(item => item.id));
    const result = { ...data, items: [...data.items, ...policies.items.filter(item => !ids.has(item.id))] };
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/data" };
