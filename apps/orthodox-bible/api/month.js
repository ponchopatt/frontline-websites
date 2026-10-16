// A month of the Orthodox calendar from orthocal.info, cut down to what the calendar grid shows.
// GET /api/month?y=2026&m=10&cal=new|old
export default async function handler(req, res) {
  const y = Number(req.query.y), m = Number(req.query.m);
  const cal = req.query.cal === "old" ? "julian" : "gregorian";
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12)) return res.status(400).json({ error: "y and m are needed" });
  try {
    const r = await fetch(`https://orthocal.info/api/${cal}/${y}/${m}/`, { headers: { "User-Agent": "OrthodoxBible/1.0" } });
    if (!r.ok) return res.status(502).json({ error: "calendar unavailable" });
    const days = (await r.json()).map((o, i) => ({
      d: i + 1, title: o.summary_title || (o.titles || [])[0] || "", feastLevel: o.feast_level || 0,
      fast: o.fast_level_desc || "", fastLevel: o.fast_level || 0, fastException: o.fast_exception_desc || "",
      saints: (o.saints || []).slice(0, 3), pd: o.pascha_distance,
    }));
    res.setHeader("Cache-Control", "public, s-maxage=604800, stale-while-revalidate=2592000");
    return res.status(200).json({ y, m, cal: req.query.cal === "old" ? "old" : "new", days });
  } catch (e) {
    return res.status(502).json({ error: "calendar unavailable" });
  }
}
