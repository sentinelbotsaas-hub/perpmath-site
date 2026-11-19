// Theme switch: dark (default), light, or follow the system.
//
// The choice lives in <html data-theme> and in localStorage under
// "perpmath-theme". A small inline script in the page head (Base.astro) reads
// the stored value before the first paint, so a reload never flashes the
// wrong theme; this file only wires up the three buttons in the header.
//
// Storage can be blocked (private mode, strict settings). Every access is in
// a try/catch: the switch then still works for the page you are on, it just
// is not remembered.

type Theme = 'dark' | 'light' | 'system';

const KEY = 'perpmath-theme';
const THEMES: readonly Theme[] = ['dark', 'light', 'system'];
const root = document.documentElement;

const isTheme = (value: unknown): value is Theme => THEMES.includes(value as Theme);
const current = (): Theme => (isTheme(root.dataset.theme) ? root.dataset.theme : 'dark');

const groups = [...document.querySelectorAll<HTMLElement>('[data-theme-switch]')];
const buttonsOf = (group: HTMLElement) => [...group.querySelectorAll<HTMLButtonElement>('[data-theme-value]')];

function reflect(): void {
  const theme = current();
  for (const group of groups) {
    for (const button of buttonsOf(group)) {
      const on = button.dataset.themeValue === theme;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    }
  }
}

function choose(theme: Theme): void {
  root.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not remembered; nothing else to do.
  }
  reflect();
}

for (const group of groups) {
  const buttons = buttonsOf(group);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      if (isTheme(button.dataset.themeValue)) choose(button.dataset.themeValue);
    });
  }
  // A radio group: arrow keys move and select.
  group.addEventListener('keydown', (event) => {
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    let next = at;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + buttons.length) % buttons.length;
    else return;
    event.preventDefault();
    const target = buttons[next];
    if (target && isTheme(target.dataset.themeValue)) {
      choose(target.dataset.themeValue);
      target.focus();
    }
  });
}

// Another tab changed the theme.
window.addEventListener('storage', (event) => {
  if (event.key === KEY && isTheme(event.newValue)) {
    root.dataset.theme = event.newValue;
    reflect();
  }
});

reflect();
