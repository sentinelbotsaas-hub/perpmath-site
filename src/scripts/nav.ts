// Header behaviour: the menu groups (buttons that open a panel of links) and
// the phone sheet. Markup is in src/components/Nav.astro, styles are in
// src/styles/components.css under "Header".
//
// Without this script every group is a plain link to its overview page, so
// nothing here is needed to reach a page.
//
// Keyboard:
//   Enter / Space on a group button   open or close its panel
//   ArrowDown on a group button       open the panel and move to its first link
//   ArrowDown / ArrowUp in a panel    next / previous link (Home, End: first, last)
//   Escape                            close the open panel (focus returns to its
//                                     button); with no panel open, close the sheet
//   Tab out of a panel (desktop)      closes it

const root = document.documentElement;
const header = document.querySelector<HTMLElement>('[data-site-header]');
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
// Below this width the menu is a sheet. Keep in step with components.css.
const phone = window.matchMedia('(max-width: 860px)');

interface Group {
  el: HTMLElement;
  button: HTMLButtonElement;
  panel: HTMLElement;
}

const groups: Group[] = [];
if (header) {
  for (const el of header.querySelectorAll<HTMLElement>('[data-menu-group]')) {
    const button = el.querySelector<HTMLButtonElement>('button[aria-controls]');
    const panel = el.querySelector<HTMLElement>('[data-menu-panel]');
    if (button && panel) groups.push({ el, button, panel });
  }
}

const isOpen = (g: Group) => g.el.hasAttribute('data-open');
const links = (g: Group) => [...g.panel.querySelectorAll<HTMLAnchorElement>('a[href]')];

function setOpen(g: Group, open: boolean): void {
  g.el.toggleAttribute('data-open', open);
  g.button.setAttribute('aria-expanded', String(open));
}

function closeAll(except?: Group): void {
  for (const g of groups) if (g !== except && isOpen(g)) setOpen(g, false);
}

for (const g of groups) {
  g.button.addEventListener('click', () => {
    const open = !isOpen(g);
    // On a phone several groups may stay open; on desktop only one panel shows.
    if (open && !phone.matches) closeAll(g);
    setOpen(g, open);
  });

  // Moving the pointer along the bar while a panel is open switches panels.
  g.button.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'mouse' || phone.matches || isOpen(g)) return;
    if (groups.some(isOpen)) {
      closeAll(g);
      setOpen(g, true);
    }
  });

  g.button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (!phone.matches) closeAll(g);
    setOpen(g, true);
    links(g)[0]?.focus();
  });

  g.panel.addEventListener('keydown', (event) => {
    const list = links(g);
    const at = list.indexOf(document.activeElement as HTMLAnchorElement);
    let next = -1;
    if (event.key === 'ArrowDown') next = Math.min(list.length - 1, at + 1);
    else if (event.key === 'ArrowUp') next = at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else return;
    event.preventDefault();
    if (next < 0) g.button.focus();
    else list[next]?.focus();
  });

  // Desktop: the panel closes when focus leaves the group.
  g.el.addEventListener('focusout', (event) => {
    if (phone.matches) return;
    const to = event.relatedTarget as Node | null;
    if (to && !g.el.contains(to)) setOpen(g, false);
  });
}

// Desktop: a click anywhere else closes the open panel.
document.addEventListener('click', (event) => {
  if (phone.matches) return;
  const target = event.target as Node;
  for (const g of groups) if (isOpen(g) && !g.el.contains(target)) setOpen(g, false);
});

// --- The phone sheet ---------------------------------------------------------

const sheetOpen = () => root.hasAttribute('data-menu-open');
// Where the page was when the sheet opened. Moving focus inside the sheet can
// scroll the page behind it; closing puts it back.
let scrollBefore = 0;

function setSheet(open: boolean): void {
  if (!toggle) return;
  if (open) scrollBefore = window.scrollY;
  root.toggleAttribute('data-menu-open', open);
  if (!open && window.scrollY !== scrollBefore) window.scrollTo(0, scrollBefore);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) || '');
  // Everything outside the header is out of reach while the sheet covers it.
  for (const el of document.querySelectorAll<HTMLElement>('body > :not([data-site-header])')) {
    if (el.tagName !== 'SCRIPT') el.inert = open;
  }
  if (open) {
    // Start with the group of the current page open.
    for (const g of groups) setOpen(g, g.button.hasAttribute('data-current'));
  } else {
    closeAll();
  }
}

toggle?.addEventListener('click', () => setSheet(!sheetOpen()));

// Leaving phone width with the sheet open: put everything back.
phone.addEventListener('change', () => {
  if (sheetOpen()) setSheet(false);
  closeAll();
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (sheetOpen()) {
    setSheet(false);
    toggle?.focus({ preventScroll: true });
    return;
  }
  const open = groups.find(isOpen);
  if (open) {
    setOpen(open, false);
    open.button.focus();
  }
});

// A page restored from the back/forward cache must not come back with the
// sheet open and the page inert.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && sheetOpen()) setSheet(false);
});
