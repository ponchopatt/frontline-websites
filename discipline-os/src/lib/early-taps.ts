/*
  Taps made before the page is ready.

  A page arrives as HTML first and its buttons only work once the app's script has loaded. On a
  slow connection, or the first open after a release, that can take a second, and a tick tapped
  in that time did nothing. A tiny script in the page's head notes those taps; once React is
  running, each one is played again. A toggle (a tick, a switch) tapped several times while
  waiting counts once: tapping again because nothing happened means "yes, tick it".
*/

const TARGET = "button,[role=checkbox],[role=switch]";
const TOGGLE = "[role=checkbox],[role=switch],[role=radio],[aria-pressed]";

/** Runs in the head, before anything else. Kept to plain old JavaScript. */
export const EARLY_TAPS_SCRIPT = `(function(){
var q=[];window.__earlyTaps=q;
function live(){return Object.keys(document).some(function(k){return k.indexOf("__reactContainer$")===0})}
function tap(e){
if(live()){document.removeEventListener("click",tap,true);return}
var b=e.target&&e.target.closest&&e.target.closest(${JSON.stringify(TARGET)});
if(!b||b.disabled||b.getAttribute("aria-disabled")==="true")return;
if(b.type==="submit"&&b.form)return;
if(b.matches(${JSON.stringify(TOGGLE)})&&q.indexOf(b)!==-1)return;
b.setAttribute("data-early-tap","");q.push(b)}
document.addEventListener("click",tap,true)})();`;

/** True once React has taken over this element and its tap handler is attached. */
function hydrated(el: Element): boolean {
  return Object.keys(el).some((k) => k.startsWith("__reactProps$"));
}

/**
 * Plays the taps noted before the page was ready, each as soon as its own button is live (parts
 * of a page come alive at slightly different moments). Gives up on any still waiting after 10 s.
 */
export function replayEarlyTaps() {
  const w = window as Window & { __earlyTaps?: HTMLElement[] };
  const waiting = w.__earlyTaps?.splice(0) ?? [];
  if (!waiting.length) return;
  const until = Date.now() + 10_000;
  const tick = () => {
    for (let i = 0; i < waiting.length; ) {
      const el = waiting[i];
      if (!el.isConnected) {
        waiting.splice(i, 1);
      } else if (hydrated(el)) {
        waiting.splice(i, 1);
        el.removeAttribute("data-early-tap");
        if (!(el as HTMLButtonElement).disabled) el.click();
      } else i += 1;
    }
    if (waiting.length && Date.now() < until) requestAnimationFrame(tick);
    else for (const el of waiting) el.removeAttribute("data-early-tap");
  };
  tick();
}
