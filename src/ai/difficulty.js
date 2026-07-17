// Difficulty presets. Each tunes the search depth cap, the per-move time
// budget, and how often the engine plays a random (rather than best) move.
// The time budgets keep even Expert responsive — iterative deepening returns
// the best move found so far when the clock runs out.

export const DIFFICULTIES = {
  easy: { maxDepth: 2, timeMs: 300, randomness: 0.35 },
  medium: { maxDepth: 3, timeMs: 600, randomness: 0.1 },
  hard: { maxDepth: 4, timeMs: 1200, randomness: 0 },
  expert: { maxDepth: 6, timeMs: 2000, randomness: 0 },
};

export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};
