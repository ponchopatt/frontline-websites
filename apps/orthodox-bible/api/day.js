// The Orthodox calendar for one day, from orthocal.info (MIT-licensed, follows OCA rubrics).
// GET /api/day?date=2026-10-16&cal=new|old
// orthocal.info doesn't allow calls straight from a browser, so this passes them on, keeps only
// what the app shows (no saints' stories, no Bible text: the app has its own), and caches a day
// at the edge so each date is asked for once.
export default async function handler(req, res) {
  const date = String(req.query.date || "");
  const cal = req.query.cal === "old" ? "julian" : "gregorian";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  const [y, m, d] = date.split("-").map(Number);
  try {
    const r = await fetch(`https://orthocal.info/api/${cal}/${y}/${m}/${d}/`, { headers: { "User-Agent": "OrthodoxBible/1.0" } });
    if (!r.ok) return res.status(502).json({ error: "calendar unavailable" });
    const o = await r.json();
    const readings = (o.readings || []).map((x) => ({
      source: x.source,
      desc: x.description || "",
      display: x.display,
      verses: (x.passage || []).map((p) => [p.book, p.chapter, p.verse]),
    }));
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).json({
      date, cal: req.query.cal === "old" ? "old" : "new",
      churchDate: `${o.year}-${String(o.month).padStart(2, "0")}-${String(o.day).padStart(2, "0")}`,
      titles: o.titles || [], summary: o.summary_title || "", feast: o.feast_level_description || "",
      feasts: o.feasts || [], saints: o.saints || [], tone: o.tone || 0,
      fast: o.fast_level_desc || "", fastLevel: o.fast_level || 0, fastException: o.fast_exception_desc || "",
      abstain: o.fast_abstentions || [], paschaDistance: o.pascha_distance, readings,
    });
  } catch (e) {
    return res.status(502).json({ error: "calendar unavailable" });
  }
}
