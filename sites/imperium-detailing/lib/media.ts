// Small rules about the clips in public/media, shared by every place that shows one.

/**
 * These three came out bigger as WebM than as MP4 (paint correction 1.77MB vs
 * 1.22MB, full detail 1.88 vs 1.75, beading 1.30 vs 1.04). A browser that plays
 * WebM takes the first <source> it can, so offering it here only costs bytes.
 * Take a clip off this list once it has been re-encoded smaller.
 */
const mp4Only = new Set(["/media/paint-correction-720", "/media/full-detail-720", "/media/beading-720"]);

/** Whether to offer the WebM next to the MP4 for this clip (`base` has no extension). */
export const hasWebm = (base: string) => !mp4Only.has(base);

/**
 * Posters with a 480px-wide copy saved next to them as `<name>-poster-480.webp`
 * (resized from the 720px originals with sharp). A gallery tile on a phone is
 * about 180px wide, so the 720px frame was over twice what it needed.
 */
const hasSmall = new Set([
  "/media/beading-poster.webp",
  "/media/exterior-huracan-poster.webp",
  "/media/full-detail-poster.webp",
  "/media/interior-mclaren-poster.webp",
  "/media/m3-comp-poster.webp",
  "/media/m3-gtr-poster.webp",
  "/media/m4-wash-poster.webp",
  "/media/maintenance-wash-poster.webp",
  "/media/paint-correction-poster.webp",
  "/media/r8-detail-poster.webp",
]);

/**
 * The poster to use for a video shown `cssWidth` pixels wide. The 480px copy
 * wherever it covers the screen pixels (allowing a 1.25x stretch, which a poster
 * frame the clip replaces within a second hides), the 720px original otherwise.
 */
export function posterFor(poster: string, cssWidth: number): string {
  if (!hasSmall.has(poster) || cssWidth <= 0) return poster;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return cssWidth * dpr <= 600 ? poster.replace(/\.webp$/, "-480.webp") : poster;
}
