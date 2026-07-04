export default async (req, context) => {
  try {
    if (req.method !== "POST") {
      return Response.json(
        { ok: false, error: "method not allowed" },
        { status: 405 }
      );
    }

    const { password } = await req.json().catch(() => ({}));

    if (process.env.CMS_PASSWORD && password === process.env.CMS_PASSWORD) {
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false }, { status: 401 });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
};

export const config = { path: "/api/login" };
