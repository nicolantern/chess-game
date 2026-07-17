export const Difficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  EXPERT: 'expert'
};

export function getSearchDepth(difficulty) {
  switch (difficulty) {
    case Difficulty.EASY:
      return 2;
    case Difficulty.MEDIUM:
      return 3;
    case Difficulty.HARD:
      return 4;
    default:
      return 5;
  }
}
