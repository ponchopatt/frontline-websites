# Imperium Film List — summary

A phone app for the crew to plan and track short videos.

- Live: https://frontline-websites-6mjg.vercel.app/film/
- Add it to the home screen: open the link in Safari, tap Share, then "Add to Home Screen".
- PINs are **not** in this repo, because the repo is public. Pat has them. To change them, see "Changing the PINs".

## Where it lives and why

Film List sits inside the existing imperium-leads Vercel project, under `/film/`. It uses the same Supabase database (the `docs` table) in three new collections: `film_inspo`, `film_ideas` and `film_system`.

The brief suggested Next.js + Supabase. Reusing the leads project is simpler and just as reliable:

- No new accounts, keys or Vercel project to set up.
- No framework to keep updated.
- It's one plain page (HTML/CSS/JS) and one function (`api/film.js`).
- The Hobby plan allows 12 functions; the leads project now uses 9.

| File | What it is |
| --- | --- |
| `public/film/index.html`, `film.js`, `film.css` | The app |
| `public/film/film-model.js` | The rules (stages, today list, import, reminder text), shared by the page, the server and the tests |
| `public/film/manifest.json`, `sw.js` | Home-screen install and offline shell |
| `api/film.js` | The one endpoint |
| `lib/film-store.js` | Database reads and writes |
| `test/film.test.js` | Tests (`npm test`) |
| `film/dev-server.mjs` | Run it on a computer with a JSON file instead of Supabase |
| `film/STUDY.md` | What we borrowed from HeyOrca, Foreplay, Trello and Sandcastles |

## Done (v1)

1. **Inspo inbox**
   - Paste a TikTok or Instagram link with an optional "why we like it" note.
   - TikTok shows its thumbnail, caption and creator from TikTok's public oEmbed. Short links (vm., vt.) work too.
   - Instagram stores the link only, with a big "Watch the example" button. No Instagram data is fetched or stored.
   - No video files are ever downloaded.
   - The iPhone Shortcut setup steps are in the app (More tab) and below.
2. **Make it ours** turns a saved reel into an idea with the link attached. It has fields for title, type, tags, hook, shots (one per line), caption, people (1–5) and length.
3. **Who and when**
   - Assign each idea to Ant, Lucas, Nick, AJ or Pat, with a "film by" date.
   - Each person picks their name and gets a Today screen with only their videos that are due today or overdue.
   - "Biggest first" means most people needed, then longest, then most shots.
4. **Stages:** Inspo → To film → Filmed → Edited → Posted. One big button moves an idea on, with an Undo button straight after. There's also "Move back" on the board.
5. **Types and tags**
   - Uses the 13 types from the brief.
   - Free tags, with quick ones: hook idea, B-roll idea, trend, skit.
   - Filter the board by type, tag or person.
6. **Copy caption** on every idea.
7. **Import:** More tab → Import ideas. Pick `imperium_film_ideas.json` or paste it.
   - Everything lands in To film, unassigned. Ideas already on the list are skipped.
   - Field names don't need to be exact (title/name, steps/shots, people/people_needed, and so on).

Also done from the nice-to-have list:

9. **Daily reminder** endpoint for GoHighLevel (below).
10. **Views:** enter the view count on Posted ideas. The Numbers tab shows average views by type.
11. **Weekly target bar**, e.g. "9 of 14 posted this week". The owner can change the target (Numbers tab).

### Logins

- **Team PIN (4 digits):** the crew. They can see ideas, tick shots and move stages.
- **Owner PIN (6 digits):** everything else (add, edit, assign, delete, import, views, target).
- After the PIN, "Who are you?" sets the name. A phone stays signed in for 180 days.
- 5 wrong PINs locks it for 15 minutes. Each 5 after that doubles the wait, up to 12 hours.

### Daily reminder for GoHighLevel

```
GET https://frontline-websites-6mjg.vercel.app/api/film?action=today&key=<REMINDER KEY>
```

- It returns plain text, one line per person, e.g. `Ant, 2 videos today: Mat slap, POV wheels.`
- Add `&who=Ant` for one person's line only.
- Add `&format=json` for JSON.
- Pat has the reminder key.

To set it up in GHL, create a workflow with a daily 7am trigger, then a Webhook or Custom Webhook action using GET on that URL. Then send the reply text as an SMS to each crew member (use `&who=Name` once per person).

### iPhone Shortcut (share a reel straight into the inbox)

1. Open the **Shortcuts** app, tap **+**, and name it **Save to Film List**.
2. Tap the **(i)** button and turn on **Show in Share Sheet**. Set it to receive **URLs** and **Text**.
3. Add **Ask for Input** (Text) with the prompt *Why we like it?*
4. Add **Get Contents of URL**:
   - URL: `https://frontline-websites-6mjg.vercel.app/api/film`
   - Method: **POST**
   - Headers: `x-film-pin` = your owner PIN
   - Request Body: **JSON**, with `action` = `inbox`, `url` = **Shortcut Input**, `note` = **Provided Input**
5. Add **Get Dictionary Value** for `message`, then **Show Notification** with it.

Now in TikTok or Instagram, tap Share → Save to Film List.

## Left to do

- **8. AI breakdown** (paste a caption or transcript, get our hook, shots and caption) is not built. It needs:
  - an Anthropic API key in Vercel (`ANTHROPIC_API_KEY`, for the imperium-leads project);
  - one more endpoint (the leads project would then use 10 of its 12 functions).

  Our style rules are ready to go in its prompt: statements not questions, 😭 or 💀 where it fits, no "book now" or prices, 12–20 seconds, our own audio.
- **Import the real ideas.** `imperium_film_ideas.json` wasn't reachable from the build computer, so Pat needs to import it once (More tab → Import ideas).
- **GHL reminder workflow.** The endpoint is live; the workflow itself is set up in GHL (steps above).

## Changing the PINs

Pick one of these:

- **Easiest:** in Vercel → imperium-leads project → Settings → Environment Variables, set `FILM_TEAM_PIN`, `FILM_ADMIN_PIN` and/or `FILM_REMINDER_KEY`, then redeploy. These override the stored ones.
- Or replace the `film_system/pins` doc in Supabase. It holds scrypt hashes (`{salt, hash}`) and is made with `hashPin` from `api/film.js`.

Changing a PIN doesn't sign out phones that are already signed in. To sign every phone out, set a new `FILM_TOKEN_SECRET` in Vercel.

## Run it on a computer

```
FILM_LOCAL_STORE=/tmp/film.json FILM_TOKEN_SECRET=dev FILM_TEAM_PIN=1111 FILM_ADMIN_PIN=222222 \
  FILM_REMINDER_KEY=dev node film/dev-server.mjs
```

Then open http://localhost:8790/film/ (those PINs are for the local copy only).
