import { createHmac } from "node:crypto";
import M from "./model.js";

/*
  The ad spend from Meta (Facebook and Instagram ads), read only, with a token from
  META_ACCESS_TOKEN and the ad account(s) in META_AD_ACCOUNT_ID (the number after act= in Ads
  Manager's address; more than one, comma between). Meta gives each ad's spend a day at a time, in
  the ad account's time zone; it's added up into weeks, Monday to Sunday, as the app keeps them.
  If the Meta app asks for it, META_APP_SECRET signs each call (appsecret_proof). The token goes
  in the address, so addresses are never logged.
*/

const VERSION = () => process.env.META_API_VERSION || "v23.0";

export const accounts = () => String(process.env.META_AD_ACCOUNT_ID || "").split(",").map((s) => s.trim().replace(/^act_/, "")).filter((s) => /^\d+$/.test(s));
export const ready = () => !!process.env.META_ACCESS_TOKEN && accounts().length > 0;

/** Each ad's spend for each day from `since` to `until`: [{ day, ad, spend }]. */
export async function dailySpend(since, until, { token = process.env.META_ACCESS_TOKEN, ids = accounts(), secret = process.env.META_APP_SECRET, fetchFn = globalThis.fetch } = {}) {
  const out = [];
  for (const id of ids) {
    const url = new URL(`https://graph.facebook.com/${VERSION()}/act_${id}/insights`);
    const q = { level: "ad", fields: "ad_name,spend", time_increment: "1", time_range: JSON.stringify({ since, until }), limit: "500", access_token: token };
    if (secret) q.appsecret_proof = createHmac("sha256", secret).update(token).digest("hex");
    Object.entries(q).forEach(([k, v]) => url.searchParams.set(k, v));
    for (let next = url.toString(), pages = 0; next && pages < 50; pages++) {
      const res = await fetchFn(next, { headers: { Accept: "application/json" } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        const e = new Error("Meta " + res.status + ": " + ((body.error && body.error.message) || "no reason given"));
        e.status = res.status;
        e.code = body.error && body.error.code;
        throw e;
      }
      for (const r of body.data || []) {
        const spend = Number(r.spend);
        if (M.isDay(r.date_start) && isFinite(spend) && spend > 0) out.push({ day: r.date_start, ad: String(r.ad_name || "").trim() || "No name", spend });
      }
      next = body.paging && body.paging.next;
    }
  }
  return out;
}

/** The days added up into weeks: { "2026-10-12": { total, byAd: { "Raptor Ad": 120.5 } } }, every week from since's Monday on. */
export function weeksOf(rows, since, until) {
  const weeks = {};
  for (let w = M.mondayOf(since); w <= until; w = M.addDays(w, 7)) weeks[w] = { total: 0, byAd: {} };
  for (const r of rows) {
    const w = weeks[M.mondayOf(r.day)];
    if (!w) continue;
    w.total += r.spend;
    w.byAd[r.ad] = (w.byAd[r.ad] || 0) + r.spend;
  }
  const cents = (n) => Math.round(n * 100) / 100;
  Object.values(weeks).forEach((w) => { w.total = cents(w.total); Object.keys(w.byAd).forEach((k) => { w.byAd[k] = cents(w.byAd[k]); }); });
  return weeks;
}

/**
  The saves for spend/<week>: Meta's total and each ad's. A total typed in by hand is kept as
  handTotal the first time Meta's replaces it. existing is { week: data }.
*/
export function spendPatches(weeks, existing, at) {
  return Object.keys(weeks).sort().map((weekOf) => {
    const had = existing[weekOf] || null, w = weeks[weekOf];
    const data = { weekOf, total: w.total, byAd: w.byAd, from: "meta", metaAt: at, updatedAt: at, by: "Meta" };
    if (had && had.from !== "meta" && had.handTotal == null && had.total != null && had.total !== "") data.handTotal = had.total;
    return { id: weekOf, data, isNew: !had };
  });
}
