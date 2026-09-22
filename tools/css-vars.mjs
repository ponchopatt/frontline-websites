/**
 * css-vars — does every custom property the page uses actually resolve?
 *
 *   node tools/css-vars.mjs <url> [more urls...]
 *
 * This exists because of one bug that reached a finished demo.
 *
 * lib/blocks/blocks.css styles the blocks both templates share against --fl-*
 * tokens, so one stylesheet can wear either template's clothes. The quote
 * template declared those tokens. The trust template never did. Every --fl-*
 * on a trust page therefore resolved to the empty string, and CSS does what CSS
 * does with an empty value: it silently drops the declaration. The review cards
 * lost their background and their border, the quote text floated loose on the
 * page ground, the footer inside each card fell back to another variable and
 * rendered as a detached grey slab, and the section heading came out at 22px
 * beside 100px headings everywhere else — on the one section whose entire job
 * is to prove the business is not making things up.
 *
 * Nothing caught it. `npm run check` reads what the page SAYS: it has no
 * opinion on whether the words are legible. paint-check asks whether elements
 * are above the fold, and they were. Lighthouse scored it 94. The reference
 * demo the template was extracted from does not use those blocks, so the diff
 * against it was clean too. It took a person looking at a screenshot.
 *
 * A machine can look for the cause, though, which is what this does: read every
 * var(--name) referenced anywhere in the page's stylesheets, ask the browser
 * what each one computes to on the elements that use it, and fail on any that
 * comes back empty.
 */
import { chromium } from 'playwright';
import { launchOptions } from '../lib/browser.js';

const urls = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!urls.length) {
  console.error('usage: node tools/css-vars.mjs <url> [more urls...]');
  process.exit(2);
}

const browser = await chromium.launch(launchOptions());
let bad = 0;

try {
  for (const url of urls) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(700);

    const result = await page.evaluate(() => {
      /*
       * Every var(--name) used WITHOUT a fallback.
       *
       * `var(--dock-w, 164px)` is not a bug — the fallback is the point, so a
       * client can widen the call dock and the template still works when none
       * does. Only a bare `var(--name)` that resolves to nothing is a
       * declaration silently thrown away.
       */
      const referenced = new Map();   // name -> Set of selectors that use it
      for (const sheet of document.styleSheets) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }   // cross-origin
        const walk = (list) => {
          for (const rule of list) {
            if (rule.cssRules) walk(rule.cssRules);
            if (!rule.style || !rule.selectorText) continue;
            for (const m of rule.cssText.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
              const set = referenced.get(m[1]) ?? new Set();
              set.add(rule.selectorText);
              referenced.set(m[1], set);
            }
          }
        };
        walk(rules);
      }

      /**
       * Resolve each one where it is actually used.
       *
       * A token can legitimately be undefined on :root and defined on a
       * component, so asking the documentElement alone would report false
       * alarms. This asks the elements the rule matches, and only calls a token
       * unresolved when every element using it comes back empty.
       */
      const unresolved = [];
      for (const [name, selectors] of referenced) {
        const targets = [document.documentElement, document.body];
        for (const sel of selectors) {
          try { targets.push(...document.querySelectorAll(sel)); } catch { /* :hover etc */ }
        }
        const anyResolves = targets.some((el) => {
          if (!el) return false;
          return getComputedStyle(el).getPropertyValue(name).trim() !== '';
        });
        if (!anyResolves) {
          unresolved.push({ name, usedBy: [...selectors].slice(0, 3), uses: selectors.size });
        }
      }
      return { referenced: referenced.size, unresolved };
    });

    const name = url.replace(/^https?:\/\/[^/]+\//, '');
    if (result.unresolved.length) {
      bad++;
      console.log(`\n  ${name}`);
      console.log(`    ${result.unresolved.length} of ${result.referenced} custom properties resolve to nothing:`);
      for (const u of result.unresolved) {
        console.log(`      ✗ ${u.name}  — used by ${u.uses} rule(s), e.g. ${u.usedBy.join(', ').slice(0, 90)}`);
      }
      console.log('    CSS drops a declaration whose value is empty, so these are styles that');
      console.log('    silently did not apply. Define them in the template stylesheet.');
    } else {
      console.log(`  ${name}: all ${result.referenced} custom properties resolve`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('');
process.exit(bad ? 1 : 0);
