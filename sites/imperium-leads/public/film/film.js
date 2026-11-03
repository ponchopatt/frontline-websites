/*
  Imperium Film List: the page. Everything it shows is drawn here from S (the state) and the
  list from /api/film; the rules (stages, Today, the numbers) are in film-model.js.

  No PIN: open it, pick your name. The crew's only screen is Today. The owner gets
  Inbox, Board, Today, Numbers and More along the bottom.
*/
(() => {
  "use strict";
  const M = window.FilmModel;
  const app = document.getElementById("app");
  const TZ = "Australia/Sydney";
  const QUICK_TAGS = ["hook idea", "B-roll idea", "trend", "skit"];

  const local = {
    get(k) { try { return localStorage.getItem("film." + k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem("film." + k) : localStorage.setItem("film." + k, v); } catch { /* private mode */ } },
  };
  const readJSON = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const today = () => M.dayIn(new Date(), TZ);
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  const S = {
    who: local.get("who"),
    data: null, loading: false, loadError: "",
    tab: local.get("tab") || "board", stage: "tofilm", fType: "", fTag: "", fPerson: "",
    inboxFilter: "all", todayPerson: M.CREW[0],
    editing: null, draft: { url: "", note: "" }, inboxMsg: "", importMsg: "", importText: "",
    ticks: readJSON(local.get("ticks"), {}), confirm: null, saving: false,
  };
  const isOwner = () => S.who === M.OWNER;
  // Left over from when it had a PIN.
  local.set("token", null); local.set("role", null);

  /* ------------------------------------------------------------ server */

  async function api(action, payload) {
    const res = await fetch("/api/film", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, who: S.who, ...(payload || {}) }),
    });
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) {
      const e = new Error((body && body.error) || "Something went wrong. Check your signal and try again.");
      e.body = body;
      throw e;
    }
    return body;
  }

  async function load(quiet) {
    if (S.loading) return;
    S.loading = true;
    try {
      const r = await api("list");
      S.data = { inspo: r.inspo, ideas: r.ideas, settings: r.settings };
      S.loadError = "";
    } catch (e) {
      S.loadError = e.message;
    } finally {
      S.loading = false;
    }
    if (!quiet || !busyTyping()) render();
  }
  const find = (id) => (S.data ? S.data.ideas.find((x) => x.id === id) : null);
  const findInspo = (id) => (S.data ? S.data.inspo.find((x) => x.id === id) : null);
  function putIdea(idea) {
    const i = S.data.ideas.findIndex((x) => x.id === idea.id);
    if (i >= 0) S.data.ideas[i] = idea;
    else S.data.ideas.unshift(idea);
  }
  function putInspo(inspo) {
    if (!inspo) return;
    const i = S.data.inspo.findIndex((x) => x.id === inspo.id);
    if (i >= 0) S.data.inspo[i] = inspo;
    else S.data.inspo.unshift(inspo);
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
    toastTimer = setTimeout(() => { toastEl.hidden = true; toastFn = null; }, undo ? 9000 : 3500);
  }
  toastUndo.addEventListener("click", () => {
    const fn = toastFn;
    toastEl.hidden = true;
    toastFn = null;
    if (fn) fn();
  });

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* old browser */ }
      ta.remove();
      return ok;
    }
  }

  /* ------------------------------------------------------------ TikTok previews */

  // TikTok answers a phone's browser directly (it allows any site to ask), so the preview is
  // fetched here when it can be, and the server's copy is only a fallback.
  async function tiktokPreview(url) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch("https://www.tiktok.com/oembed?url=" + encodeURIComponent(url), { signal: ctl.signal });
      clearTimeout(t);
      return res.ok ? M.cleanMeta(await res.json()) : null;
    } catch {
      return null;
    }
  }
  const triedPreview = new Set();
  async function refreshPreview(x, force) {
    if (!x || x.platform !== "tiktok" || M.isShortTikTok(x.url)) return;
    if (triedPreview.has(x.id) && !force) return;
    triedPreview.add(x.id);
    const meta = await tiktokPreview(x.url);
    if (!meta || !(meta.thumb || meta.title)) return;
    try {
      const r = await api("setMeta", { id: x.id, meta });
      putInspo(r.inspo);
      if (!busyTyping()) render();
    } catch { /* keep what we have */ }
  }
  // TikTok's thumbnail links expire after a while: when one stops loading, ask for a fresh one.
  app.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.refresh) {
      img.parentNode.innerHTML = PLAY;
      refreshPreview(findInspo(img.dataset.refresh), true);
    }
  }, true);

  /* ------------------------------------------------------------ bits of page */

  const PLAY = '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 8.5v7l6-3.5z" fill="currentColor"/></svg>';
  const dayLong = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  function header(right) {
    return `<header class="top"><div class="wrap top-in"><span class="brand"><img src="/film/icon-192.png" alt="">Film List</span><div class="me">${right || ""}</div></div></header>`;
  }
  function dueTag(x, t) {
    if (!x.due) return "";
    const cls = x.due < t ? "late" : x.due === t ? "today" : "";
    return `<span class="tag ${cls}">${esc(M.dueLabel(x.due, t))}</span>`;
  }
  function chip(key, value, label, n) {
    return `<button type="button" class="chip" data-act="set" data-key="${key}" data-value="${esc(value)}" aria-pressed="${S[key] === value}">${esc(label)}${n != null ? ` <span class="n">${n}</span>` : ""}</button>`;
  }
  function nextButton(x, size) {
    const n = M.nextLabel(x);
    if (!n) return "";
    const label = x.stage === "tofilm" ? "Filmed it" : "Mark as " + n.toLowerCase();
    return `<button type="button" class="btn wide ${size || ""}" data-act="next" data-id="${x.id}">${label}</button>`;
  }
  function confirming(key) { return S.confirm && S.confirm.key === key && S.confirm.until > Date.now(); }

  function goalHTML(t) {
    const target = (S.data.settings && S.data.settings.weeklyTarget) || M.DEFAULT_TARGET;
    const done = M.postedThisWeek(S.data.ideas, t);
    const pct = Math.min(100, Math.round((done / target) * 100));
    return `<div class="card goal"><div class="goal-top"><span class="goal-num">${done} of ${target} posted</span><span class="dim small">this week</span></div>
      <div class="bar ${done >= target ? "done" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${done}" aria-label="${done} of ${target} posted this week"><i style="width:${pct}%"></i></div></div>`;
  }

  // The card the crew film from: big title, hook, the shots to tick, and one big button.
  function filmCard(x, t) {
    const ticks = S.ticks[x.id] || [];
    const meta = [x.people ? plural(x.people, "person", "people") : "", x.length ? esc(x.length) : ""].filter(Boolean);
    return `<article class="card focus">
      <div class="block"><h2 class="card-title">${esc(x.title)}</h2>
        <div class="tags">${x.type ? `<span class="tag type">${esc(x.type)}</span>` : ""}${dueTag(x, t)}</div>
        ${meta.length ? `<div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}</div>
      ${x.hook ? `<div class="block"><span class="label">Hook</span><p class="hook">${esc(x.hook)}</p></div>` : ""}
      ${x.steps && x.steps.length ? `<div class="block"><span class="label">Shots</span><ul class="steps">${x.steps.map((s, i) => `<li><button type="button" data-act="tick" data-id="${x.id}" data-i="${i}" aria-pressed="${ticks.includes(i)}"><span class="box"></span><span>${esc(s)}</span></button></li>`).join("")}</ul></div>` : ""}
      ${x.link || x.caption ? `<div class="btns">${x.link ? `<a class="btn ghost" href="${esc(x.link)}" target="_blank" rel="noopener">Watch the example</a>` : ""}${x.caption ? `<button type="button" class="btn ghost" data-act="copy" data-id="${x.id}">Copy caption</button>` : ""}</div>` : ""}
      ${nextButton(x, "big")}
    </article>`;
  }
  function upRow(x, t) {
    return `<div class="card"><div class="row"><div class="grow"><p class="card-title sm">${esc(x.title)}</p><p class="dim small">${esc(x.due ? M.dueLabel(x.due, t) : "No date yet")}${x.type ? ", " + esc(x.type) : ""}</p></div></div></div>`;
  }
  function todayHTML(person, mine) {
    const t = today();
    const list = M.todayFor(S.data.ideas, person, t);
    const up = M.upcomingFor(S.data.ideas, person, t);
    const head = `<div class="page-head"><h1>${mine ? "Today" : esc(person) + "&rsquo;s day"}</h1><p class="soft">${esc(dayLong(t))}${list.length ? ". " + plural(list.length, "video", "videos") + " to film." : "."}</p></div>`;
    const cards = list.length
      ? list.map((x) => filmCard(x, t)).join("")
      : `<div class="empty"><h2>All clear</h2><p class="soft">Nothing to film today.${up.length ? " What's next is below." : ""}</p></div>`;
    const later = up.length ? `<section class="stack" style="margin-top:28px"><h2>Coming up</h2>${up.slice(0, 12).map((x) => upRow(x, t)).join("")}</section>` : "";
    return head + `<div class="stack">${cards}</div>` + later;
  }

  function reelCard(x) {
    const used = (x.ideaIds || []).map(find).filter(Boolean);
    const tt = x.platform === "tiktok";
    const ig = x.platform === "instagram";
    const thumb = tt && x.meta && x.meta.thumb
      ? `<div class="thumb"><img src="${esc(x.meta.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-refresh="${x.id}"></div>`
      : `<div class="thumb ${ig ? "ig" : ""}">${PLAY}</div>`;
    const author = tt ? (x.meta && x.meta.author) || M.tiktokHandle(x.url) : "";
    const del = "deleteInspo:" + x.id;
    return `<article class="card"><div class="reel">${thumb}<div class="reel-text">
        <div class="tags"><span class="tag">${tt ? "TikTok" : ig ? "Instagram" : "Link"}</span>${author ? `<span class="dim small">${esc(author)}</span>` : ""}</div>
        ${tt && x.meta && x.meta.title ? `<p class="clamp">${esc(x.meta.title)}</p>` : ""}
        ${x.note ? `<p><strong>Why:</strong> ${esc(x.note)}</p>` : ""}
        ${used.length ? `<p class="used">Made into: ${used.map((i) => esc(i.title)).join(", ")}</p>` : ""}
      </div></div>
      <div class="btns"><a class="btn ghost" href="${esc(x.url)}" target="_blank" rel="noopener">Watch the example</a><button type="button" class="btn" data-act="makeOurs" data-id="${x.id}">Make it ours</button></div>
      <button type="button" class="link-btn small" data-act="deleteInspo" data-id="${x.id}">${confirming(del) ? "Tap again to delete it" : "Delete"}</button>
    </article>`;
  }

  function boardCard(x, t) {
    const back = x.stage !== "tofilm";
    return `<article class="card">
      <div class="block"><h3 class="card-title sm">${esc(x.title)}</h3>
        <div class="tags">${x.type ? `<span class="tag type">${esc(x.type)}</span>` : ""}<span class="tag">${esc(x.assignee || "Not assigned")}</span>${dueTag(x, t)}${(x.tags || []).map((g) => `<span class="tag">${esc(g)}</span>`).join("")}</div></div>
      ${x.hook ? `<p class="soft">${esc(x.hook)}</p>` : ""}
      ${x.stage === "posted" ? `<form class="row" data-form="views" data-id="${x.id}"><label class="field grow"><span>Views</span><input name="views" type="number" inputmode="numeric" min="0" placeholder="How many views?" value="${x.views == null ? "" : x.views}"></label><button class="btn sm" type="submit" style="align-self:end">Save</button></form>` : nextButton(x)}
      <div class="row"><button type="button" class="btn sm quiet" data-act="edit" data-id="${x.id}">Edit</button>${x.caption ? `<button type="button" class="btn sm quiet" data-act="copy" data-id="${x.id}">Copy caption</button>` : ""}${x.link ? `<a class="btn sm quiet" href="${esc(x.link)}" target="_blank" rel="noopener">Watch the example</a>` : ""}${back ? `<button type="button" class="btn sm ghost" data-act="back" data-id="${x.id}">Move back</button>` : ""}</div>
    </article>`;
  }

  /* ------------------------------------------------------------ screens */

  function renderWho() {
    app.innerHTML = `${header("")}<main><div class="wrap stack">
      <div class="page-head"><h1>Who are you?</h1><p class="soft">Pick your name. This phone remembers it.</p></div>
      <div class="who">${M.CREW.map((p) => `<button type="button" class="btn quiet" data-act="pickWho" data-who="${p}">${p}</button>`).join("")}
        <button type="button" class="btn ghost" data-act="pickWho" data-who="${M.OWNER}">I&rsquo;m the owner</button></div>
    </div></main>`;
  }

  function renderCrew() {
    app.innerHTML = `${header(`<button type="button" class="btn sm ghost" data-act="switch" aria-label="Not ${esc(S.who)}? Switch person">${esc(S.who)}</button>`)}
      <main><div class="wrap">${S.loadError ? `<p class="err" role="alert">${esc(S.loadError)}</p>` : ""}${todayHTML(S.who, true)}</div></main>`;
  }

  const ICONS = {
    inbox: '<path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/>',
    board: '<rect x="4" y="4" width="4.5" height="16" rx="1"/><rect x="10" y="4" width="4.5" height="11" rx="1"/><rect x="16" y="4" width="4" height="7" rx="1"/>',
    today: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    stats: '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    more: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
  };
  const TABS = [["inbox", "Inbox"], ["board", "Board"], ["today", "Today"], ["stats", "Numbers"], ["more", "More"]];

  function renderOwner() {
    const t = today();
    let body = "";
    if (S.tab === "inbox") body = inboxHTML();
    else if (S.tab === "today") {
      body = `<div class="chips" role="group" aria-label="Whose day" style="margin-bottom:14px">${M.PEOPLE.map((p) => chip("todayPerson", p, p, M.todayFor(S.data.ideas, p, t).length)).join("")}</div>` + todayHTML(S.todayPerson, false);
    } else if (S.tab === "stats") body = statsHTML(t);
    else if (S.tab === "more") body = moreHTML();
    else body = boardHTML(t);
    app.innerHTML = `${header(`<span class="dim small">Owner</span>`)}
      <main><div class="wrap">${S.loadError ? `<p class="err" role="alert">${esc(S.loadError)}</p>` : ""}${body}</div></main>
      <nav class="tabs" aria-label="Sections">${TABS.map(([id, label]) => `<button type="button" data-act="tab" data-tab="${id}" ${S.tab === id ? 'aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>${label}</button>`).join("")}</nav>`;
    if (S.tab === "inbox") S.data.inspo.forEach((x) => { if (x.platform === "tiktok" && !(x.meta && x.meta.thumb)) refreshPreview(x); });
  }

  function inboxHTML() {
    const all = S.data.inspo;
    const f = S.inboxFilter;
    const n = (fn) => all.filter(fn).length;
    const unused = (x) => !(x.ideaIds || []).length;
    const list = all.filter((x) => f === "all" || (f === "unused" ? unused(x) : x.platform === f));
    return `<div class="page-head"><h1>Inbox</h1><p class="soft">Save reels you like. Turn the good ones into ideas.</p></div>
      <form class="card" data-form="inbox" style="margin-bottom:16px">
        <label class="field"><span>TikTok or Instagram link</span><input name="url" type="url" inputmode="url" autocomplete="off" placeholder="Paste the link" value="${esc(S.draft.url)}" data-draft="url"></label>
        <label class="field"><span>Why we like it <em>(optional)</em></span><input name="note" type="text" autocomplete="off" placeholder="The hook, the edit, the idea" value="${esc(S.draft.note)}" data-draft="note"></label>
        <button class="btn wide" type="submit" ${S.saving ? "disabled" : ""}>${S.saving ? "Saving..." : "Save to inbox"}</button>
        ${S.inboxMsg ? `<p class="err" role="alert">${esc(S.inboxMsg)}</p>` : ""}
      </form>
      <div class="chips" role="group" aria-label="Show" style="margin-bottom:14px">${chip("inboxFilter", "all", "All", all.length)}${chip("inboxFilter", "tiktok", "TikTok", n((x) => x.platform === "tiktok"))}${chip("inboxFilter", "instagram", "Instagram", n((x) => x.platform === "instagram"))}${chip("inboxFilter", "unused", "Not used yet", n(unused))}</div>
      <div class="stack">${list.length ? list.map(reelCard).join("") : `<div class="empty"><h2>Nothing here yet</h2><p class="soft">Paste a link above, or share a reel to the Film List from your phone (see More).</p></div>`}</div>`;
  }

  function boardHTML(t) {
    const counts = M.countByStage(S.data.ideas, S.data.inspo);
    const tags = [...new Set(S.data.ideas.flatMap((x) => x.tags || []))].sort((a, b) => a.localeCompare(b));
    const types = M.TYPES.filter((ty) => S.data.ideas.some((x) => x.type === ty));
    let cards;
    if (S.stage === "inspo") {
      cards = S.data.inspo.length ? S.data.inspo.map(reelCard).join("") : `<div class="empty"><h2>No saved reels</h2><p class="soft">Save reels in the Inbox.</p></div>`;
    } else {
      const list = S.data.ideas.filter((x) =>
        x.stage === S.stage &&
        (!S.fType || x.type === S.fType) &&
        (!S.fTag || (x.tags || []).includes(S.fTag)) &&
        (!S.fPerson || (S.fPerson === "none" ? !x.assignee : x.assignee === S.fPerson)));
      list.sort((a, b) => (a.due ? 0 : 1) - (b.due ? 0 : 1) || String(a.due || "").localeCompare(String(b.due || "")) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
      cards = list.length ? list.map((x) => boardCard(x, t)).join("") : `<div class="empty"><h2>Nothing in ${esc(M.stageLabel(S.stage))}</h2><p class="soft">${S.fType || S.fTag || S.fPerson ? "Try clearing the filters." : "Ideas land here as they move along."}</p></div>`;
    }
    const filters = S.stage === "inspo" ? "" : `<div class="row" style="margin:12px 0">
        <label class="field grow"><span class="dim small">Type</span><select data-filter="fType"><option value="">All types</option>${types.map((ty) => `<option ${S.fType === ty ? "selected" : ""}>${esc(ty)}</option>`).join("")}</select></label>
        <label class="field grow"><span class="dim small">Who</span><select data-filter="fPerson"><option value="">Anyone</option><option value="none" ${S.fPerson === "none" ? "selected" : ""}>Not assigned</option>${M.PEOPLE.map((p) => `<option ${S.fPerson === p ? "selected" : ""}>${p}</option>`).join("")}</select></label></div>
      ${tags.length ? `<div class="chips" role="group" aria-label="Tag" style="margin-bottom:14px">${chip("fTag", "", "All tags")}${tags.map((g) => chip("fTag", g, g)).join("")}</div>` : ""}`;
    return `<div class="page-head"><div class="row"><h1 class="grow">Board</h1><button type="button" class="btn sm" data-act="newIdea">New idea</button></div></div>
      ${goalHTML(t)}
      <div class="chips" role="group" aria-label="Stage" style="margin-top:16px">${M.STAGES.map((s) => chip("stage", s.id, s.label, counts[s.id])).join("")}</div>
      ${filters}
      <div class="stack" style="margin-top:12px">${cards}</div>`;
  }

  function statsHTML(t) {
    const counts = M.countByStage(S.data.ideas, S.data.inspo);
    const rows = M.statsByType(S.data.ideas);
    const target = (S.data.settings && S.data.settings.weeklyTarget) || M.DEFAULT_TARGET;
    return `<div class="page-head"><h1>Numbers</h1><p class="soft">Film more of what works.</p></div>
      <div class="stack">${goalHTML(t)}
      <form class="card row" data-form="target"><label class="field grow"><span>Weekly target</span><input name="target" type="number" inputmode="numeric" min="1" max="100" value="${target}"></label><button class="btn sm" type="submit" style="align-self:end">Save</button></form>
      <div class="counts">${M.STAGES.map((s) => `<div class="count"><b>${counts[s.id]}</b><span>${esc(s.label)}</span></div>`).join("")}</div>
      <div class="card"><h2>Views by type</h2>${rows.length ? `<table class="tbl"><thead><tr><th>Type</th><th>Posted</th><th>Avg views</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.type)}</td><td>${r.posted}</td><td>${r.avgViews == null ? "No views yet" : r.avgViews.toLocaleString("en-AU")}</td></tr>`).join("")}</tbody></table>` : `<p class="soft">Once videos are posted, add their views on the Board (Posted), and the best types show up here.</p>`}</div>
      </div>`;
  }

  function moreHTML() {
    return `<div class="page-head"><h1>More</h1></div><div class="stack">
      <div class="card"><h2>Import ideas</h2><p class="soft">Add imperium_film_ideas.json. Every idea lands in To film, not assigned. Ideas already on the list are skipped.</p>
        <label class="btn ghost wide" style="cursor:pointer">Choose the file<input type="file" accept=".json,application/json" data-act-change="importFile" hidden></label>
        <label class="field"><span>Or paste it here</span><textarea data-draft="importText" placeholder='[{"title": "Mat slap", "type": "Satisfying"}]'>${esc(S.importText)}</textarea></label>
        <button type="button" class="btn wide" data-act="importPaste">Import</button>
        ${S.importMsg ? `<p class="soft" role="status">${esc(S.importMsg)}</p>` : ""}</div>
      <div class="card"><h2>Share reels from your iPhone</h2><p class="soft">Set it up once. Then on any TikTok or Instagram reel, tap Share, then Save to Film List.</p>
        <ol class="stack" style="margin:0;padding-left:22px">
          <li>Open the <strong>Shortcuts</strong> app, tap <strong>+</strong>, and name it <strong>Save to Film List</strong>.</li>
          <li>Tap the <strong>(i)</strong> button and turn on <strong>Show in Share Sheet</strong>. Set it to receive <strong>URLs</strong> and <strong>Text</strong>.</li>
          <li>Add <strong>Ask for Input</strong> (Text). Prompt: <em>Why we like it?</em></li>
          <li>Add <strong>Get Contents of URL</strong>. URL: <code>${esc(location.origin)}/api/film</code>. Method <strong>POST</strong>. Request Body <strong>JSON</strong>: <code>action</code> = <code>inbox</code>, <code>url</code> = <strong>Shortcut Input</strong>, <code>note</code> = <strong>Provided Input</strong>.</li>
          <li>Add <strong>Get Dictionary Value</strong>: <code>message</code>, then <strong>Show Notification</strong> with it.</li>
        </ol>
        <p class="hint">It saves the link and your note only. No video is ever downloaded.</p></div>
      <div class="card"><h2>This phone</h2><p class="soft">This phone is set to the owner.</p>
        <button type="button" class="btn ghost wide" data-act="switch">Switch person</button></div>
    </div>`;
  }

  function renderEditor() {
    const e = S.editing;
    const f = e.fields;
    const inspo = e.inspoId ? findInspo(e.inspoId) : null;
    const del = "deleteIdea:" + e.id;
    const pick = (field, value, label) => `<button type="button" class="chip" data-act="pickField" data-field="${field}" data-value="${esc(value)}" aria-pressed="${String(f[field] == null ? "" : f[field]) === String(value)}">${esc(label)}</button>`;
    const tagOn = (g) => M.splitTags(f.tags).some((x) => x.toLowerCase() === g.toLowerCase());
    const t = today();
    app.innerHTML = `<div class="sheet"><div class="sheet-head"><div class="wrap"><button type="button" class="btn sm ghost" data-act="cancelEdit">Cancel</button><h2 class="grow" style="font-size:26px">${e.id ? "Edit idea" : inspo ? "Make it ours" : "New idea"}</h2></div></div>
      <div class="wrap"><form data-form="idea" novalidate>
        ${inspo ? `<div class="card"><span class="label">From the inbox</span>${inspo.note ? `<p><strong>Why:</strong> ${esc(inspo.note)}</p>` : ""}${inspo.meta && inspo.meta.title ? `<p class="soft clamp">${esc(inspo.meta.title)}</p>` : ""}<a class="btn ghost" href="${esc(inspo.url)}" target="_blank" rel="noopener">Watch the example</a></div>` : ""}
        <label class="field"><span>Title</span><input data-f="title" value="${esc(f.title)}" placeholder="Mat slap" maxlength="120" required></label>
        <label class="field"><span>Type</span><select data-f="type"><option value="">Pick a type</option>${M.TYPES.map((ty) => `<option ${f.type === ty ? "selected" : ""}>${esc(ty)}</option>`).join("")}</select></label>
        <div class="field"><span>Tags <em>(optional)</em></span><input data-f="tags" value="${esc(Array.isArray(f.tags) ? f.tags.join(", ") : f.tags)}" placeholder="trend, skit">
          <div class="pick">${QUICK_TAGS.map((g) => `<button type="button" class="chip" data-act="toggleTag" data-value="${esc(g)}" aria-pressed="${tagOn(g)}">${esc(g)}</button>`).join("")}</div></div>
        <label class="field"><span>Hook</span><textarea data-f="hook" rows="2" placeholder="The first line or shot that stops the scroll">${esc(f.hook)}</textarea></label>
        <label class="field"><span>Shots <em>(one per line)</em></span><textarea data-f="steps" rows="5" placeholder="Wide of the dirty mat&#10;Slap it on the ground&#10;Before and after">${esc(Array.isArray(f.steps) ? f.steps.join("\n") : f.steps)}</textarea></label>
        <label class="field"><span>Caption</span><textarea data-f="caption" rows="3" placeholder="Statements, not questions">${esc(f.caption)}</textarea><span class="hint">Statements not questions. 😭 or 💀 where it fits. No "book now" and no prices.</span></label>
        <div class="field"><span>People needed</span><div class="pick">${[1, 2, 3, 4, 5].map((n) => pick("people", n, String(n))).join("")}</div></div>
        <div class="field"><span>Length</span><div class="pick">${["12s", "15s", "20s"].map((l) => pick("length", l, l)).join("")}</div><input data-f="length" value="${esc(f.length)}" placeholder="12 to 20 seconds"></div>
        <label class="field"><span>Example link <em>(optional)</em></span><input data-f="link" type="url" inputmode="url" value="${esc(f.link)}" placeholder="TikTok or Instagram link"></label>
        <div class="field"><span>Who films it</span><div class="pick">${pick("assignee", "", "Nobody yet")}${M.PEOPLE.map((p) => pick("assignee", p, p)).join("")}</div></div>
        <div class="field"><span>Film by</span><div class="pick">${pick("due", t, "Today")}${pick("due", M.addDays(t, 1), "Tomorrow")}${pick("due", "", "No date")}</div><input data-f="due" type="date" value="${esc(f.due || "")}"></div>
        ${e.msg ? `<p class="err" role="alert">${esc(e.msg)}</p>` : ""}
        <button class="btn wide big" type="submit" ${S.saving ? "disabled" : ""}>${S.saving ? "Saving..." : "Save idea"}</button>
        ${e.id ? `<button type="button" class="btn danger wide" data-act="deleteIdea">${confirming(del) ? "Tap again to delete it" : "Delete this idea"}</button>` : ""}
      </form></div></div>`;
  }

  function render() {
    document.body.classList.toggle("has-tabs", !!(isOwner() && S.data && !S.editing));
    if (!S.who) return renderWho();
    if (!S.data) {
      app.innerHTML = `${header("")}<main><div class="wrap"><p class="${S.loadError ? "err" : "dim"}">${esc(S.loadError || "Loading the Film List...")}</p>${S.loadError ? `<button type="button" class="btn" data-act="reload">Try again</button>` : ""}</div></main>`;
      if (!S.loading && !S.loadError) load();
      return;
    }
    if (S.editing) return renderEditor();
    if (isOwner()) return renderOwner();
    return renderCrew();
  }
  // Don't redraw under someone mid-typing: their text would go.
  function busyTyping() {
    const a = document.activeElement;
    return !!(S.editing || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
  }

  /* ------------------------------------------------------------ doing things */

  async function moveIdea(id, dir, isUndo) {
    const idea = find(id);
    if (!idea) return;
    const optimistic = M.move(idea, dir, S.who, new Date().toISOString(), today());
    if (!optimistic) return;
    putIdea(optimistic);
    render();
    try {
      const r = await api("move", { id, dir });
      putIdea(r.idea);
      if (isUndo) toast("Undone");
      else toast("Moved to " + M.stageLabel(r.idea.stage), () => moveIdea(id, -dir, true));
    } catch (e) {
      putIdea(idea);
      toast(e.message);
    }
    render();
  }

  async function saveInbox() {
    const url = M.normaliseUrl(S.draft.url);
    if (!url) { S.inboxMsg = "That isn't a link. Copy the reel's link and paste it here."; return render(); }
    S.saving = true; S.inboxMsg = "";
    render();
    try {
      const meta = M.platformOf(url) === "tiktok" && !M.isShortTikTok(url) ? await tiktokPreview(url) : null;
      const r = await api("inbox", { url, note: S.draft.note, meta });
      putInspo(r.inspo);
      S.draft = { url: "", note: "" };
      S.inboxFilter = "all";
      toast(r.message || "Saved to the inbox");
      if (r.inspo.platform === "tiktok" && !(r.inspo.meta && r.inspo.meta.thumb)) refreshPreview(r.inspo);
    } catch (e) {
      S.inboxMsg = e.message;
    } finally {
      S.saving = false;
    }
    render();
  }

  function blankFields(o) {
    return Object.assign({ title: "", type: "", tags: "", hook: "", steps: "", caption: "", people: null, length: "", link: "", assignee: "", due: "" }, o || {});
  }

  async function saveIdea() {
    const e = S.editing;
    if (!String(e.fields.title || "").trim()) { e.msg = "Give it a title."; return render(); }
    S.saving = true; e.msg = "";
    render();
    try {
      const fields = { ...e.fields, assignee: e.fields.assignee || null, due: e.fields.due || null };
      const r = await api("saveIdea", { id: e.id, inspoId: e.inspoId, fields });
      putIdea(r.idea);
      if (r.inspo) putInspo(r.inspo);
      S.editing = null;
      if (!e.id) { S.tab = "board"; S.stage = r.idea.stage; local.set("tab", "board"); }
      toast(e.id ? "Saved" : "Added to To film");
    } catch (err) {
      e.msg = err.message;
    } finally {
      S.saving = false;
    }
    render();
    window.scrollTo(0, 0);
  }

  async function importData(text) {
    let data;
    try { data = JSON.parse(text); } catch { S.importMsg = "That isn't a JSON file. Check it's imperium_film_ideas.json."; return render(); }
    S.importMsg = "Importing...";
    render();
    try {
      const r = await api("import", { data });
      S.importMsg = `Added ${plural(r.added, "idea", "ideas")} to To film.` + (r.skipped ? ` ${plural(r.skipped, "was", "were")} already on the list.` : "") + (r.bad ? ` ${plural(r.bad, "entry had", "entries had")} no title and ${r.bad === 1 ? "was" : "were"} left out.` : "");
      S.importText = "";
      await load(true);
    } catch (e) {
      S.importMsg = e.message;
    }
    render();
  }

  /* ------------------------------------------------------------ events */

  app.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    switch (act) {
      case "tab": S.tab = b.dataset.tab; local.set("tab", S.tab); render(); window.scrollTo(0, 0); break;
      case "set": S[b.dataset.key] = b.dataset.value; render(); break;
      case "pickWho": S.who = b.dataset.who; local.set("who", S.who); render(); break;
      case "switch": S.who = null; local.set("who", null); render(); break;
      case "reload": S.loadError = ""; render(); break;
      case "next": moveIdea(id, 1); break;
      case "back": moveIdea(id, -1); break;
      case "tick": {
        const i = +b.dataset.i;
        const list = S.ticks[id] || [];
        S.ticks[id] = list.includes(i) ? list.filter((x) => x !== i) : list.concat([i]);
        local.set("ticks", JSON.stringify(S.ticks));
        b.setAttribute("aria-pressed", String(S.ticks[id].includes(i)));
        break;
      }
      case "copy": {
        const x = find(id);
        if (x && x.caption) toast((await copyText(x.caption)) ? "Caption copied" : "Couldn't copy. Press and hold the caption to copy it.");
        break;
      }
      case "makeOurs": {
        const x = findInspo(id);
        if (!x) break;
        S.editing = { inspoId: id, fields: blankFields({ link: x.url }) };
        render();
        window.scrollTo(0, 0);
        break;
      }
      case "newIdea": S.editing = { fields: blankFields() }; render(); window.scrollTo(0, 0); break;
      case "edit": {
        const x = find(id);
        if (!x) break;
        S.editing = { id, inspoId: null, fields: blankFields({ ...x, tags: (x.tags || []).join(", "), steps: (x.steps || []).join("\n"), assignee: x.assignee || "", due: x.due || "" }) };
        render();
        window.scrollTo(0, 0);
        break;
      }
      case "cancelEdit": S.editing = null; render(); break;
      case "pickField": {
        const f = S.editing.fields;
        const v = b.dataset.field === "people" ? +b.dataset.value : b.dataset.value;
        f[b.dataset.field] = String(f[b.dataset.field]) === String(v) && b.dataset.field !== "assignee" ? (b.dataset.field === "people" ? null : "") : v;
        render();
        break;
      }
      case "toggleTag": {
        const f = S.editing.fields;
        const g = b.dataset.value;
        const list = M.splitTags(f.tags);
        const has = list.some((x) => x.toLowerCase() === g.toLowerCase());
        f.tags = (has ? list.filter((x) => x.toLowerCase() !== g.toLowerCase()) : list.concat([g])).join(", ");
        render();
        break;
      }
      case "deleteIdea": {
        const k = "deleteIdea:" + S.editing.id;
        if (!confirming(k)) { S.confirm = { key: k, until: Date.now() + 4000 }; render(); break; }
        S.confirm = null;
        try {
          await api("deleteIdea", { id: S.editing.id });
          S.data.ideas = S.data.ideas.filter((x) => x.id !== S.editing.id);
          S.data.inspo.forEach((x) => { x.ideaIds = (x.ideaIds || []).filter((i) => i !== S.editing.id); });
          S.editing = null;
          toast("Idea deleted");
        } catch (e) { S.editing.msg = e.message; }
        render();
        break;
      }
      case "deleteInspo": {
        const k = "deleteInspo:" + id;
        if (!confirming(k)) { S.confirm = { key: k, until: Date.now() + 4000 }; render(); break; }
        S.confirm = null;
        try {
          await api("deleteInspo", { id });
          S.data.inspo = S.data.inspo.filter((x) => x.id !== id);
          toast("Deleted from the inbox");
        } catch (e) { toast(e.message); }
        render();
        break;
      }
      case "importPaste": importData(S.importText); break;
    }
  });

  app.addEventListener("submit", async (ev) => {
    const form = ev.target.closest("[data-form]");
    if (!form) return;
    ev.preventDefault();
    const kind = form.dataset.form;
    if (kind === "inbox") return saveInbox();
    if (kind === "idea") return saveIdea();
    if (kind === "views") {
      const id = form.dataset.id;
      try {
        const r = await api("setViews", { id, views: form.elements.views.value });
        putIdea(r.idea);
        toast("Views saved");
      } catch (e) { toast(e.message); }
      document.activeElement && document.activeElement.blur();
      return render();
    }
    if (kind === "target") {
      try {
        const r = await api("settings", { weeklyTarget: form.elements.target.value });
        S.data.settings = r.settings;
        toast("Target saved");
      } catch (e) { toast(e.message); }
      document.activeElement && document.activeElement.blur();
      return render();
    }
  });

  app.addEventListener("input", (ev) => {
    const el = ev.target;
    if (el.dataset.f && S.editing) S.editing.fields[el.dataset.f] = el.value;
    else if (el.dataset.draft === "url" || el.dataset.draft === "note") S.draft[el.dataset.draft] = el.value;
    else if (el.dataset.draft === "importText") S.importText = el.value;
  });
  app.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.dataset.filter) { S[el.dataset.filter] = el.value; render(); }
    else if (el.dataset.f === "due" && S.editing) { S.editing.fields.due = el.value; render(); }
    else if (el.dataset.actChange === "importFile" && el.files && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => importData(String(reader.result || ""));
      reader.readAsText(el.files[0]);
    }
  });

  // A fresh list when the app comes back to the front, and every minute while it's open.
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && S.who) load(true); });
  setInterval(() => { if (document.visibilityState === "visible" && S.who && !S.editing) load(true); }, 60000);

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/film/sw.js", { scope: "/film/" }).catch(() => { /* fine without */ });

  render();
})();
