// Playful rotating splash lines shown on the home screen (Minecraft-splash style).
// COMMON show most of the time; RARE lines pop up occasionally for a bit of delight.

export const COMMON = [
  'Now with 100% more bishops!',
  'Knights jump over everything!',
  'Free analysis tomorrow!',
  'Ctrl+Z unavailable!',
  'GG!',
  'Always play e4!',
  'Sicilian incoming!',
  'London players welcome!',
  "King's Gambit forever!",
  'Bongcloud certified!',
  'Respect the knight!',
  'Passed pawns matter!',
  'Endgames win games!',
  'Find the best move!',
  'The clock is ticking!',
  'Calculate everything!',
  'Check first, celebrate later!',
  'Checkmate!',
  'En passant!',
  'Sac the queen!',
  'Blunder detected!',
  'Mate in 2!',
  'Good luck, have fun!',
  'Time trouble!',
  'The bishop was free!',
  'Just one more game!',
  'Premoved!',
  'Certified fork enjoyer!',
  'No takebacks!',
  'Pawn power!',
  'Castle early!',
  'Oops... hanging queen!',
  'Stalemate?!',
  'Think faster!',
  'Touch-move... maybe.',
  'Flagging in progress!',
  '64 squares!',
];

export const RARE = [
  '2800 Elo... someday!',
  'Mate in 37!',
  'The queen sees all.',
  'Trust your intuition.',
  'Every grandmaster blundered once.',
  'A beautiful sacrifice!',
  'This move is brilliant!',
  'One inaccurate move...',
  'Think before you move!',
  'Welcome to the board!',
];

/** Pick a tagline — rare lines surface ~12% of the time. */
export function randomTagline() {
  const pool = Math.random() < 0.12 ? RARE : COMMON;
  return pool[Math.floor(Math.random() * pool.length)];
}
