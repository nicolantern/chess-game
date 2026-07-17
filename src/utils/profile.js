// Player profile and lifetime statistics, persisted to localStorage. A single
// active profile represents "you" (primarily for games vs the AI); local
// multiplayer games are counted toward totals but not win/loss attribution.

const KEY = 'chess-profile-v1';

const emptyLevel = () => ({ w: 0, l: 0, d: 0 });

export const DEFAULT_PROFILE = {
  name: 'Player',
  stats: {
    total: 0, // all games played (any mode) — for "play 100" style goals
    wins: 0,
    losses: 0,
    draws: 0,
    byLevel: { easy: emptyLevel(), medium: emptyLevel(), hard: emptyLevel(), expert: emptyLevel() },
    flawlessWins: 0, // wins without losing a single piece
    beatHard: false, // has beaten Hard or Expert at least once
    fastestMateMoves: null, // fewest full moves to deliver checkmate
    totalMoves: 0,
    totalDurationMs: 0,
    currentStreak: 0,
    bestStreak: 0,
  },
  savedGames: [], // finished games the user chose to keep
  updatedAt: 0,
};

// Deep-merge stored values over defaults so new fields appear for old profiles.
function merge(base, saved) {
  const out = structuredCloneSafe(base);
  if (!saved || typeof saved !== 'object') return out;
  out.name = saved.name ?? out.name;
  out.savedGames = Array.isArray(saved.savedGames) ? saved.savedGames : out.savedGames;
  out.updatedAt = saved.updatedAt ?? out.updatedAt;
  if (saved.stats) {
    Object.assign(out.stats, saved.stats);
    out.stats.byLevel = {
      easy: { ...emptyLevel(), ...(saved.stats.byLevel?.easy) },
      medium: { ...emptyLevel(), ...(saved.stats.byLevel?.medium) },
      hard: { ...emptyLevel(), ...(saved.stats.byLevel?.hard) },
      expert: { ...emptyLevel(), ...(saved.stats.byLevel?.expert) },
    };
  }
  return out;
}

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(DEFAULT_PROFILE, raw ? JSON.parse(raw) : null);
  } catch {
    return structuredCloneSafe(DEFAULT_PROFILE);
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — ignore */
  }
}

export function resetStats(profile) {
  const fresh = structuredCloneSafe(DEFAULT_PROFILE);
  fresh.name = profile.name;
  fresh.savedGames = profile.savedGames;
  saveProfile(fresh);
  return fresh;
}

/**
 * Fold one finished game into the profile's stats.
 * @param {object} rec
 * @param {'ai'|'pvp'} rec.mode
 * @param {'win'|'loss'|'draw'|null} rec.outcome  from the profile owner's view (ai mode)
 * @param {string} [rec.aiLevel]
 * @param {boolean} [rec.flawless]  won without losing a piece
 * @param {boolean} [rec.mate]      won by checkmate
 * @param {number} rec.moveCount    full moves
 * @param {number} rec.durationMs
 * @param {number} rec.endedAt
 */
export function recordGame(profile, rec) {
  const s = profile.stats;
  s.total += 1;
  s.totalMoves += rec.moveCount || 0;
  s.totalDurationMs += rec.durationMs || 0;

  if (rec.mode === 'ai') {
    if (rec.outcome === 'win') {
      s.wins += 1;
      s.currentStreak += 1;
      s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
      if (rec.flawless) s.flawlessWins += 1;
      if (rec.aiLevel === 'hard' || rec.aiLevel === 'expert') s.beatHard = true;
      if (rec.mate && (s.fastestMateMoves == null || rec.moveCount < s.fastestMateMoves)) {
        s.fastestMateMoves = rec.moveCount;
      }
    } else if (rec.outcome === 'loss') {
      s.losses += 1;
      s.currentStreak = 0;
    } else {
      s.draws += 1;
      s.currentStreak = 0;
    }
    const bucket = s.byLevel[rec.aiLevel];
    if (bucket) {
      if (rec.outcome === 'win') bucket.w += 1;
      else if (rec.outcome === 'loss') bucket.l += 1;
      else bucket.d += 1;
    }
  }

  profile.updatedAt = rec.endedAt || 0;
  saveProfile(profile);
  return profile;
}
