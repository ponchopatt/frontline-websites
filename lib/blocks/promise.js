/**
 * Response-time promise — the line under every main call to action.
 *
 * Imperium keeps this as one string used in ten places, and their README lists
 * deciding its wording as a launch step. Same idea: one config field, so it can
 * never say "within a few hours" beside one button and "same day" beside
 * another. Never a badge, never an icon, never a coloured pill — a quiet line
 * of muted text directly under the buttons.
 */
import { html, when } from '../render.js';

export function promise(cfg, { className = '' } = {}) {
  return when(cfg.responsePromise, (text) =>
    html`<p class="fl-promise${className ? ' ' + className : ''}">${text}</p>`);
}
