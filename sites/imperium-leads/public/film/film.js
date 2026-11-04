/*
  Imperium Film List: the page. Four lists (Ideas, Filmed, Edited, Scheduled) and a tick that
  moves an idea to the next one. A "Today" box shows what's yours to do, and phone reminders
  send the same thing every morning. The rules are in film-model.js.
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
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const nowLocal = () => M.localNow(new Date());
  const today = () => nowLocal().slice(0, 10);

  const S = {
    who: window.FilmModel.cleanPerson(local.get("who")),
    data: null, loading: false, loadError: "",
    list: LISTS.includes(local.get("list")) ? local.get("list") : "tofilm",
    showPosted: false,
    tag: local.get("tag") || "",   // a series filter, like "Does it foam?"
    draft: "", adding: false,
    open: null,        // the idea being edited: { id, fields, msg, confirm }
    schedule: null,    // picking when it goes up: { id, date, time, msg }
    more: false, importMsg: "", importText: "",
    push: { state: "unknown", msg: "" },
    saving: false,
  };
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
      S.data = { ideas: r.ideas };
      S.loadError = "";
    } catch (e) {
      S.loadError = e.message;
    } finally {
      S.loading = false;
    }
    if (!quiet || !busy()) render();
  }
  const find = (id) => (S.data ? S.data.ideas.find((x) => x.id === id) : null);
  function put(idea) {
    const i = S.data.ideas.findIndex((x) => x.id === idea.id);
    if (i >= 0) S.data.ideas[i] = idea;
    else S.data.ideas.unshift(idea);
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

  function itemHTML(x) {
    const st = M.stage(x.stage);
    const meta = metaLine(x);
    const tickLabel = st.next ? `${st.next}: ${x.title}` : x.title;
    return `<li class="item" data-item="${x.id}" data-stage="${x.stage}">
      <button type="button" class="tick" data-act="tick" data-id="${x.id}" aria-label="${esc(tickLabel)}"></button>
      <button type="button" class="open" data-act="open" data-id="${x.id}"><span class="t">${esc(x.title)}</span>${(x.tags || []).length && !S.tag ? `<span class="tg">${x.tags.map(esc).join(", ")}</span>` : ""}${meta ? `<span class="m">${meta}</span>` : ""}</button>
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

  function renderMain() {
    const tags = M.tagsIn(S.data.ideas);
    if (S.tag && !tags.some((t) => t.tag === S.tag)) { S.tag = ""; local.set("tag", null); }
    const pool = S.tag ? S.data.ideas.filter((x) => M.hasTag(x, S.tag)) : S.data.ideas;
    const counts = M.countByStage(pool);
    const mine = M.remindersFor(S.data.ideas, S.who, nowLocal());
    const kindOf = { tofilm: "film", filmed: "edit", edited: "schedule", scheduled: "post" };
    const cur = S.showPosted ? "posted" : S.list;
    const st = M.stage(cur);
    const items = pool.filter((x) => x.stage === cur);
    if (cur === "scheduled") items.sort((a, b) => String(a.postAt).localeCompare(String(b.postAt)));
    else if (cur === "posted") items.sort((a, b) => String(b.postedDay || b.updatedAt).localeCompare(String(a.postedDay || a.updatedAt)));
    else items.sort((a, b) => (a.when ? 0 : 1) - (b.when ? 0 : 1) || String(a.when || "").localeCompare(String(b.when || "")) || String(a.createdAt).localeCompare(String(b.createdAt)) || byTitle(a, b));
    const how = { tofilm: "Tick it when it's filmed", filmed: "Tick it when it's edited", edited: "Tick to pick when it goes up", scheduled: "Tick it once it's posted", posted: "Done and dusted" }[cur];
    app.innerHTML = `${header()}<main data-stage="${cur}"><div class="wrap">
      ${S.loadError ? `<p class="err" role="alert" style="margin:10px 0">${esc(S.loadError)}</p>` : ""}
      ${todayHTML()}
      <nav class="lists" aria-label="Lists">${LISTS.map((id) => `<button type="button" data-stage="${id}" data-act="list" data-id="${id}" aria-pressed="${!S.showPosted && S.list === id}"><b>${counts[id]}</b><span>${esc(M.stageLabel(id))}</span>${mine.some((r) => r.kind === kindOf[id]) ? `<i aria-label="Something here is yours today"></i>` : ""}</button>`).join("")}</nav>
      ${tags.length ? `<div class="chips filter" role="group" aria-label="Show"><button type="button" class="chip" data-act="tag" data-value="" aria-pressed="${!S.tag}">All</button>${tags.map((t) => `<button type="button" class="chip" data-act="tag" data-value="${esc(t.tag)}" aria-pressed="${S.tag === t.tag}">${esc(t.tag)} <span class="n">${t.count}</span></button>`).join("")}</div>` : ""}
      <div class="list-head"><h1>${esc(st.label)}</h1><p>${esc(S.tag ? S.tag : how)}</p></div>
      ${cur === "tofilm" ? `<form class="add" data-form="add"><input name="title" autocomplete="off" enterkeyhint="done" placeholder="${S.tag ? "Add a " + esc(S.tag) + " idea" : "Write down an idea"}" value="${esc(S.draft)}" data-draft="add" aria-label="New idea"><button type="submit" aria-label="Add the idea" ${S.adding ? "disabled" : ""}>${ICON.plus}</button></form>` : ""}
      ${items.length ? `<ul class="items ${cur === "posted" ? "posted" : ""}" style="list-style:none;margin:0;padding:0">${items.map(itemHTML).join("")}</ul>` : `<div class="empty"><h2>Empty</h2><p>${S.tag ? `No ${esc(S.tag)} ideas in ${esc(st.label)}.` : esc(st.empty)}</p></div>`}
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
      ${step}
      <label class="field"><span>Notes <em>(hook, shots, anything)</em></span><textarea data-f="notes" rows="4" placeholder="The hook, the shots, who's in it">${esc(f.notes)}</textarea></label>
      <label class="field"><span>Caption <em>(optional)</em></span><textarea data-f="caption" rows="2" placeholder="Statements, not questions">${esc(f.caption)}</textarea>${f.caption ? `<button type="button" class="btn sm" data-act="copy" style="justify-self:start">Copy the caption</button>` : ""}</label>
      <label class="field"><span>Tags <em>(optional, a comma between them)</em></span><input data-f="tags" value="${esc(f.tags)}" placeholder="Does it foam?" autocomplete="off"></label>
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
    const quick = [[t, "18:00", "Today 6pm"], [M.addDays(t, 1), "12:00", "Tomorrow 12pm"], [M.addDays(t, 1), "18:00", "Tomorrow 6pm"], [M.addDays(t, 2), "18:00", M.dayLabel(M.addDays(t, 2), t) + " 6pm"]]
      .filter(([d, h]) => d + "T" + h > now); // nothing that's already gone by
    app.innerHTML = `<div class="sheet" data-stage="scheduled">${sheetHead("When does it go up?", "scheduleClose", "Cancel")}<div class="wrap"><div class="body">
      <p style="font-weight:700;font-size:20px">${esc(x.title)}</p>
      <div class="chips">${quick.map(([d, h, l]) => `<button type="button" class="chip" data-act="quick" data-date="${d}" data-time="${h}" aria-pressed="${s.date === d && s.time === h}">${esc(l)}</button>`).join("")}</div>
      <div class="pair"><label class="field"><span>Day</span><input type="date" data-s="date" value="${esc(s.date)}"></label><label class="field"><span>Time</span><input type="time" data-s="time" value="${esc(s.time)}"></label></div>
      ${s.msg ? `<p class="err" role="alert">${esc(s.msg)}</p>` : ""}
      <button type="button" class="btn go wide" data-act="scheduleGo" ${S.saving ? "disabled" : ""}>Schedule it</button>
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

  function render() {
    const sheet = S.open || S.schedule || S.more;
    document.body.classList.toggle("locked", !!sheet);
    if (!S.who) return renderWho();
    if (!S.data) {
      app.innerHTML = `${header()}<main><div class="wrap boot"><div class="stack" style="justify-items:center"><p class="${S.loadError ? "err" : "dim"}">${esc(S.loadError || "Loading...")}</p>${S.loadError ? `<button type="button" class="btn" data-act="reload">Try again</button>` : ""}</div></div></main>`;
      if (!S.loading && !S.loadError) load();
      return;
    }
    if (S.more) return renderMore();
    if (S.schedule) return renderSchedule();
    if (S.open) return renderOpen();
    return renderMain();
  }
  function busy() {
    const a = document.activeElement;
    return !!(S.open || S.schedule || S.more || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
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

  async function addIdea() {
    const title = S.draft.trim();
    if (!title || S.adding) return;
    S.adding = true;
    try {
      // Added while a series is showing: it's part of that series.
      const r = await api("saveIdea", { fields: { title, tags: S.tag ? [S.tag] : [] } });
      put(r.idea);
      S.draft = "";
      buzz(15);
    } catch (e) { toast(e.message); }
    S.adding = false;
    render();
    const input = app.querySelector('[data-draft="add"]');
    if (input) input.focus();
  }

  function openIdea(id) {
    const x = find(id);
    if (!x) return;
    S.open = { id, msg: "", confirm: false, fields: {
      title: x.title, notes: x.notes || "", caption: x.caption || "", link: x.link || "", tags: (x.tags || []).join(", "), who: x.who || "", when: x.when || "",
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
    const fields = { title: f.title, notes: f.notes, caption: f.caption, link: f.link, tags: f.tags };
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
      case "tag": S.tag = b.dataset.value; local.set("tag", S.tag || null); render(); break;
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
    }
  });

  app.addEventListener("submit", (ev) => {
    const form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    if (form.dataset.form === "add") return addIdea();
    if (form.dataset.form === "idea") return saveOpen();
  });
  app.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.draft === "add") S.draft = el.value;
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
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.who && !busy()) load(true); });
  setInterval(() => { if (document.visibilityState === "visible" && S.who && !busy()) load(true); }, 60000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/film/sw.js", { scope: "/film/" }).catch(() => { /* fine without */ });

  render();
  if (S.who) checkPush();
})();
