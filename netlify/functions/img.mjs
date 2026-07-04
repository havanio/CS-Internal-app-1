import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  try {
    const key =
      context.params?.key || new URL(req.url).pathname.split("/").pop();

    const store = getStore("images");
    const res = await store.getWithMetadata(key, { type: "arrayBuffer" });

    if (!res) {
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response(res.data, {
      headers: {
        "Content-Type": res.metadata?.contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/img/:key" };
