/*
  Imperium Film List: the page. Four lists (Ideas, Filmed, Edited, Scheduled) and a tick that
  moves an idea to the next one. A "Today" box shows what's yours to do, and phone reminders
  send the same thing every morning. The rules are in film-model.js.

  Ad filming (the button under the four lists): the ad shoot from /film/ad-filming.json. Every
  ad's words come from that file. Its progress is kept with the ideas: an ad's stage is its
  idea's stage (the "Ad shoot" series), and every checklist tick is saved on its own (ticks).
*/
(() => {
  "use strict";
  const M = window.FilmModel;
  const app = document.getElementById("app");
  const calm = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LISTS = ["tofilm", "filmed", "edited", "scheduled"];

  const local = {
    get(k) { try { return localStorage.getItem("film." + k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem("film." + k) : localStorage.setItem("film." + k, v); } catch { /* private mode */ } },
  };
  const readList = (s) => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const nowLocal = () => M.localNow(new Date());
  const today = () => nowLocal().slice(0, 10);

  const S = {
    who: window.FilmModel.cleanPerson(local.get("who")),
    data: null, loading: false, loadError: "",
    list: LISTS.includes(local.get("list")) ? local.get("list") : "tofilm",
    showPosted: false,
    openSeries: new Set(readList(local.get("openSeries"))), // series folders that are open
    seriesDraft: {},
    draft: "", adding: false,
    open: null,        // the idea being edited: { id, fields, msg, confirm }
    schedule: null,    // picking when it goes up: { id, date, time, msg }
    more: false, importMsg: "", importText: "",
    push: { state: "unknown", msg: "" },
    saving: false,
    ads: readAdsView(),  // the ad shoot screens: { view: list, ad, rules, kit, offers or extra; id }
    adData: null, adLoading: false, adError: "",
    adFold: new Set(readList(local.get("adFold"))), // sections this phone has folded (or unfolded)
    pendingTicks: new Map(), // ticks sent but not answered yet: "scope\nitem" -> the tick, or null
    kitConfirm: false, seeding: false, adListY: 0, backY: null,
  };
  function readAdsView() {
    try { const v = JSON.parse(local.get("ads") || "null"); return v && typeof v.view === "string" ? v : null; } catch { return null; }
  }
  function goAds(v) { S.ads = v; local.set("ads", v ? JSON.stringify(v) : null); }
  // Left over from earlier versions.
  ["token", "role", "tab", "ticks"].forEach((k) => local.set(k, null));

  /* ------------------------------------------------------------ server */

  async function api(action, payload) {
    const res = await fetch("/api/film", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, who: S.who, ...(payload || {}) }),
    });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw new Error((body && body.error) || "Something went wrong. Check your signal and try again.");
    return body;
  }
  async function load(quiet) {
    if (S.loading) return;
    S.loading = true;
    try {
      const r = await api("list");
      S.data = { ideas: r.ideas, ticks: withPending(r.ticks || []) };
      S.loadError = "";
      seedAds();
    } catch (e) {
      S.loadError = e.message;
    } finally {
      S.loading = false;
    }
    if (!quiet || !busy()) render();
  }
  const find = (id) => (S.data ? S.data.ideas.find((x) => x.id === id) : null);

  // The shoot guide, from the same folder as the page.
  async function loadAds() {
    if (S.adData || S.adLoading) return;
    S.adLoading = true;
    try {
      const res = await fetch("/film/ad-filming.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("not ok");
      S.adData = await res.json();
      S.adError = "";
    } catch {
      S.adError = "Couldn't load the shoot guide. Check your signal and try again.";
    }
    S.adLoading = false;
    if (!busy()) render();
  }
  // The "Ad shoot" series in Ideas, one idea per ad. Made once, the first time a phone finds
  // none of them. Each ad's idea has a fixed id, so two phones doing it at once is fine.
  async function seedAds() {
    if (S.seeding || local.get("adSeeded") || !S.data || S.data.ideas.some((x) => x.adId)) return;
    S.seeding = true;
    try {
      const r = await api("adSeed");
      (r.ideas || []).forEach(put);
      local.set("adSeeded", "1");
      if (!busy()) render();
    } catch { /* tried again on the next load */ }
    S.seeding = false;
  }
  function put(idea) {
    const i = S.data.ideas.findIndex((x) => x.id === idea.id);
    if (i >= 0) S.data.ideas[i] = idea;
    else S.data.ideas.unshift(idea);
  }
  const tickKey = (scope, item) => scope + "\n" + item;
  const tickOf = (scope, item) => (S.data ? S.data.ticks.find((t) => t.scope === scope && t.item === item) : null) || null;
  const countTicked = (scope, items) => (items || []).filter((it) => tickOf(scope, it)).length;
  // The list from the server, with this phone's ticks that haven't reached it yet.
  function withPending(ticks) {
    let out = ticks;
    S.pendingTicks.forEach((t, key) => {
      out = out.filter((x) => tickKey(x.scope, x.item) !== key);
      if (t) out.push(t);
    });
    return out;
  }

  /* ------------------------------------------------------------ toast with Undo */

  const toastEl = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastUndo = document.getElementById("toastUndo");
  let toastTimer = 0, toastFn = null;
  function toast(text, undo) {
    toastText.textContent = text;
    toastFn = undo || null;
    toastUndo.hidden = !undo;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; toastFn = null; }, undo ? 8000 : 3200);
  }
  toastUndo.addEventListener("click", () => {
    const fn = toastFn;
    toastEl.hidden = true;
    toastFn = null;
    if (fn) fn();
  });
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.append(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* old browser */ }
      ta.remove();
      return ok;
    }
  }
  const buzz = (ms) => { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch { /* fine */ } } };

  /* ------------------------------------------------------------ bits of page */

  const ICON = {
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };
  function header() {
    return `<header class="top"><div class="wrap top-in">
      <span class="brand"><img src="/film/icon-192.png" alt="">Film List</span>
      ${S.who ? `<button type="button" class="icon-btn" data-act="switch" aria-label="${esc(S.who)}. Tap to switch person">${esc(S.who)}</button><button type="button" class="icon-btn" data-act="more" aria-label="Settings">${ICON.gear}</button>` : ""}
    </div></header>`;
  }
  const dayWord = (d, t) => { const l = M.dayLabel(d, t); return /^(Today|Tomorrow|Yesterday)$/.test(l) ? l.toLowerCase() : l; };

  // "Ant, film by Fri 7 Nov" / "Goes up today at 6pm" / "Waiting 3 days".
  function metaLine(x) {
    const t = today();
    const st = M.stage(x.stage);
    const bits = [];
    if (x.who) bits.push(esc(x.who));
    if (x.stage === "scheduled" && x.postAt) {
      const d = x.postAt.slice(0, 10);
      const late = d < t || (d === t && M.minutesBetween(x.postAt, nowLocal()) > 60);
      bits.push(`<span class="${late ? "late" : "when"}">${late ? "Was due to go up " : "Goes up "}${esc(dayWord(d, t))} at ${esc(M.timeLabel(x.postAt))}</span>`);
    } else if (x.stage === "posted") {
      if (x.postedDay) bits.push("Posted " + esc(dayWord(x.postedDay, t)));
    } else if (x.when) {
      const late = x.when < t;
      const by = bits.length ? st.by.toLowerCase() : st.by;
      bits.push(`<span class="${late ? "late" : "when"}">${esc(by)} ${esc(dayWord(x.when, t))}${late ? " (late)" : ""}</span>`);
    } else if (x.stage !== "tofilm" && x.stageAt) {
      const days = M.daysBetween(M.dayIn(new Date(x.stageAt)), t);
      if (days >= 1) bits.push(`Waiting ${plural(days, "day", "days")}`);
    }
    if (x.link) bits.push(M.platformOf(x.link) === "tiktok" ? "TikTok link" : M.platformOf(x.link) === "instagram" ? "Instagram link" : "Link");
    return bits.join(", ");
  }

  // Inside a folder, "Does it foam? Ep 1: Shampoo" shows as "Ep 1: Shampoo".
  function shortTitle(x, series) {
    const t = String(x.title);
    if (!series || !t.toLowerCase().startsWith(series.toLowerCase())) return t;
    return t.slice(series.length).replace(/^[\s:–-]+/, "") || t;
  }
  function itemHTML(x, series) {
    const st = M.stage(x.stage);
    const meta = metaLine(x);
    const tickLabel = st.next ? `${st.next}: ${x.title}` : x.title;
    return `<li class="item" data-item="${x.id}" data-stage="${x.stage}">
      <button type="button" class="tick" data-act="tick" data-id="${x.id}" aria-label="${esc(tickLabel)}"></button>
      <button type="button" class="open" data-act="open" data-id="${x.id}"><span class="t">${esc(shortTitle(x, series))}</span>${(x.tags || []).length ? `<span class="tg">${x.tags.map(esc).join(", ")}</span>` : ""}${meta ? `<span class="m">${meta}</span>` : ""}</button>
      <span class="chev" aria-hidden="true">›</span>
    </li>`;
  }

  function todayHTML() {
    const list = M.remindersFor(S.data.ideas, S.who, nowLocal());
    const p = S.push;
    let bell = "";
    if (p.state === "off") bell = `<div class="bell"><p>Get these on your phone every morning.</p><button type="button" class="btn sm" data-act="pushOn">Turn on reminders</button></div>`;
    else if (p.state === "needs-home") bell = `<div class="bell"><p>For reminders, add Film List to your home screen first.</p><button type="button" class="btn sm" data-act="more">Show me</button></div>`;
    else if (p.state === "blocked") bell = `<div class="bell"><p>Reminders are blocked in this phone's settings.</p></div>`;
    if (!list.length && !bell) return "";
    return `<section class="today" aria-label="Today">
      <div class="today-head"><h2>${list.length ? "Today" : "All caught up"}</h2><span class="lbl">${list.length ? plural(list.length, "thing", "things") + " for you" : "Nothing due"}</span></div>
      ${list.map((r) => `<button type="button" class="todo" data-act="open" data-id="${r.id}"><span class="kind ${r.kind}">${esc(r.kind)}</span><span class="what">${esc(r.title)}${r.kind === "post" && !r.late ? `<span class="dim small" style="display:block">at ${esc(M.timeLabel(r.at))}</span>` : ""}</span>${r.late ? `<span class="late">Late</span>` : ""}</button>`).join("")}
      ${p.msg ? `<p class="err small">${esc(p.msg)}</p>` : ""}
      ${bell}
    </section>`;
  }

  /* ------------------------------------------------------------ screens */

  function renderWho() {
    app.innerHTML = `${header()}<main><div class="wrap">
      <div style="padding:22px 0 16px" class="stack"><h1>Who&rsquo;s this?</h1><p class="soft">Tap your name. Your phone remembers it, and your reminders come to you.</p></div>
      <div class="who">${M.PEOPLE.map((p) => `<button type="button" class="btn" data-act="pickWho" data-who="${p}">${p}</button>`).join("")}</div>
    </div></main>`;
  }

  // "Ep 2" before "Ep 10".
  const byTitle = (a, b) => String(a.title).localeCompare(String(b.title), "en", { numeric: true, sensitivity: "base" });

  const VERB = { tofilm: "to film", filmed: "to edit", edited: "to schedule", scheduled: "scheduled", posted: "posted" };
  const DOTS = { tofilm: "var(--tofilm)", filmed: "var(--filmed)", edited: "var(--edited)", scheduled: "var(--scheduled)", posted: "var(--posted)" };

  // A series as a folder: its name, how many are in this list, a dot for every idea in it
  // (coloured by the list it's in), and when open, its ideas with their ticks.
  function folderHTML(g, inList, cur) {
    const open = S.openSeries.has(g.name);
    const all = S.data.ideas.filter((x) => x.series && x.series.toLowerCase() === g.name.toLowerCase())
      .sort((a, b) => M.IDS.indexOf(b.stage) - M.IDS.indexOf(a.stage) || String(a.createdAt).localeCompare(String(b.createdAt)) || byTitle(a, b));
    const posted = g.stages.posted || 0;
    const draft = S.seriesDraft[g.name] || "";
    return `<li class="folder ${open ? "open" : ""}">
      <button type="button" class="folder-head" data-act="series" data-value="${esc(g.name)}" aria-expanded="${open}">
        <span class="stackicon" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="fh"><span class="t">${esc(g.name)}</span>
          <span class="m">${inList.length} ${esc(VERB[cur])}${g.count > inList.length || posted ? `, ${posted} of ${g.count} posted` : ""}</span>
          <span class="dots" aria-hidden="true">${all.map((x) => `<i style="background:${DOTS[x.stage]}"></i>`).join("")}</span></span>
        <span class="chev" aria-hidden="true">›</span>
      </button>
      ${open ? `<ul class="items in" style="list-style:none;margin:0;padding:0">${inList.map((x) => itemHTML(x, g.name)).join("")}</ul>
        ${cur === "tofilm" ? `<form class="add in" data-form="addSeries" data-series="${esc(g.name)}"><input autocomplete="off" enterkeyhint="done" placeholder="Add to ${esc(g.name)}" value="${esc(draft)}" data-draft="addSeries" data-series="${esc(g.name)}" aria-label="New idea in ${esc(g.name)}"><button type="submit" aria-label="Add it">${ICON.plus}</button></form>` : ""}` : ""}
    </li>`;
  }

  function renderMain() {
    const counts = M.countByStage(S.data.ideas);
    const mine = M.remindersFor(S.data.ideas, S.who, nowLocal());
    const kindOf = { tofilm: "film", filmed: "edit", edited: "schedule", scheduled: "post" };
    const cur = S.showPosted ? "posted" : S.list;
    const st = M.stage(cur);
    const items = S.data.ideas.filter((x) => x.stage === cur);
    if (cur === "scheduled") items.sort((a, b) => String(a.postAt).localeCompare(String(b.postAt)));
    else if (cur === "posted") items.sort((a, b) => String(b.postedDay || b.updatedAt).localeCompare(String(a.postedDay || a.updatedAt)));
    else items.sort((a, b) => (a.when ? 0 : 1) - (b.when ? 0 : 1) || String(a.when || "").localeCompare(String(b.when || "")) || String(a.createdAt).localeCompare(String(b.createdAt)) || byTitle(a, b));
    const loose = items.filter((x) => !x.series);
    const groups = M.seriesIn(S.data.ideas)
      .map((g) => ({ g, inList: items.filter((x) => x.series && x.series.toLowerCase() === g.name.toLowerCase()) }))
      .filter((f) => f.inList.length);
    const how = { tofilm: "Tick it when it's filmed", filmed: "Tick it when it's edited", edited: "Tick to pick when it goes up", scheduled: "Tick it once it's posted", posted: "Done and dusted" }[cur];
    app.innerHTML = `${header()}<main data-stage="${cur}"><div class="wrap">
      ${S.loadError ? `<p class="err" role="alert" style="margin:10px 0">${esc(S.loadError)}</p>` : ""}
      ${todayHTML()}
      <nav class="lists" aria-label="Lists">${LISTS.map((id) => `<button type="button" data-stage="${id}" data-act="list" data-id="${id}" aria-pressed="${!S.showPosted && S.list === id}"><b>${counts[id]}</b><span>${esc(M.stageLabel(id))}</span>${mine.some((r) => r.kind === kindOf[id]) ? `<i aria-label="Something here is yours today"></i>` : ""}</button>`).join("")}</nav>
      ${adButtonHTML()}
      <div class="list-head"><h1>${esc(st.label)}</h1><p>${esc(how)}</p></div>
      ${cur === "tofilm" ? `<form class="add" data-form="add"><input name="title" autocomplete="off" enterkeyhint="done" placeholder="Write down an idea" value="${esc(S.draft)}" data-draft="add" aria-label="New idea"><button type="submit" aria-label="Add the idea" ${S.adding ? "disabled" : ""}>${ICON.plus}</button></form>` : ""}
      ${items.length ? `<ul class="items ${cur === "posted" ? "posted" : ""}" style="list-style:none;margin:0;padding:0">${loose.map((x) => itemHTML(x)).join("")}${groups.map((f) => folderHTML(f.g, f.inList, cur)).join("")}</ul>` : `<div class="empty"><h2>Empty</h2><p>${esc(st.empty)}</p></div>`}
      ${cur === "scheduled" || cur === "posted" ? `<button type="button" class="more-link" data-act="posted">${S.showPosted ? "Back to Scheduled" : `See what's posted (${counts.posted})`}</button>` : ""}
      <div style="height:90px"></div>
    </div></main>`;
  }

  function sheetHead(title, close, label) {
    return `<div class="sheet-head"><div class="wrap"><button type="button" class="btn sm" data-act="${close}">${label || "Close"}</button><h2>${title}</h2></div></div>`;
  }
  const whenChips = (field, value, t) => [[t, "Today"], [M.addDays(t, 1), "Tomorrow"], [M.addDays(t, 2), M.dayLabel(M.addDays(t, 2), t)]]
    .map(([d, l]) => `<button type="button" class="chip" data-act="pick" data-field="${field}" data-value="${d}" aria-pressed="${value === d}">${esc(l)}</button>`).join("");

  function renderOpen() {
    const o = S.open;
    const x = find(o.id);
    if (!x) { S.open = null; return render(); }
    const f = o.fields;
    const st = M.stage(x.stage);
    const t = today();
    const back = M.IDS.indexOf(x.stage) > 0 ? M.stage(M.IDS[M.IDS.indexOf(x.stage) - 1]) : null;
    const step = x.stage === "posted" ? "" : x.stage === "scheduled"
      ? `<div class="field"><span>Goes up</span><div class="pair"><input type="date" data-f="postDate" value="${esc(f.postDate)}" aria-label="Day it goes up"><input type="time" data-f="postTime" value="${esc(f.postTime)}" aria-label="Time it goes up"></div></div>`
      : `<div class="field"><span>Who ${esc(st.step.toLowerCase())}s it? <em>(blank: both of you)</em></span><div class="chips">${M.PEOPLE.map((p) => `<button type="button" class="chip" data-act="pick" data-field="who" data-value="${p}" aria-pressed="${f.who === p}">${p}</button>`).join("")}</div></div>
         <div class="field"><span>${esc(st.by)} <em>(optional)</em></span><div class="chips">${whenChips("when", f.when, t)}<button type="button" class="chip" data-act="pick" data-field="when" data-value="" aria-pressed="${!f.when}">No date</button></div><input type="date" data-f="when" value="${esc(f.when || "")}" aria-label="${esc(st.by)}"></div>`;
    app.innerHTML = `<div class="sheet" data-stage="${x.stage}">${sheetHead(esc(st.label), "close", "Close")}<div class="wrap"><form class="body" data-form="idea" novalidate>
      <label class="field"><span>The idea</span><input class="title-in" data-f="title" value="${esc(f.title)}" maxlength="140" required></label>
      ${x.adId && findAd(x.adId) ? `<button type="button" class="btn sm" data-act="adFromIdea" data-value="${esc(x.adId)}" style="justify-self:start">Open the ad card: script, shots, checklists</button>` : ""}
      ${step}
      <label class="field"><span>Notes <em>(hook, shots, anything)</em></span><textarea data-f="notes" rows="4" placeholder="The hook, the shots, who's in it">${esc(f.notes)}</textarea></label>
      <label class="field"><span>Caption <em>(optional)</em></span><textarea data-f="caption" rows="2" placeholder="Statements, not questions">${esc(f.caption)}</textarea>${f.caption ? `<button type="button" class="btn sm" data-act="copy" style="justify-self:start">Copy the caption</button>` : ""}</label>
      <div class="field"><span>Series <em>(optional)</em></span><div class="chips">${M.seriesIn(S.data.ideas).map((g) => `<button type="button" class="chip" data-act="pick" data-field="series" data-value="${esc(g.name)}" aria-pressed="${f.series.toLowerCase() === g.name.toLowerCase()}">${esc(g.name)}</button>`).join("")}<button type="button" class="chip" data-act="pick" data-field="series" data-value="" aria-pressed="${!f.series}">None</button></div><input data-f="series" value="${esc(f.series)}" placeholder="Or type a new series name" autocomplete="off" aria-label="Series name"></div>
      <label class="field"><span>Tags <em>(optional, a comma between them)</em></span><input data-f="tags" value="${esc(f.tags)}" placeholder="Reach" autocomplete="off"></label>
      <label class="field"><span>Example link <em>(optional)</em></span><input type="url" inputmode="url" data-f="link" value="${esc(f.link)}" placeholder="TikTok or Instagram link">${x.link ? `<a class="btn sm" href="${esc(x.link)}" target="_blank" rel="noopener" style="justify-self:start">Watch it</a>` : ""}</label>
      ${o.msg ? `<p class="err" role="alert">${esc(o.msg)}</p>` : ""}
      <button type="submit" class="btn go wide" ${S.saving ? "disabled" : ""}>${S.saving ? "Saving..." : "Save"}</button>
      <div class="btns">${back ? `<button type="button" class="btn" data-act="back" data-id="${x.id}">Back to ${esc(back.label)}</button>` : ""}<button type="button" class="btn danger" data-act="delete">${o.confirm ? "Tap again to delete" : "Delete"}</button></div>
    </form></div></div>`;
  }

  function renderSchedule() {
    const s = S.schedule;
    const x = find(s.id);
    if (!x) { S.schedule = null; return render(); }
    const t = today();
    const now = nowLocal();
    const ad = x.adId ? findAd(x.adId) : null;
    const mustCheck = !!(ad && has(ad.checks));
    const checked = mustCheck && tickOf(ad.id + ":checked", "checked");
    const quick = [[t, "18:00", "Today 6pm"], [M.addDays(t, 1), "12:00", "Tomorrow 12pm"], [M.addDays(t, 1), "18:00", "Tomorrow 6pm"], [M.addDays(t, 2), "18:00", M.dayLabel(M.addDays(t, 2), t) + " 6pm"]]
      .filter(([d, h]) => d + "T" + h > now); // nothing that's already gone by
    app.innerHTML = `<div class="sheet" data-stage="scheduled">${sheetHead("When does it go up?", "scheduleClose", "Cancel")}<div class="wrap"><div class="body">
      <p style="font-weight:700;font-size:20px">${esc(x.title)}</p>
      <div class="chips">${quick.map(([d, h, l]) => `<button type="button" class="chip" data-act="quick" data-date="${d}" data-time="${h}" aria-pressed="${s.date === d && s.time === h}">${esc(l)}</button>`).join("")}</div>
      <div class="pair"><label class="field"><span>Day</span><input type="date" data-s="date" value="${esc(s.date)}"></label><label class="field"><span>Time</span><input type="time" data-s="time" value="${esc(s.time)}"></label></div>
      ${mustCheck ? `<section class="warnbox"><h3>Check before posting</h3>${checksHTML(ad)}</section>` : ""}
      ${s.msg ? `<p class="err" role="alert">${esc(s.msg)}</p>` : ""}
      <button type="button" class="btn go wide" data-act="scheduleGo" ${S.saving || (mustCheck && !checked) ? "disabled" : ""}>Schedule it</button>
      <p class="hint">Whoever has reminders on gets one before it&rsquo;s due to go up.</p>
    </div></div></div>`;
  }

  function renderMore() {
    const p = S.push;
    const pushPanel = {
      on: `<p class="soft">This phone gets a reminder every morning at 7 with what&rsquo;s yours to film, edit, schedule or post, and one before anything goes up.</p><div class="btns"><button type="button" class="btn" data-act="pushTest">Send a test</button><button type="button" class="btn" data-act="pushOff">Turn off</button></div>`,
      off: `<p class="soft">Get a reminder every morning at 7 with what&rsquo;s yours to do, and one before anything goes up.</p><button type="button" class="btn go wide" data-act="pushOn" data-stage="scheduled">Turn on reminders</button>`,
      "needs-home": `<p class="soft">On iPhone, reminders only work once Film List is on your home screen:</p><ol class="steps"><li>Open this page in <strong>Safari</strong>.</li><li>Tap the <strong>Share</strong> button (the square with the arrow).</li><li>Tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li><li>Open Film List from the new icon, then come back here and tap <strong>Turn on reminders</strong>.</li></ol>`,
      blocked: `<p class="soft">This phone said no to notifications. Turn them on for Film List in the phone&rsquo;s Settings, under Notifications, then come back.</p>`,
      unsupported: `<p class="soft">This browser can&rsquo;t do reminders. On iPhone, add Film List to the home screen from Safari. On Android, use Chrome.</p>`,
      unknown: `<p class="soft">Checking...</p>`,
    }[p.state] || "";
    app.innerHTML = `<div class="sheet">${sheetHead("Settings", "moreClose")}<div class="wrap"><div class="body">
      <section class="panel"><div class="row"><h2 class="grow">Reminders</h2><span class="pill ${p.state === "on" ? "on" : ""}">${p.state === "on" ? "On" : "Off"}</span></div>${pushPanel}${p.msg ? `<p class="${/sent|on\./i.test(p.msg) ? "soft" : "err"}" role="status">${esc(p.msg)}</p>` : ""}</section>
      <section class="panel"><h2>Add a reel from your phone</h2><p class="soft">Set this up once. Then on any TikTok or Instagram reel, tap Share, then <strong>Save to Film List</strong>, and it lands in Ideas.</p>
        <ol class="steps">
          <li>Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name it <strong>Save to Film List</strong>.</li>
          <li>Tap the <strong>(i)</strong> button and turn on <strong>Show in Share Sheet</strong>. Set it to receive <strong>URLs</strong> and <strong>Text</strong>.</li>
          <li>Add <strong>Ask for Input</strong> (Text). Prompt: <em>What's the idea?</em></li>
          <li>Add <strong>Get Contents of URL</strong>. URL: <code>${esc(location.origin)}/api/film</code>. Method <strong>POST</strong>. Request Body <strong>JSON</strong>: <code>action</code> = <code>inbox</code>, <code>url</code> = <strong>Shortcut Input</strong>, <code>note</code> = <strong>Provided Input</strong>.</li>
          <li>Add <strong>Get Dictionary Value</strong>: <code>message</code>, then <strong>Show Notification</strong> with it.</li>
        </ol></section>
      <section class="panel"><h2>Import ideas</h2><p class="soft">Add imperium_film_ideas.json. Everything lands in Ideas. Ones already on the list are skipped.</p>
        <label class="btn wide" style="cursor:pointer">Choose the file<input type="file" accept=".json,application/json" data-change="importFile" hidden></label>
        <label class="field"><span>Or paste it here</span><textarea data-draft="importText" placeholder='[{"title": "Mat slap"}]'>${esc(S.importText)}</textarea></label>
        <button type="button" class="btn wide" data-act="importPaste">Import</button>
        ${S.importMsg ? `<p class="soft" role="status">${esc(S.importMsg)}</p>` : ""}</section>
      <section class="panel"><h2>This phone</h2><p class="soft">This phone is set to ${esc(S.who)}.</p><button type="button" class="btn wide" data-act="switch">Switch person</button></section>
    </div></div></div>`;
  }

  /* ------------------------------------------------------------ ad filming */

  const PRIORITY = [["must", "Must shoot tomorrow"], ["if-time", "If there's time"], ["separate-day", "Separate day"]];
  const FLOW = [["filmed", "Filmed"], ["edited", "Edited"], ["scheduled", "Scheduled"]];
  const NEXT = { tofilm: "Filmed it", filmed: "Edited it", edited: "Schedule it", scheduled: "Posted it" };
  const findAd = (id) => (S.adData && S.adData.ads.find((a) => a.id === id)) || null;
  const adIdeaOf = (ad) => (ad && S.data && S.data.ideas.find((x) => x.adId === ad.id)) || null;
  const adStage = (ad) => { const x = adIdeaOf(ad); return x ? x.stage : "tofilm"; };
  const reached = (ad, stage) => M.IDS.indexOf(adStage(ad)) >= M.IDS.indexOf(stage);
  const has = (list) => Array.isArray(list) && list.length > 0;

  // Any text from the shoot guide: [placeholders] in red, so nobody films or posts "[$X]".
  const ph = (s) => esc(s).replace(/\[([^\]]*)\]/g, '<mark class="ph" title="Fill this in first">[$1]</mark>');
  // The words to say: (stage directions) in grey too, and the speaker's name in bold.
  function rich(s) {
    const h = ph(s).replace(/\(([^()]*)\)/g, '<span class="dir">($1)</span>');
    return h.replace(/^([A-Z]{2,}(?: [A-Z]{2,})?)(?=(?: <span class="dir">[^<]*<\/span>)?:)/, '<b class="spk">$1</b>');
  }

  // Filmed, Edited, Scheduled: lit up as far as the ad has got.
  function flowHTML(stage) {
    const at = M.IDS.indexOf(stage);
    return `<span class="flow" aria-hidden="true">${FLOW.map(([id, l], i) => `<span data-stage="${id}" class="${at > i ? "done" : ""}">${l}</span>`).join("")}</span>`;
  }
  const stageWords = (stage) => (stage === "tofilm" ? "Not filmed yet" : M.stageLabel(stage));

  // A section that folds away. Open unless this phone folded it (variants start folded).
  function isOpen(key, startOpen) { return startOpen !== S.adFold.has(key); }
  function sec(key, title, inner, o) {
    if (!inner) return "";
    o = o || {};
    const open = isOpen(key, true);
    return `<section class="sec ${o.cls || ""}"><h3><button type="button" data-act="adFold" data-value="${esc(key)}" aria-expanded="${open}"><span>${title}</span>${o.side ? `<em>${o.side}</em>` : ""}<i class="chev" aria-hidden="true">›</i></button></h3>${open ? `<div class="sec-body">${inner}</div>` : ""}</section>`;
  }
  const hookHTML = (o) => [o.hook ? `<p class="hook">${rich(o.hook)}</p>` : "", o.altHook ? `<p class="lbl">Or try this hook</p><p class="hook alt">${rich(o.altHook)}</p>` : ""].join("");
  const linesHTML = (lines, fmt) => (has(lines) ? `<ul class="lines">${lines.map((l) => `<li>${(fmt || rich)(l)}</li>`).join("")}</ul>` : "");
  const stepsHTML = (list, cls) => (has(list) ? `<ol class="steps ${cls || ""}">${list.map((l) => `<li>${ph(l)}</li>`).join("")}</ol>` : "");
  function ctaHTML(o) {
    const versions = (o.ctaVariants || []).filter((v) => has(v.cta))
      .map((v) => `<div class="ctav">${v.label ? `<p class="lbl">${ph(v.label)}</p>` : ""}${linesHTML(v.cta)}</div>`).join("");
    return linesHTML(o.cta) + versions;
  }
  // When, the shot, then the words on screen in a chip that copies them.
  function visualHTML(rows) {
    if (!has(rows)) return "";
    return `<ol class="visual">${rows.map((r) => `<li>
      ${r.time ? `<span class="vt">${ph(r.time)}</span>` : ""}${r.shot ? `<p>${ph(r.shot)}</p>` : ""}
      ${r.text ? `<button type="button" class="ost" data-act="adCopy" data-value="${esc(r.text)}" data-what="On-screen text copied" aria-label="Copy the on-screen text: ${esc(r.text)}"><span>${ph(r.text)}</span><i>Copy</i></button>` : ""}
    </li>`).join("")}</ol>`;
  }
  function checkHTML(scope, item, label, cls) {
    const t = tickOf(scope, item);
    return `<button type="button" class="ck ${cls || ""}" data-act="adTick" data-scope="${esc(scope)}" data-value="${esc(item)}" aria-pressed="${!!t}"><i aria-hidden="true"></i><span>${label}</span>${t && t.by ? `<em>${esc(t.by)}</em>` : ""}</button>`;
  }
  const checklistHTML = (scope, items) => (has(items) ? `<ul class="checks">${items.map((it) => `<li>${checkHTML(scope, it, ph(it))}</li>`).join("")}</ul>` : "");
  const tally = (scope, items) => (has(items) ? `${countTicked(scope, items)} of ${items.length}` : "");
  // "Check before posting": the list, and the tick that lets it be scheduled.
  function checksHTML(ad) {
    if (!has(ad.checks)) return "";
    return `${linesHTML(ad.checks, ph)}${checkHTML(ad.id + ":checked", "checked", "I&rsquo;ve checked these", "big")}
      <p class="hint">It can&rsquo;t be scheduled until this is ticked.</p>`;
  }

  function adButtonHTML() {
    const A = S.adData;
    const m = A ? `${plural(A.ads.length, "ad", "ads")}, ${A.ads.filter((a) => reached(a, "filmed")).length} filmed` : "Scripts, shots and checklists for the shoot";
    return `<button type="button" class="adbtn" data-act="adsOpen"><span class="rec" aria-hidden="true"></span><span class="fh"><span class="t">Ad filming</span><span class="m">${esc(m)}</span></span><span class="chev" aria-hidden="true">›</span></button>`;
  }

  function adCardHTML(ad) {
    const stage = adStage(ad);
    const vs = ad.variants || [];
    const where = [ad.length, ad.where].filter(Boolean).map(ph).join(", ");
    return `<li class="item adcard" data-ad="${esc(ad.id)}" data-stage="${stage}">
      <button type="button" class="tick" data-act="adStep" data-id="${esc(ad.id)}" aria-label="${esc(NEXT[stage] ? `${NEXT[stage]}: Ad ${ad.number}. ${stageWords(stage)}` : `Ad ${ad.number} is posted`)}" ${stage === "posted" ? "disabled" : ""}></button>
      <button type="button" class="open" data-act="adOpen" data-id="${esc(ad.id)}">
        <span class="an">Ad ${esc(ad.number)}${ad.isNew ? ` <span class="new">New</span>` : ""}</span>
        <span class="t">${ph(ad.title)}</span>
        ${where ? `<span class="m">${where}</span>` : ""}
        ${has(ad.cast) ? `<span class="m">On camera: ${ad.cast.map(ph).join(", ")}</span>` : ""}
        ${ad.offer ? `<span class="m">Offer: ${ph(ad.offer)}</span>` : ""}
        ${vs.length ? `<span class="m">${countTicked(ad.id + ":variant", vs.map((v) => v.id))} of ${vs.length} versions filmed</span>` : ""}
        ${ad.deadline ? `<span class="deadline">${ph(ad.deadline)}</span>` : ""}
        ${flowHTML(stage)}
      </button>
      <span class="chev" aria-hidden="true">›</span>
    </li>`;
  }

  function adPage(stage, title, close, inner) {
    app.innerHTML = `<div class="adpage" data-stage="${stage}">${sheetHead(title, close, "Back")}<div class="wrap"><div class="body">${inner}</div></div></div>`;
  }

  function renderAdList() {
    const A = S.adData;
    const ads = [...A.ads].sort((a, b) => (a.shootOrder || 0) - (b.shootOrder || 0));
    const n = (stage) => ads.filter((a) => reached(a, stage)).length;
    const shared = [
      ["rules", "Rules", has(A.rules) && plural(A.rules.length, "rule", "rules")],
      ["kit", "Kit list", has(A.kit) && `${tally("kit", A.kit)} packed`],
      ["offers", "Offers", has(A.offers) && plural(A.offers.length, "offer", "offers")],
      ["extra", "Extra B-roll", has(A.extraBroll) && `${tally("extra", A.extraBroll)} got`],
    ].filter((x) => x[2]);
    const groups = PRIORITY.concat([["", "Other ads"]]).map(([p, label]) => {
      const g = ads.filter((a) => (p ? a.priority === p : !PRIORITY.some(([q]) => q === a.priority)));
      return g.length ? `<section class="adgroup"><h2>${esc(label)} <small>${plural(g.length, "ad", "ads")}</small></h2><ul class="items" style="list-style:none;margin:0;padding:0">${g.map(adCardHTML).join("")}</ul></section>` : "";
    }).join("");
    adPage("tofilm", "Ad filming", "adsClose", `
      ${S.loadError ? `<p class="err" role="alert">${esc(S.loadError)}</p>` : ""}
      <p class="soft">${plural(ads.length, "ad", "ads")} in shoot order. ${n("filmed")} filmed, ${n("edited")} edited, ${n("scheduled")} scheduled. Tick the circle when it&rsquo;s done, same as Ideas.</p>
      ${shared.length ? `<nav class="shared" aria-label="For every ad">${shared.map(([v, l, m]) => `<button type="button" data-act="adView" data-value="${v}"><b>${l}</b><span>${esc(m)}</span></button>`).join("")}</nav>` : ""}
      ${groups}`);
  }

  function variantHTML(ad, v) {
    const key = `${ad.id}:v:${v.id}`;
    const open = isOpen(key, false);
    const t = tickOf(ad.id + ":variant", v.id);
    const sub = (title, inner) => (inner ? `<h4>${title}</h4>${inner}` : "");
    return `<li class="variant ${t ? "done" : ""}">
      <div class="vhead">
        <button type="button" class="tick" data-act="adTick" data-scope="${esc(ad.id)}:variant" data-value="${esc(v.id)}" aria-pressed="${!!t}" aria-label="Filmed: ${esc(v.id)}"></button>
        <h3><button type="button" data-act="adFold" data-value="${esc(key)}" aria-expanded="${open}"><span><span class="vid">${esc(v.id)}</span> ${ph(v.title || "")}${t ? `<em>Filmed${t.by ? " by " + esc(t.by) : ""}</em>` : ""}</span><i class="chev" aria-hidden="true">›</i></button></h3>
      </div>
      ${open ? `<div class="vbody">
        <button type="button" class="btn sm prompt-btn" data-act="prompter" data-id="${esc(ad.id)}" data-value="${esc(v.id)}">Teleprompter for ${esc(v.id)}</button>
        ${sub("Hook", hookHTML(v))}${sub("Body", linesHTML(v.body))}${sub("CTA", ctaHTML(v))}${sub("Visual", visualHTML(v.visual))}
      </div>` : ""}
    </li>`;
  }

  function renderAdDetail(ad) {
    const stage = adStage(ad);
    const x = adIdeaOf(ad);
    const at = M.IDS.indexOf(stage);
    const back = at > 0 ? M.stage(M.IDS[at - 1]) : null;
    const k = ad.id;
    const vs = ad.variants || [];
    const facts = [["Length", ad.length], ["Where", ad.where], ["On camera", has(ad.cast) ? ad.cast.join(", ") : ""], ["Offer", ad.offer], ["Lead form", ad.form]]
      .filter((f) => f[1]).map(([l, v]) => `<div><dt>${l}</dt><dd>${ph(v)}</dd></div>`).join("");
    const canPrompt = scriptParts(ad).length || vs.length;
    adPage(stage, `Ad ${esc(ad.number)}`, "adsBack", `
      <div class="ad-top">
        ${ad.isNew ? `<span class="new">New</span>` : ""}
        <h1>${ph(ad.title)}</h1>
        ${facts ? `<dl class="facts">${facts}</dl>` : ""}
        ${ad.deadline ? `<p class="deadline">${ph(ad.deadline)}</p>` : ""}
      </div>
      <div class="stagebox">
        ${flowHTML(stage)}
        <div class="actrow ${canPrompt ? "" : "one"}">
          ${NEXT[stage] ? `<button type="button" class="btn go" data-act="adStep" data-id="${esc(ad.id)}">${NEXT[stage]}</button>` : `<p class="posted-note">Posted</p>`}
          ${canPrompt ? `<button type="button" class="btn prompt-btn" data-act="prompter" data-id="${esc(ad.id)}">Teleprompter</button>` : ""}
        </div>
      </div>
      ${has(ad.filmingOrder) ? sec(k + ":order", "Filming order", stepsHTML(ad.filmingOrder)) : ""}
      ${vs.length ? `<section class="versions"><h2>Versions <small>${tally(k + ":variant", vs.map((v) => v.id))} filmed</small></h2><ul class="variants">${vs.map((v) => variantHTML(ad, v)).join("")}</ul></section>` : ""}
      ${sec(k + ":hook", "Hook", hookHTML(ad))}
      ${sec(k + ":body", "Body", linesHTML(ad.body))}
      ${sec(k + ":cta", "CTA", ctaHTML(ad))}
      ${sec(k + ":visual", "Visual", visualHTML(ad.visual))}
      ${sec(k + ":setup", "Setup", stepsHTML(ad.setup))}
      ${sec(k + ":broll", "B-roll needed", checklistHTML(k + ":broll", ad.broll), { side: tally(k + ":broll", ad.broll) })}
      ${sec(k + ":other", "Other clips", checklistHTML(k + ":other", ad.otherClips), { side: tally(k + ":other", ad.otherClips) })}
      ${sec(k + ":checks", "Check before posting", checksHTML(ad), { cls: "warnbox" })}
      ${sec(k + ":caption", "Caption", ad.caption ? `<p class="cap">${ph(ad.caption)}</p><button type="button" class="btn sm" data-act="adCopy" data-value="${esc(ad.caption)}" data-what="Caption copied" style="justify-self:start">Copy the caption</button>` : "")}
      <div class="btns">${back && x ? `<button type="button" class="btn" data-act="adBack" data-id="${esc(ad.id)}">Back to ${esc(back.label)}</button>` : ""}${x ? `<button type="button" class="btn" data-act="open" data-id="${esc(x.id)}">Open in Ideas</button>` : ""}</div>`);
  }

  function renderShared(v) {
    const A = S.adData;
    if (v === "rules") return adPage("tofilm", "Rules", "adsBack", `<p class="soft">For every ad, every take.</p>${stepsHTML(A.rules, "big")}`);
    if (v === "kit") {
      return adPage("tofilm", "Kit list", "adsBack", `<p class="soft">${tally("kit", A.kit)} packed. Ticks show on both phones.</p>${checklistHTML("kit", A.kit)}
        <button type="button" class="btn wide ${S.kitConfirm ? "danger" : ""}" data-act="kitReset">${S.kitConfirm ? "Tap again to untick everything" : "Reset the list"}</button>`);
    }
    if (v === "offers") {
      const year = Number(String(A.version || "").slice(0, 4)) || Number(today().slice(0, 4));
      return adPage("tofilm", "Offers", "adsBack", `<p class="soft">What each ad can say. Greyed out once it&rsquo;s over.</p>
        <ul class="offers">${(A.offers || []).map((o) => {
          const st = M.offerStatus(o.runs || "", today(), year);
          return `<li class="offer ${st.state}"><div class="row"><b class="grow">${ph(o.name)}</b>${st.label ? `<span class="pill ${st.state}">${esc(st.label)}</span>` : ""}</div>${o.price ? `<p>${ph(o.price)}</p>` : ""}${o.runs ? `<p class="runs">${ph(o.runs)}</p>` : ""}</li>`;
        }).join("")}</ul>`);
    }
    return adPage("tofilm", "Extra B-roll", "adsBack", `<p class="soft">Grab these on the day if there&rsquo;s time. ${tally("extra", A.extraBroll)} got.</p>${checklistHTML("extra", A.extraBroll)}`);
  }

  function renderAds() {
    if (!S.adData) {
      adPage("tofilm", "Ad filming", "adsClose", `<div class="boot"><div class="stack" style="justify-items:center"><p class="${S.adError ? "err" : "dim"}">${esc(S.adError || "Loading the shoot guide...")}</p>${S.adError ? `<button type="button" class="btn" data-act="adRetry">Try again</button>` : ""}</div></div>`);
      if (!S.adError) loadAds();
      return;
    }
    const v = S.ads.view;
    if (v === "ad") {
      const ad = findAd(S.ads.id);
      if (ad) return renderAdDetail(ad);
      goAds({ view: "list" });
    }
    if (["rules", "kit", "offers", "extra"].includes(v)) return renderShared(v);
    return renderAdList();
  }

  /* ------------------------------------------------------------ teleprompter */

  // What gets read out: the hook, the body and the CTA (each CTA version, then the other hook).
  function scriptParts(o) {
    const parts = [];
    if (o.hook) parts.push(["Hook", [o.hook]]);
    if (has(o.body)) parts.push(["Body", o.body]);
    if (has(o.cta)) parts.push(["CTA", o.cta]);
    (o.ctaVariants || []).forEach((v) => { if (has(v.cta)) parts.push([v.label ? "CTA: " + v.label : "CTA", v.cta]); });
    if (o.altHook) parts.push(["Or try this hook", [o.altHook]]);
    return parts;
  }

  // On the teleprompter, who's talking and what they do go small on a line of their own, so only
  // the words to say are big: "ANANTH (in the chair): I can't say!".
  function promptLine(l) {
    const t = String(l).trim();
    if (/^\([^()]*\)$/.test(t)) return `<p class="pr-cue">${ph(t)}</p>`;
    const m = /^([A-Z]{2,}(?: [A-Z]{2,})?)\s*(\([^()]*\))?\s*:\s*([\s\S]*)$/.exec(t);
    if (!m) return `<p class="pr-line">${rich(t)}</p>`;
    return `<p class="pr-cue"><b class="spk">${esc(m[1])}</b>${m[2] ? " " + ph(m[2]) : ""}</p>${m[3] ? `<p class="pr-line">${rich(m[3])}</p>` : ""}`;
  }

  // Full screen, big words, scrolling on its own. Tap the words to stop and start. The screen
  // stays on while it's open (where the phone allows it).
  const P = { el: null, playing: false, y: 0, last: 0, raf: 0, wake: null, title: "",
    speed: Math.min(10, Math.max(1, Number(local.get("pSpeed")) || 4)), size: Math.min(96, Math.max(40, Number(local.get("pSize")) || 56)) };
  const pxPerSec = () => P.speed * 0.22 * P.size * 1.22; // about a line a second at speed 4

  async function keepAwake(on) {
    try {
      if (on && !P.wake && "wakeLock" in navigator && document.visibilityState === "visible") {
        P.wake = await navigator.wakeLock.request("screen");
        P.wake.addEventListener("release", () => { P.wake = null; });
      } else if (!on && P.wake) {
        const w = P.wake;
        P.wake = null;
        await w.release();
      }
    } catch { P.wake = null; }
  }

  function openPrompter(ad, vid) {
    if (!ad || P.el) return;
    const blocks = [];
    const add = (o, head) => {
      if (head) blocks.push(`<h2 class="pr-head">${ph(head)}</h2>`);
      scriptParts(o).forEach(([label, lines]) => {
        blocks.push(`<p class="pr-lbl">${ph(label)}</p>`);
        lines.forEach((l) => blocks.push(promptLine(l)));
      });
    };
    const vs = ad.variants || [];
    const v = vid && vs.find((x) => x.id === vid);
    if (v) add(v, `${v.id}: ${v.title || ""}`);
    else { add(ad); vs.forEach((x) => add(x, `${x.id}: ${x.title || ""}`)); }
    P.title = `Ad ${ad.number}${v ? " " + v.id : ""}`;
    const el = document.createElement("div");
    el.className = "prompter";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Teleprompter: " + P.title);
    el.innerHTML = `<div class="pr-top"><span class="pr-title">${esc(P.title)}</span><button type="button" data-p="restart">Restart</button><button type="button" data-p="close">Close</button></div>
      <div class="pr-stage"><div class="pr-scroll" data-p="toggle"><div class="pr-text" style="font-size:${P.size}px">
        ${"wakeLock" in navigator ? "" : `<p class="pr-note">This phone might lock the screen. Turn Auto-Lock off in Settings, Display while you film.</p>`}
        ${blocks.join("")}<p class="pr-end">End</p></div></div><i class="pr-guide" aria-hidden="true"></i></div>
      <div class="pr-bar">
        <div class="pr-group"><button type="button" data-p="slower" aria-label="Slower">&minus;</button><span class="pr-val"><b data-p-speed>${P.speed}</b>Speed</span><button type="button" data-p="faster" aria-label="Faster">+</button></div>
        <button type="button" class="pr-play" data-p="toggle">Play</button>
        <div class="pr-group"><button type="button" data-p="smaller" aria-label="Smaller words">A&minus;</button><button type="button" data-p="bigger" aria-label="Bigger words">A+</button></div>
      </div>`;
    document.body.append(el);
    document.body.classList.add("locked");
    P.el = el;
    P.y = 0;
    P.playing = false;
    const scroller = el.querySelector(".pr-scroll");
    // Dragging it by hand moves the place it carries on from.
    scroller.addEventListener("scroll", () => { if (Math.abs(scroller.scrollTop - P.y) > 3) P.y = scroller.scrollTop; }, { passive: true });
    el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-p]");
      if (!b) return;
      const act = b.dataset.p;
      if (act === "toggle") return playPrompter(!P.playing);
      if (act === "close") return closePrompter();
      if (act === "restart") { P.y = 0; scroller.scrollTop = 0; return; }
      if (act === "slower" || act === "faster") {
        P.speed = Math.min(10, Math.max(1, P.speed + (act === "faster" ? 1 : -1)));
        local.set("pSpeed", String(P.speed));
        el.querySelector("[data-p-speed]").textContent = P.speed;
        return;
      }
      if (act === "smaller" || act === "bigger") {
        const at = scroller.scrollHeight ? P.y / scroller.scrollHeight : 0;
        P.size = Math.min(96, Math.max(40, P.size + (act === "bigger" ? 8 : -8)));
        local.set("pSize", String(P.size));
        el.querySelector(".pr-text").style.fontSize = P.size + "px";
        P.y = at * scroller.scrollHeight;
        scroller.scrollTop = P.y;
      }
    });
    keepAwake(true);
    el.querySelector(".pr-play").focus();
  }
  function playPrompter(on) {
    if (!P.el) return;
    P.playing = on;
    P.el.classList.toggle("playing", on);
    P.el.querySelector(".pr-play").textContent = on ? "Pause" : "Play";
    cancelAnimationFrame(P.raf);
    if (!on) return;
    const scroller = P.el.querySelector(".pr-scroll");
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) { P.y = 0; scroller.scrollTop = 0; } // from the top again
    P.last = 0;
    const step = (t) => {
      if (!P.playing || !P.el) return;
      if (P.last) P.y += (pxPerSec() * Math.min(100, t - P.last)) / 1000;
      P.last = t;
      scroller.scrollTop = P.y;
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) return playPrompter(false);
      P.raf = requestAnimationFrame(step);
    };
    P.raf = requestAnimationFrame(step);
  }
  function closePrompter() {
    if (!P.el) return;
    P.playing = false;
    cancelAnimationFrame(P.raf);
    keepAwake(false);
    P.el.remove();
    P.el = null;
    render();
  }
  document.addEventListener("keydown", (ev) => {
    if (!P.el) return;
    if (ev.key === "Escape") closePrompter();
    else if (ev.key === " " && !ev.target.closest("button")) { ev.preventDefault(); playPrompter(!P.playing); }
  });

  let shown = "";
  function render() {
    const sheet = !!(S.open || S.schedule || S.more);
    // A sheet covers the page, so remember where the page was and go back there after.
    if (sheet && shown !== "sheet") S.backY = window.scrollY;
    draw(sheet);
    if (!sheet && shown === "sheet" && S.backY != null) { window.scrollTo(0, S.backY); S.backY = null; }
    shown = sheet ? "sheet" : "page";
  }
  function draw(sheet) {
    document.body.classList.toggle("locked", sheet || !!P.el);
    if (!S.who) return renderWho();
    if (!S.data) {
      app.innerHTML = `${header()}<main><div class="wrap boot"><div class="stack" style="justify-items:center"><p class="${S.loadError ? "err" : "dim"}">${esc(S.loadError || "Loading...")}</p>${S.loadError ? `<button type="button" class="btn" data-act="reload">Try again</button>` : ""}</div></div></main>`;
      if (!S.loading && !S.loadError) load();
      return;
    }
    if (S.more) return renderMore();
    if (S.schedule) return renderSchedule();
    if (S.open) return renderOpen();
    if (S.ads) return renderAds();
    return renderMain();
  }
  function busy() {
    const a = document.activeElement;
    return !!(S.open || S.schedule || S.more || P.el || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
  }

  /* ------------------------------------------------------------ doing things */

  async function move(id, dir, extra, undoing) {
    const idea = find(id);
    if (!idea) return;
    let optimistic;
    try { optimistic = M.move(idea, dir, { by: S.who, now: new Date().toISOString(), today: today(), postAt: extra && extra.postAt }); } catch { optimistic = null; }
    if (optimistic) put(optimistic);
    render();
    try {
      const r = await api("move", { id, dir, postAt: extra && extra.postAt });
      put(r.idea);
      if (undoing) toast("Undone");
      else toast(dir > 0 ? (r.idea.stage === "posted" ? "Posted" : "Moved to " + M.stageLabel(r.idea.stage)) : "Moved back to " + M.stageLabel(r.idea.stage), () => move(id, -dir, null, true));
    } catch (e) {
      put(idea);
      toast(e.message);
    }
    render();
  }

  function burst(el) {
    if (calm() || !el) return;
    const r = el.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "burst";
    b.style.left = r.left + r.width / 2 + "px";
    b.style.top = r.top + r.height / 2 + "px";
    const colours = ["#4a9be8", "#f5a524", "#a98bff", "#34c77b", "#f3f6fb"];
    for (let i = 0; i < 18; i++) {
      const a = (Math.PI * 2 * i) / 18, d = 60 + Math.random() * 50;
      b.insertAdjacentHTML("beforeend", `<i style="background:${colours[i % 5]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px"></i>`);
    }
    document.body.append(b);
    setTimeout(() => b.remove(), 800);
  }

  // The tick: it fills in, the row slides off, then it's in the next list.
  function tick(id) {
    const x = find(id);
    if (!x || x.stage === "posted") return;
    if (x.stage === "edited") {
      S.schedule = { id, date: M.addDays(today(), 1), time: "18:00", msg: "" };
      return render();
    }
    const el = app.querySelector(`[data-item="${id}"]`);
    buzz(25);
    if (!el || calm()) return move(id, 1);
    el.classList.add("ticked");
    if (x.stage === "scheduled") burst(el.querySelector(".tick"));
    setTimeout(() => el.classList.add("gone"), 260);
    setTimeout(() => move(id, 1), 480);
  }

  // The ad card's tick is its idea's tick. An ad with no idea yet gets one from the server.
  async function adStep(adId) {
    const ad = findAd(adId);
    if (!ad) return;
    const x = adIdeaOf(ad);
    if (x && x.stage === "posted") return;
    if (x && x.stage === "edited") {
      S.schedule = { id: x.id, date: M.addDays(today(), 1), time: "18:00", msg: "" };
      return render();
    }
    buzz(25);
    const card = app.querySelector(`.adcard[data-ad="${adId}"]`);
    if (card && !calm()) { card.classList.add("ticked"); await new Promise((r) => setTimeout(r, 260)); }
    if (x) return move(x.id, 1);
    try {
      const r = await api("adMove", { adId, dir: 1 });
      put(r.idea);
      toast("Moved to " + M.stageLabel(r.idea.stage), () => move(r.idea.id, -1, null, true));
    } catch (e) { toast(e.message); }
    render();
  }

  async function toggleTick(scope, item) {
    if (!S.data) return;
    const key = tickKey(scope, item);
    const had = tickOf(scope, item);
    const mine = had ? null : { scope, item, by: S.who, at: new Date().toISOString() };
    S.pendingTicks.set(key, mine);
    S.data.ticks = withPending(S.data.ticks);
    buzz(12);
    render();
    try {
      await api("tick", { scope, item, on: !had });
    } catch (e) {
      if (S.pendingTicks.get(key) === mine) {
        S.pendingTicks.delete(key);
        S.data.ticks = S.data.ticks.filter((t) => tickKey(t.scope, t.item) !== key).concat(had ? [had] : []);
      }
      toast(e.message);
      return render();
    }
    if (S.pendingTicks.get(key) === mine) S.pendingTicks.delete(key);
  }

  async function kitReset() {
    if (!S.kitConfirm) {
      S.kitConfirm = true;
      render();
      setTimeout(() => { if (S.kitConfirm) { S.kitConfirm = false; render(); } }, 4000);
      return;
    }
    S.kitConfirm = false;
    const before = S.data.ticks;
    [...S.pendingTicks.keys()].forEach((k) => { if (k.startsWith("kit\n")) S.pendingTicks.delete(k); });
    S.data.ticks = before.filter((t) => t.scope !== "kit");
    render();
    try {
      await api("tickReset", { scope: "kit" });
      toast("Kit list reset");
    } catch (e) {
      S.data.ticks = before;
      toast(e.message);
      render();
    }
  }

  async function addIdea(series) {
    const title = (series ? S.seriesDraft[series] || "" : S.draft).trim();
    if (!title || S.adding) return;
    S.adding = true;
    try {
      const r = await api("saveIdea", { fields: { title, series: series || "" } });
      put(r.idea);
      if (series) S.seriesDraft[series] = ""; else S.draft = "";
      buzz(15);
    } catch (e) { toast(e.message); }
    S.adding = false;
    render();
    const input = series ? [...app.querySelectorAll('[data-draft="addSeries"]')].find((el) => el.dataset.series === series) : app.querySelector('[data-draft="add"]');
    if (input) input.focus();
  }

  function openIdea(id) {
    const x = find(id);
    if (!x) return;
    S.open = { id, msg: "", confirm: false, fields: {
      title: x.title, notes: x.notes || "", caption: x.caption || "", link: x.link || "", series: x.series || "", tags: (x.tags || []).join(", "), who: x.who || "", when: x.when || "",
      postDate: x.postAt ? x.postAt.slice(0, 10) : "", postTime: x.postAt ? x.postAt.slice(11, 16) : "",
    } };
    render();
    window.scrollTo(0, 0);
  }

  async function saveOpen() {
    const o = S.open;
    const f = o.fields;
    if (!f.title.trim()) { o.msg = "Give it a name."; return render(); }
    const x = find(o.id);
    const fields = { title: f.title, notes: f.notes, caption: f.caption, link: f.link, series: f.series, tags: f.tags };
    if (x.stage === "scheduled") {
      if (!f.postDate || !f.postTime) { o.msg = "Pick the day and time it goes up."; return render(); }
      fields.postAt = f.postDate + "T" + f.postTime;
      fields.when = f.postDate;
    } else if (x.stage !== "posted") {
      fields.who = f.who || null;
      fields.when = f.when || null;
    }
    S.saving = true; o.msg = "";
    render();
    try {
      const r = await api("saveIdea", { id: o.id, fields });
      put(r.idea);
      S.open = null;
      toast("Saved");
    } catch (e) { o.msg = e.message; }
    S.saving = false;
    render();
  }

  async function importData(text) {
    let data;
    try { data = JSON.parse(text); } catch { S.importMsg = "That isn't a JSON file. Check it's imperium_film_ideas.json."; return render(); }
    S.importMsg = "Importing...";
    render();
    try {
      const r = await api("import", { data });
      S.importMsg = `Added ${plural(r.added, "idea", "ideas")}.` + (r.skipped ? ` ${plural(r.skipped, "was", "were")} already on the list.` : "") + (r.bad ? ` ${plural(r.bad, "had", "had")} no title.` : "");
      S.importText = "";
      await load(true);
    } catch (e) { S.importMsg = e.message; }
    render();
  }

  /* ------------------------------------------------------------ phone reminders */

  const standalone = () => (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const b64ToBytes = (b64) => {
    const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  };
  async function pushReg() {
    if (!("serviceWorker" in navigator)) return null;
    try { return await navigator.serviceWorker.ready; } catch { return null; }
  }
  async function checkPush() {
    const prev = S.push.state;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!ok) S.push.state = isIOS() && !standalone() ? "needs-home" : "unsupported";
    else if (Notification.permission === "denied") S.push.state = "blocked";
    else {
      const reg = await pushReg();
      const sub = reg && (await reg.pushManager.getSubscription());
      S.push.state = sub && Notification.permission === "granted" ? "on" : "off";
      // Keep the server's note of whose phone this is up to date.
      if (sub && S.who) api("pushSubscribe", { sub: sub.toJSON() }).catch(() => {});
    }
    if (prev !== S.push.state && !busy()) render();
    else if (S.more) render();
  }
  async function pushOn() {
    S.push.msg = "";
    try {
      // Asked straight from the tap, or iPhones say no without asking.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { S.push.state = perm === "denied" ? "blocked" : "off"; return render(); }
      const reg = await pushReg();
      if (!reg) throw new Error("This phone can't do reminders.");
      const { key } = await api("pushKey");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      await api("pushSubscribe", { sub: sub.toJSON() });
      S.push.state = "on";
      S.push.msg = "Reminders are on.";
      api("pushTest", { endpoint: sub.endpoint }).catch(() => {});
    } catch (e) {
      S.push.msg = e.message || "Couldn't turn reminders on.";
    }
    render();
  }
  async function pushOff() {
    const reg = await pushReg();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      api("pushUnsubscribe", { endpoint: sub.endpoint }).catch(() => {});
      try { await sub.unsubscribe(); } catch { /* fine */ }
    }
    S.push = { state: "off", msg: "Reminders are off for this phone." };
    render();
  }

  /* ------------------------------------------------------------ events */

  app.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case "pickWho": S.who = b.dataset.who; local.set("who", S.who); render(); checkPush(); window.scrollTo(0, 0); break;
      case "switch": S.who = null; S.more = false; local.set("who", null); render(); break;
      case "reload": S.loadError = ""; render(); break;
      case "list": S.list = id; S.showPosted = false; local.set("list", id); render(); break;
      case "posted": S.showPosted = !S.showPosted; render(); break;
      case "series": {
        const name = b.dataset.value;
        if (S.openSeries.has(name)) S.openSeries.delete(name); else S.openSeries.add(name);
        local.set("openSeries", JSON.stringify([...S.openSeries]));
        render();
        break;
      }
      case "tick": tick(id); break;
      case "open": openIdea(id); break;
      case "close": S.open = null; render(); break;
      case "pick": {
        const f = S.open.fields;
        f[b.dataset.field] = f[b.dataset.field] === b.dataset.value && b.dataset.field === "who" ? "" : b.dataset.value;
        render();
        break;
      }
      case "copy": toast((await copyText(S.open.fields.caption)) ? "Caption copied" : "Couldn't copy it."); break;
      case "back": S.open = null; move(id, -1); break;
      case "delete": {
        if (!S.open.confirm) { S.open.confirm = true; render(); setTimeout(() => { if (S.open) { S.open.confirm = false; render(); } }, 4000); break; }
        const gone = S.open.id;
        try {
          await api("deleteIdea", { id: gone });
          S.data.ideas = S.data.ideas.filter((x) => x.id !== gone);
          S.open = null;
          toast("Deleted");
        } catch (e) { S.open.msg = e.message; }
        render();
        break;
      }
      case "quick": S.schedule.date = b.dataset.date; S.schedule.time = b.dataset.time; render(); break;
      case "scheduleClose": S.schedule = null; render(); break;
      case "scheduleGo": {
        const s = S.schedule;
        if (!s.date || !s.time) { s.msg = "Pick the day and time."; return render(); }
        const sx = find(s.id);
        const sad = sx && sx.adId ? findAd(sx.adId) : null;
        if (sad && has(sad.checks) && !tickOf(sad.id + ":checked", "checked")) { s.msg = "Tick \u201cI've checked these\u201d first."; return render(); }
        S.schedule = null;
        buzz(25);
        move(s.id, 1, { postAt: s.date + "T" + s.time });
        break;
      }
      case "more": S.more = true; render(); checkPush(); window.scrollTo(0, 0); break;
      case "moreClose": S.more = false; render(); break;
      case "pushOn": pushOn(); break;
      case "pushOff": pushOff(); break;
      case "pushTest": {
        const reg = await pushReg();
        const sub = reg && (await reg.pushManager.getSubscription());
        try {
          if (!sub) throw new Error("Reminders aren't on for this phone.");
          await api("pushTest", { endpoint: sub.endpoint });
          S.push.msg = "Test sent. It should pop up in a few seconds.";
        } catch (e) { S.push.msg = e.message; }
        render();
        break;
      }
      case "importPaste": importData(S.importText); break;
      // Ad filming
      case "adsOpen": goAds({ view: "list" }); render(); window.scrollTo(0, 0); loadAds(); break;
      case "adsClose": goAds(null); render(); window.scrollTo(0, 0); break;
      case "adOpen": case "adView":
        S.adListY = window.scrollY;
        S.kitConfirm = false;
        goAds(b.dataset.act === "adOpen" ? { view: "ad", id } : { view: b.dataset.value });
        render();
        window.scrollTo(0, 0);
        break;
      case "adsBack": goAds({ view: "list" }); render(); window.scrollTo(0, S.adListY || 0); break;
      case "adFromIdea": S.open = null; S.backY = 0; goAds({ view: "ad", id: b.dataset.value }); render(); break;
      case "adStep": adStep(id); break;
      case "adBack": { const x = adIdeaOf(findAd(id)); if (x) move(x.id, -1); break; }
      case "adTick": toggleTick(b.dataset.scope, b.dataset.value); break;
      case "adFold": {
        const k = b.dataset.value;
        if (S.adFold.has(k)) S.adFold.delete(k); else S.adFold.add(k);
        local.set("adFold", JSON.stringify([...S.adFold]));
        render();
        break;
      }
      case "adCopy": toast((await copyText(b.dataset.value)) ? b.dataset.what || "Copied" : "Couldn't copy it."); break;
      case "prompter": openPrompter(findAd(id), b.dataset.value); break;
      case "kitReset": kitReset(); break;
      case "adRetry": S.adError = ""; render(); break;
    }
  });

  app.addEventListener("submit", (ev) => {
    const form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    if (form.dataset.form === "add") return addIdea();
    if (form.dataset.form === "addSeries") return addIdea(form.dataset.series);
    if (form.dataset.form === "idea") return saveOpen();
  });
  app.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.draft === "add") S.draft = el.value;
    else if (el.dataset.draft === "addSeries") S.seriesDraft[el.dataset.series] = el.value;
    else if (el.dataset.draft === "importText") S.importText = el.value;
    else if (el.dataset.f && S.open) S.open.fields[el.dataset.f] = el.value;
    else if (el.dataset.s && S.schedule) S.schedule[el.dataset.s] = el.value;
  });
  app.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.f === "when" && S.open) { S.open.fields.when = el.value; render(); }
    else if (el.dataset.change === "importFile" && el.files && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => importData(String(reader.result || ""));
      reader.readAsText(el.files[0]);
    }
  });

  // A fresh list when the app comes back to the front, and every minute while it's open.
  // On the ad screens it's every 15 seconds, so a tick on one phone soon shows on the other.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (P.el) keepAwake(true); // the phone drops the screen lock when the app goes to the back
    if (S.who && !busy()) load(true);
  });
  let beats = 0;
  setInterval(() => { beats++; if (document.visibilityState === "visible" && S.who && !busy() && (S.ads || beats % 4 === 0)) load(true); }, 15000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/film/sw.js", { scope: "/film/" }).catch(() => { /* fine without */ });

  render();
  if (S.who) checkPush();
  loadAds();
})();
