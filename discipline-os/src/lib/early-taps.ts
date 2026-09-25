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

/** Plays the taps noted before the page was ready. Called once React is running. */
export function replayEarlyTaps() {
  const w = window as Window & { __earlyTaps?: HTMLElement[] };
  const taps = w.__earlyTaps?.splice(0) ?? [];
  for (const el of taps) {
    el.removeAttribute("data-early-tap");
    if (el.isConnected && !(el as HTMLButtonElement).disabled) el.click();
  }
}
