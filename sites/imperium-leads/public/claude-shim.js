/*
  claude-shim.js — the storage layer under imperium-leads.html.

  The page was written against window.claude.use("db") and use("downloads"). This file provides
  both on top of Supabase: every document is a row in one table, docs(collection, id, data), and
  live updates come from Supabase Realtime. It also puts a PIN screen in front of the page; the
  PIN is checked by /api/unlock, which hands back a session that stays on the phone.

  Loaded after vendor/supabase.js and config.js, before the page's own script.
*/
(function () {
  "use strict";

  var cfg = window.LEADS_CONFIG || {};
  var AUTH_KEY = "imperium-leads-auth";
  var sb = null;
  if (cfg.url && cfg.anonKey && window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: AUTH_KEY, detectSessionInUrl: false },
    });
  }

  /* ------------------------------------------------------------------ PIN gate */

  var hadSession = false;
  try {
    hadSession = !!localStorage.getItem(AUTH_KEY);
    // The page only picks a tab once one is remembered; on a first open every tab showed at once.
    if (!localStorage.getItem("il-tab")) localStorage.setItem("il-tab", "morning");
  } catch (e) {}

  var style = document.createElement("style");
  style.textContent =
    // The page hides screens with the hidden attribute, as its old host made sure worked even
    // on elements its own CSS lays out (.gate, the tab panels).
    "[hidden]{display:none!important}" +
    "#il-pin{z-index:40}" +
    "#il-pin input{text-align:center;font-size:28px;letter-spacing:.5em;padding:14px 12px 14px calc(12px + .5em);font-variant-numeric:tabular-nums}" +
    "#il-pin .shake{animation:il-shake .4s}" +
    "@keyframes il-shake{0%,100%{transform:none}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}" +
    "@media (prefers-reduced-motion:reduce){#il-pin .shake{animation:none}}" +
    "html.il-locked body>*:not(#il-pin){visibility:hidden}";
  document.head.appendChild(style);
  // No session on this phone yet: keep the page hidden until the PIN is in.
  if (!hadSession) document.documentElement.classList.add("il-locked");

  function onReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function showGate(done) {
    onReady(function () {
      if (document.getElementById("il-pin")) return;
      document.documentElement.classList.add("il-locked");
      var gate = document.createElement("div");
      gate.className = "gate";
      gate.id = "il-pin";
      gate.innerHTML =
        '<form class="card" autocomplete="off">' +
        "<h1>Imperium Leads</h1>" +
        '<p class="help">Enter the team PIN.</p>' +
        '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="PIN" autocomplete="off">' +
        '<p class="help" id="il-pin-msg" role="status" aria-live="polite"></p>' +
        '<button class="btn" type="submit">Unlock</button>' +
        "</form>";
      document.body.appendChild(gate);
      var form = gate.querySelector("form");
      var input = gate.querySelector("input");
      var msg = gate.querySelector("#il-pin-msg");
      var busy = false;
      input.focus();

      function wrong(text) {
        msg.textContent = text;
        input.value = "";
        form.classList.remove("shake");
        void form.offsetWidth; // restart the animation
        form.classList.add("shake");
        input.focus();
      }

      function submit() {
        var pin = input.value.trim();
        if (busy || !/^\d{4}$/.test(pin)) return;
        busy = true;
        msg.textContent = "Checking…";
        fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: pin }) })
          .then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
          })
          .then(function (r) {
            if (r.res.ok && r.body.access_token) {
              return sb.auth.setSession({ access_token: r.body.access_token, refresh_token: r.body.refresh_token }).then(function (s) {
                if (s.error) throw s.error;
                gate.remove();
                document.documentElement.classList.remove("il-locked");
                done();
              });
            }
            if (r.res.status === 429) wrong("Too many wrong tries. Try again in " + (r.body.minutes || 15) + " min.");
            else if (r.res.status === 401) wrong("Wrong PIN. Try again.");
            else wrong("Couldn't check it. Try again.");
          })
          .catch(function () {
            wrong("Couldn't reach the server. Check your signal and try again.");
          })
          .then(function () {
            busy = false;
          });
      }

      input.addEventListener("input", function () {
        input.value = input.value.replace(/\D/g, "").slice(0, 4);
        if (input.value.length === 4) submit();
      });
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
      });
    });
  }

  // Resolves once this phone is signed in (straight away when it already was).
  var signedIn = new Promise(function (resolve) {
    if (!sb) return resolve(false);
    sb.auth
      .getSession()
      .then(function (r) {
        if (r.data && r.data.session) {
          document.documentElement.classList.remove("il-locked");
          resolve(true);
        } else showGate(function () { resolve(true); });
      })
      .catch(function () {
        showGate(function () { resolve(true); });
      });
  });

  // Signed out from elsewhere (the session was revoked): ask for the PIN again.
  if (sb) {
    sb.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT") showGate(function () { location.reload(); });
    });
  }

  /* ------------------------------------------------------------------ documents */

  function fail(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }
  function asError(err) {
    if (!err) return fail("unknown");
    if (err.code === "42501" || err.code === "PGRST301" || err.status === 401 || err.status === 403) return fail("permission_denied", err.message);
    if (err.message && /fetch|network|Failed to|Load failed/i.test(err.message)) return fail("unavailable", err.message);
    return fail(err.code || "unknown", err.message);
  }
  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  function split(path) {
    var parts = String(path).split("/").filter(Boolean);
    if (parts.length < 2) throw fail("invalid_argument", "A document path needs a collection and an id: " + path);
    return { collection: parts.slice(0, -1).join("/"), id: parts[parts.length - 1] };
  }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // What's known of each collection someone is listening to: collection -> Map(id -> data).
  var known = {};
  var listeners = [];

  function docSnap(collection, id, data) {
    var exists = data !== undefined && data !== null;
    return {
      id: id,
      exists: exists,
      ref: docRef(collection + "/" + id),
      data: function () { return exists ? clone(data) : undefined; },
      get: function (field) { return exists ? clone(data[field]) : undefined; },
    };
  }

  function compare(a, b) {
    if (a === b) return 0;
    if (a === undefined || a === null) return -1;
    if (b === undefined || b === null) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a) < String(b) ? -1 : 1;
  }

  function rowsFor(q, map) {
    map = map || known[q.collection] || new Map();
    var list = [];
    map.forEach(function (data, id) { list.push({ id: id, data: data }); });
    if (q.order) {
      list.sort(function (x, y) {
        var c = compare(x.data[q.order.field], y.data[q.order.field]);
        return q.order.dir === "desc" ? -c : c;
      });
    }
    if (q.limit != null) list = list.slice(0, q.limit);
    return list;
  }

  function querySnap(q, list, previous) {
    var docs = list.map(function (r) { return docSnap(q.collection, r.id, r.data); });
    var changes = [];
    var seen = new Set();
    list.forEach(function (r, i) {
      seen.add(r.id);
      var before = previous && previous.get(r.id);
      if (!before) changes.push({ type: "added", doc: docs[i], newIndex: i, oldIndex: -1 });
      else if (before !== JSON.stringify(r.data)) changes.push({ type: "modified", doc: docs[i], newIndex: i, oldIndex: -1 });
    });
    if (previous) previous.forEach(function (json, id) {
      if (!seen.has(id)) changes.push({ type: "removed", doc: docSnap(q.collection, id, JSON.parse(json)), newIndex: -1, oldIndex: -1 });
    });
    return {
      docs: docs,
      size: docs.length,
      empty: docs.length === 0,
      forEach: function (fn) { docs.forEach(fn); },
      docChanges: function () { return changes; },
    };
  }

  function emit(l) {
    try {
      if (l.kind === "doc") {
        var data = (known[l.collection] || new Map()).get(l.id);
        l.cb(docSnap(l.collection, l.id, data));
      } else {
        var list = rowsFor(l);
        var snap = querySnap(l, list, l.last);
        l.last = new Map(list.map(function (r) { return [r.id, JSON.stringify(r.data)]; }));
        l.cb(snap);
      }
    } catch (e) {
      if (window.console) console.error(e);
    }
  }
  function emitCollection(collection) {
    listeners.forEach(function (l) { if (l.collection === collection) emit(l); });
  }

  function put(collection, id, data) {
    if (!known[collection]) known[collection] = new Map();
    if (data === null || data === undefined) known[collection].delete(id);
    else known[collection].set(id, data);
  }

  // Reads a whole collection, a page at a time.
  function fetchCollection(collection) {
    var out = [];
    function page(from) {
      return sb
        .from("docs")
        .select("id,data")
        .eq("collection", collection)
        .order("id")
        .range(from, from + 999)
        .then(function (r) {
          if (r.error) throw asError(r.error);
          out = out.concat(r.data);
          return r.data.length === 1000 ? page(from + 1000) : out;
        });
    }
    return page(0);
  }
  function fetchDoc(collection, id) {
    return sb
      .from("docs")
      .select("data")
      .eq("collection", collection)
      .eq("id", id)
      .maybeSingle()
      .then(function (r) {
        if (r.error) throw asError(r.error);
        return r.data ? r.data.data : null;
      });
  }

  // Brings every listened-to collection up to date (on start, after a reconnect, on return).
  var refreshing = null;
  function refreshAll() {
    if (refreshing) return refreshing;
    var collections = {};
    listeners.forEach(function (l) { collections[l.collection] = collections[l.collection] || []; collections[l.collection].push(l); });
    refreshing = Promise.all(
      Object.keys(collections).map(function (c) {
        var group = collections[c];
        var wholeCollection = group.some(function (l) { return l.kind === "query"; });
        var load = wholeCollection
          ? fetchCollection(c).then(function (rows) {
              known[c] = new Map(rows.map(function (r) { return [r.id, r.data]; }));
            })
          : Promise.all(group.map(function (l) {
              return fetchDoc(c, l.id).then(function (data) { put(c, l.id, data); });
            }));
        return load
          .then(function () { emitCollection(c); })
          .catch(function (err) {
            group.forEach(function (l) { if (l.err) l.err(asError(err)); });
          });
      }),
    ).then(function () {
      refreshing = null;
    });
    return refreshing;
  }

  var channel = null;
  function openChannel() {
    if (channel) return;
    channel = sb
      .channel("docs")
      .on("postgres_changes", { event: "*", schema: "public", table: "docs" }, function (p) {
        var row = p.eventType === "DELETE" ? p.old : p.new;
        if (!row || !row.collection || !known[row.collection]) return;
        put(row.collection, row.id, p.eventType === "DELETE" ? null : row.data);
        emitCollection(row.collection);
      })
      .subscribe(function (status) {
        // (Re)connected: anything missed while away is picked up.
        if (status === "SUBSCRIBED") refreshAll();
      });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") refreshAll();
    });
    window.addEventListener("online", refreshAll);
  }

  function listen(l) {
    listeners.push(l);
    openChannel();
    var c = l.collection;
    var load =
      l.kind === "query"
        ? fetchCollection(c).then(function (rows) { known[c] = new Map(rows.map(function (r) { return [r.id, r.data]; })); })
        : fetchDoc(c, l.id).then(function (data) { put(c, l.id, data); });
    load
      .then(function () { if (listeners.indexOf(l) !== -1) emit(l); })
      .catch(function (err) { if (l.err) l.err(asError(err)); });
    return function unsubscribe() {
      var i = listeners.indexOf(l);
      if (i !== -1) listeners.splice(i, 1);
    };
  }

  // A write is shown straight away on this phone; Realtime brings it to the other one.
  function saved(collection, id, data) {
    put(collection, id, data);
    emitCollection(collection);
  }

  function docRef(path) {
    var p = split(path);
    return {
      id: p.id,
      path: p.collection + "/" + p.id,
      get: function () {
        return fetchDoc(p.collection, p.id).then(function (data) { return docSnap(p.collection, p.id, data); });
      },
      set: function (data) {
        var value = clone(data) || {};
        return sb
          .from("docs")
          .upsert({ collection: p.collection, id: p.id, data: value, updated_at: new Date().toISOString() })
          .then(function (r) {
            if (r.error) throw asError(r.error);
            saved(p.collection, p.id, value);
          });
      },
      update: function (patch) {
        return sb.rpc("docs_merge", { p_collection: p.collection, p_id: p.id, p_patch: clone(patch) || {} }).then(function (r) {
          if (r.error) throw asError(r.error);
          return fetchDoc(p.collection, p.id).then(function (data) { saved(p.collection, p.id, data); });
        });
      },
      delete: function () {
        return sb
          .from("docs")
          .delete()
          .eq("collection", p.collection)
          .eq("id", p.id)
          .then(function (r) {
            if (r.error) throw asError(r.error);
            saved(p.collection, p.id, null);
          });
      },
      onSnapshot: function (cb, err) {
        return listen({ kind: "doc", collection: p.collection, id: p.id, cb: cb, err: err });
      },
    };
  }

  function query(collection, order, limit) {
    return {
      orderBy: function (field, dir) {
        return query(collection, { field: field, dir: dir === "desc" ? "desc" : "asc" }, limit);
      },
      limit: function (n) {
        return query(collection, order, n);
      },
      get: function () {
        return fetchCollection(collection).then(function (rows) {
          var q = { collection: collection, order: order, limit: limit };
          var list = rowsFor(q, new Map(rows.map(function (r) { return [r.id, r.data]; })));
          return querySnap(q, list, null);
        });
      },
      onSnapshot: function (cb, err) {
        return listen({ kind: "query", collection: collection, order: order, limit: limit, cb: cb, err: err, last: null });
      },
    };
  }

  function collectionRef(path) {
    var collection = String(path).split("/").filter(Boolean).join("/");
    var q = query(collection, null, null);
    q.id = collection.split("/").pop();
    q.path = collection;
    q.doc = function (id) {
      return docRef(collection + "/" + (id || newId()));
    };
    q.add = function (data) {
      var ref = docRef(collection + "/" + newId());
      return ref.set(data).then(function () { return ref; });
    };
    return q;
  }

  var db = { doc: docRef, collection: collectionRef };

  /* ------------------------------------------------------------------ downloads */

  var downloads = {
    save: function (file) {
      return new Promise(function (resolve, reject) {
        try {
          var blob = file.data instanceof Blob ? file.data : new Blob([file.data], { type: /\.csv$/i.test(file.filename || "") ? "text/csv" : "application/octet-stream" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = file.filename || "download";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    },
  };

  window.claude = {
    use: function (name) {
      if (name === "db") return signedIn.then(function (ok) { return ok ? db : null; });
      if (name === "downloads") return Promise.resolve(downloads);
      return Promise.resolve(null);
    },
  };

  // The app shell works offline (the list itself needs a connection).
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js").catch(function () {});
    });
  }
})();
