/**
 * browser — find a Chromium this machine actually has.
 *
 * Playwright expects a browser build matching its own version, and the one
 * pre-installed here does not always match the npm package. Rather than
 * downloading a second copy of Chromium per environment, this finds whatever
 * build is on disk and hands Playwright the path.
 *
 * Order: an explicit CHROME_PATH, then the newest build under
 * PLAYWRIGHT_BROWSERS_PATH, then whatever Playwright would have picked itself.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CANDIDATE_BINARIES = [
  ['chrome-linux', 'chrome'],
  ['chrome-linux', 'headless_shell'],
  ['chrome-headless-shell-linux64', 'chrome-headless-shell'],
];

let cached;

export function chromePath() {
  if (cached !== undefined) return cached;

  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    cached = process.env.CHROME_PATH;
    return cached;
  }

  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (existsSync(root)) {
    const builds = readdirSync(root)
      .filter((d) => /^chromium(-|_)/.test(d))
      // Prefer the full browser over the headless shell, then the newest build.
      .sort((a, b) => {
        const full = (d) => (d.startsWith('chromium-') ? 0 : 1);
        if (full(a) !== full(b)) return full(a) - full(b);
        return (parseInt(b.replace(/\D/g, ''), 10) || 0) - (parseInt(a.replace(/\D/g, ''), 10) || 0);
      });
    for (const build of builds) {
      for (const parts of CANDIDATE_BINARIES) {
        const p = join(root, build, ...parts);
        if (existsSync(p)) { cached = p; return cached; }
      }
    }
  }

  cached = undefined;         // let Playwright try its own default
  return cached;
}

/** Launch options with the right executable already filled in. */
export const launchOptions = (extra = {}) => {
  const exe = chromePath();
  return { ...(exe ? { executablePath: exe } : {}), ...extra };
};
