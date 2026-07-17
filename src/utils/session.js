// Client-side session: the JWT and username for the logged-in account, kept in
// localStorage. No secrets beyond the bearer token live here.

const KEY = 'chess-session-v1';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function setSession(token, username) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, username }));
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getToken() {
  return getSession()?.token || null;
}

export function currentUser() {
  return getSession()?.username || null;
}

export function isLoggedIn() {
  return Boolean(getToken());
}
