// World persistence in localStorage. Only player edits (a diff from the
// deterministic generated world) are stored, plus inventory, armor, furnaces,
// and player state — so saves stay small and the terrain regenerates from the
// same seed on load.

const KEY = 'mc-save-v1';

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false; // storage full/unavailable — fail quietly
  }
}

export function clearGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
