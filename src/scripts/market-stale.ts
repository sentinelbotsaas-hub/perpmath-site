// A static page keeps saying "report day 2026-11-18" for as long as it is
// served. When the site has not been rebuilt for a while, this shows the
// warning that the build could not know about.
//
// Markup: src/components/market/StaleNotice.astro. The notice is in the HTML,
// hidden, with data-stale-after="<ISO time>": the moment after which the
// report can no longer be the latest one. If the build already ran after
// that moment the notice is rendered visible and this script has nothing to
// do. Reads the reader's clock only; fetches nothing.
for (const notice of Array.from(document.querySelectorAll<HTMLElement>('[data-stale-after]'))) {
  const after = Date.parse(notice.dataset.staleAfter || '');
  if (Number.isFinite(after) && Date.now() >= after) notice.hidden = false;
}
