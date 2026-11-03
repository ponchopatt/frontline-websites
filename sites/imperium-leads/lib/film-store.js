import fs from "node:fs";
import "../public/film/film-model.js";
import { adminClient, readCollection, readDoc, writeDoc } from "./supabase.js";

// The Film List rules the page uses (public/film/film-model.js), for the server.
export const Film = globalThis.FilmModel;

// Its own collections in the docs table, apart from the leads.
export const C = { inspo: "film_inspo", ideas: "film_ideas", system: "film_system" };

/*
  Where Film List keeps its documents: the leads app's Supabase docs table, through the
  server's own key. FILM_LOCAL_STORE (a file path) keeps them in a JSON file instead, for
  trying it on a computer and for the tests.
*/
export function filmStore() {
  const file = process.env.FILM_LOCAL_STORE;
  if (file) return fileStore(file);
  const db = adminClient();
  return {
    async all(collection) {
      return (await readCollection(db, collection)).map((r) => ({ ...r.data, id: r.id }));
    },
    get: (collection, id) => readDoc(db, collection, id),
    put: (collection, id, data) => writeDoc(db, collection, id, data),
    async del(collection, id) {
      const { error } = await db.from("docs").delete().eq("collection", collection).eq("id", id);
      if (error) throw new Error(error.message);
    },
    // Many documents in one request (the import), so a long list doesn't run out of time.
    async putMany(collection, docs) {
      const at = new Date().toISOString();
      for (let i = 0; i < docs.length; i += 200) {
        const rows = docs.slice(i, i + 200).map((d) => ({ collection, id: d.id, data: d, updated_at: at }));
        const { error } = await db.from("docs").upsert(rows);
        if (error) throw new Error(error.message);
      }
    },
  };
}

function fileStore(file) {
  const load = () => {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return {}; }
  };
  const save = (all) => fs.writeFileSync(file, JSON.stringify(all, null, 1));
  return {
    async all(collection) {
      const c = load()[collection] || {};
      return Object.keys(c).map((id) => ({ ...c[id], id }));
    },
    async get(collection, id) {
      const c = load()[collection] || {};
      return c[id] ?? null;
    },
    async put(collection, id, data) {
      const all = load();
      all[collection] = all[collection] || {};
      all[collection][id] = data;
      save(all);
    },
    async del(collection, id) {
      const all = load();
      if (all[collection]) delete all[collection][id];
      save(all);
    },
    async putMany(collection, docs) {
      const all = load();
      all[collection] = all[collection] || {};
      docs.forEach((d) => { all[collection][d.id] = d; });
      save(all);
    },
  };
}
