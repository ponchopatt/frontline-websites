# Imperium Film List: summary

A simple phone app that takes each video from idea to posted.

- **Live:** https://frontline-websites-6mjg.vercel.app/film/
- **Put it on your phone:** open the link in Safari, tap Share, then Add to Home Screen. On iPhone, reminders only work once it's on the home screen.
- **Who's on it:** Ananth and Brake. There's no PIN: open it and tap your name.

## How it works

There are four lists. Every idea has a tick circle, and tapping it moves the idea to the next list:

| List | What it means | Ticking it |
| --- | --- | --- |
| **Ideas** (blue) | Things to film. Type one in at the top and tap +. | Filmed it → moves to Filmed |
| **Filmed** (amber) | Filmed, waiting to be edited | Edited → moves to Edited |
| **Edited** (purple) | Edited, waiting to be scheduled | Asks when it goes up → moves to Scheduled |
| **Scheduled** (green) | Has a day and time to go up | Posted → moves to Posted (under "See what's posted") |

- Every tick shows an **Undo** button for 8 seconds.
- Tap any idea to open it. You can change the name and add notes (hook, shots), a caption with a copy button, or an example link. You can also say who does the next step and by when, move it back a list, or delete it.
- The **Today** box at the top shows what's yours today: film, edit, schedule or post. A red dot on a list means something in it is yours today.
- **Series (folders):** ideas that belong together, such as an episode series or every reel for one car, sit in one folder card. The card shows the series name, how many ideas are in that list, how many have been posted, and a dot for every idea in the series, coloured by the list it's in.
  - Tap the card to open it and see its ideas. You can tick them right there, and add a new one to the series from inside the folder.
  - A series can be in more than one list. If Ep 1 is filmed, Ideas still shows "Does it foam?" with the rest, and Filmed shows a "Does it foam?" folder holding Ep 1.
  - To put an idea in a series, open the idea and tap a series, or type a new name. Loose ideas (no series) show above the folders.
- **Tags:** short labels such as Reach, Expert, People and Proof. They show on each row.

## Series

- **Does it foam?** (`film/does-it-foam.json`): 13 episodes. Episodes 1 to 12 were added on 4 Nov 2026 and Ep 13 (pre workout) on 6 Nov.
  - Each one is Satisfying, 15s, 1 person and unassigned, with the same 6 steps (test panel only, never a customer car).
  - To add them again: gear icon, Import ideas, then paste the file. Episodes already on the list are skipped.
- **Reels filming plan by car** (from the PDF, added on 6 Nov 2026): 21 reels in five series.
  - Lamborghini Urus (2), Holden Commodore (4), LandCruiser 300 (2), Any normal car (9), and Anytime, during a break (4).
  - Each reel's type (Reach, Expert, People or Proof) is a tag.
  - The notes hold the shots, what's said, the on-screen text, the post day and the "Every job" rules.

## Reminders

Once a phone has reminders turned on (Today box, or the gear icon then Reminders), it gets:

- **every morning at 7**, what's theirs to do that day, for example "Film: Mat slap. Edit: POV wheels. Post at 6pm: Dog hair.";
- **before anything goes up**, a "Time to post" reminder in the hour before its scheduled time.

What counts as yours:

| Step | When you get reminded |
| --- | --- |
| Film | You're picked, and its "film by" day is today or past |
| Edit or Schedule | You're picked, and its day is today or past. With no day set, you get reminded once it has waited a day |
| Post | It's scheduled for today, or it's late |

If nobody is picked for a step, both Ananth and Brake get reminded.

How it works underneath:
- Reminders are standard web push. Vercel checks every hour (`vercel.json`, `/api/film?action=remind` at :50 past). Each reminder is sent only once, so running it again sends nothing new.
- The push keys are made automatically and kept in the database. There's nothing to set up.
- Optional: set `CRON_SECRET` in Vercel so only Vercel can start the hourly check.
- `GET /api/film?action=today[&who=Ananth]` gives the same "today" text, for a GoHighLevel text if you ever want that.

## Add a reel from your phone (iPhone Shortcut)

The steps are in the app under the gear icon. Once it's set up, tap Share on any TikTok or Instagram reel, then Save to Film List. It lands in Ideas with the link attached. Only the link is saved: no video is downloaded.

## Import

Gear icon → Import ideas → pick `imperium_film_ideas.json` (or paste it).
- Everything lands in Ideas.
- Series and tags stay as they are. A file can be `{ "series": "...", "ideas": [...] }` to put them all in one series. Types, length, people, hooks and steps go into each idea's notes.
- They're added in the file's order.
- Ideas with the same name as one already on the list are skipped.

## Where it lives

Film List is in the imperium-leads Vercel project under `/film/`. It uses the same Supabase `docs` table, in three collections: `film_ideas`, `film_push` (which phones have reminders on) and `film_system` (push keys and the log of what's been sent).

| File | What it is |
| --- | --- |
| `public/film/index.html`, `film.js`, `film.css` | The app |
| `public/film/film-model.js` | The rules: lists, ticks, reminders and import. Shared by the page, the server and the tests |
| `public/film/sw.js`, `manifest.json` | Home-screen install, offline shell, showing notifications |
| `api/film.js` | The one endpoint, including the hourly reminder check |
| `lib/film-store.js` | Database reads and writes |
| `test/film.test.js` | Tests (`npm test`) |
| `film/dev-server.mjs` | Run it on a computer with a JSON file: `FILM_LOCAL_STORE=/tmp/film.json node film/dev-server.mjs` |

## Taken out (to keep it simple)

These were removed: the reel inbox, AI Break it down, Google Drive clips, Plan my week, the leaderboard, views by type and the weekly target. They're in the git history if they're ever wanted back.
