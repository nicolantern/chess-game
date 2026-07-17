// Profile sync layer. Bridges the local profile store to the account backend:
// pushes local changes up (debounced) and pulls the server copy down on login
// and boot. When logged out or offline, everything falls back to local-only.

import { api } from './api.js';
import { isLoggedIn, clearSession } from './session.js';
import { saveProfile, setProfileSyncHook } from './profile.js';

let pushTimer = null;

// Debounced upload of the local profile to the server.
function schedulePush(profile) {
  if (!isLoggedIn()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      await api.putProfile(profile);
    } catch (e) {
      // 401 → token no longer valid; otherwise likely offline. Either way keep
      // the local copy and let the next change retry.
      if (e.status === 401) clearSession();
    }
  }, 800);
}

/** Register the sync hook so profile saves upload while logged in. */
export function initSync() {
  setProfileSyncHook(schedulePush);
}

/**
 * Pull the server profile into local storage (server wins). Saved without
 * re-triggering an upload. Returns the profile, or null if not logged in / failed.
 */
export async function pullProfile() {
  if (!isLoggedIn()) return null;
  try {
    const { profile } = await api.getProfile();
    if (profile) saveProfile(profile, false);
    return profile;
  } catch (e) {
    if (e.status === 401) clearSession();
    return null;
  }
}
