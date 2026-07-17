// Persistence for a single in-progress game so it can be resumed after leaving
// the page. Finished games are not kept here (they go to the profile's saved
// games); this slot always holds at most one unfinished game.

const KEY = 'chess-inprogress-v1';

export function saveInProgress(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadInProgress() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearInProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
