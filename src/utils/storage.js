// Settings persistence in localStorage, with safe fallbacks when storage is
// unavailable (private mode, tests, SSR). Everything is JSON round-tripped.

const KEY = 'chess-settings-v1';

export const DEFAULTS = {
  sound: true, // move/capture/etc. sound effects
  music: false, // optional background music
  highlights: true, // legal-move / last-move / check highlighting
  animations: true, // piece movement animations
  theme: 'green', // 'wood' | 'marble' | 'green' | 'blue' | 'coral' | 'slate' (chess.com-style green default)
};

/** Load settings, merged over defaults. */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Persist settings (best-effort). */
export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — ignore */
  }
}
