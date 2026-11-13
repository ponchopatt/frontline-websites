import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Film } from "./film-store.js";

/*
  The ad shoot (public/film/ad-filming.json): the scripts are the file's, the progress is ours.

  The page loads the same file from /film/ad-filming.json. Here it's read with a plain require,
  so Vercel bundles it with the function.

  Progress:
    - An ad's stage (to film, filmed, edited, scheduled, posted) is the stage of its idea in the
      "Ad shoot" series (idea.adId). Ticking it on the ad card or in the Ideas list is the same
      move, so the two never disagree.
    - Every checklist tick is its own document in film_ticks, so two phones ticking at the same
      moment can't overwrite each other. A tick is { scope, item }:
        <adId>:broll    an item in that ad's broll list
        <adId>:other    an item in its otherClips list
        <adId>:variant  a variant id (the bike ad's B4, B3, ...): filmed
        <adId>:checked  "checked": someone has gone through "Check before posting"
        kit             an item in the kit list
        extra           an item in the extra b-roll list
*/

const require = createRequire(import.meta.url);
export const AD = require("../public/film/ad-filming.json");

export const findAd = (id) => AD.ads.find((a) => a.id === id) || null;

// Is this a real thing to tick? Only items that are in the file can be ticked.
export function validTick(scope, item) {
  const s = String(scope || ""), it = String(item || "");
  if (!it || it.length > 400) return false;
  if (s === "kit") return AD.kit.includes(it);
  if (s === "extra") return AD.extraBroll.includes(it);
  const m = /^([\w-]+):(broll|other|variant|checked)$/.exec(s);
  const ad = m && findAd(m[1]);
  if (!ad) return false;
  if (m[2] === "broll") return (ad.broll || []).includes(it);
  if (m[2] === "other") return (ad.otherClips || []).includes(it);
  if (m[2] === "variant") return (ad.variants || []).some((v) => v.id === it);
  return it === "checked" && (ad.checks || []).length > 0;
}
export const tickId = (scope, item) => createHash("sha256").update(`${scope}\n${item}`).digest("hex").slice(0, 32);

// The idea for an ad: "Ad 1: Interrogating a detailer", the hook in its notes.
export const adIdea = (ad) => Film.adIdeaFields(ad);
