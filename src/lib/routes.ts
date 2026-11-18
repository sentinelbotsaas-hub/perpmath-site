// Which pages exist. Used so that nav entries and tool links only become
// links once their page has been built: no dead links, and nobody has to edit
// the nav or the home page when a new section or tool lands.
//
// Build-time only (import.meta.glob over src/pages). The glob is lazy: it
// lists file names and loads nothing.

const pageFiles = Object.keys(import.meta.glob('/src/pages/**/*.astro'));

const ROOT = '/src/pages/[...locale]';

/**
 * Does a static page exist for this locale-less path?
 *   pageExists('/tools/')                               -> true
 *   pageExists('/tools/liquidation-price-calculator/')  -> true
 *   pageExists('/daily/')                               -> false until it is built
 * Only knows about static routes. Dynamic routes ([slug]) are not checked.
 */
export function pageExists(path: string): boolean {
  const clean = path.replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
  if (clean === '') return pageFiles.includes(`${ROOT}/index.astro`);
  return pageFiles.includes(`${ROOT}/${clean}/index.astro`) || pageFiles.includes(`${ROOT}/${clean}.astro`);
}
