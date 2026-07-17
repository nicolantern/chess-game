// PGN (Portable Game Notation) export. Given a game's SAN move list and result,
// produce a standards-compliant PGN string that any chess program can read.

/** Map an engine result/winner to a PGN result token. */
function resultToken(result, winner) {
  if (result === 'in-progress') return '*';
  if (winner === 0) return '1-0';
  if (winner === 1) return '0-1';
  return '1/2-1/2';
}

/**
 * @param {object} g
 * @param {string[]} g.sans   SAN moves in order
 * @param {string} g.result   engine status (e.g. 'checkmate', 'in-progress')
 * @param {number|null} g.winner  0 white, 1 black, or null
 * @param {string} [g.white]  white player name
 * @param {string} [g.black]  black player name
 * @param {string} [g.date]   'YYYY.MM.DD'
 * @param {string} [g.event]
 * @param {string} [g.site]
 */
export function toPgn({
  sans = [],
  result = 'in-progress',
  winner = null,
  white = 'White',
  black = 'Black',
  date = '????.??.??',
  event = 'Casual Game',
  site = 'Chess (local)',
}) {
  const token = resultToken(result, winner);
  const tags = [
    ['Event', event],
    ['Site', site],
    ['Date', date],
    ['White', white],
    ['Black', black],
    ['Result', token],
  ];
  const header = tags.map(([k, v]) => `[${k} "${v}"]`).join('\n');

  let movetext = '';
  for (let i = 0; i < sans.length; i += 2) {
    movetext += `${i / 2 + 1}. ${sans[i]}${sans[i + 1] ? ' ' + sans[i + 1] : ''} `;
  }
  movetext = `${movetext.trim()} ${token}`.trim();

  // Wrap movetext at ~80 columns as PGN readers expect.
  const wrapped = wrap(movetext, 80);
  return `${header}\n\n${wrapped}\n`;
}

function wrap(text, width) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (line.length + w.length + 1 > width) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}
