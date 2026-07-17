// Piece animation via the Web Animations API. Because BoardView re-renders the
// board after each move, we animate the destination piece by sliding it from
// where it started to where it now sits. When animations are disabled (setting
// or prefers-reduced-motion), every method resolves instantly with no motion.

export class Animator {
  constructor({ settings }) {
    this.settings = settings;
  }

  _instant() {
    if (!this.settings.animations) return true;
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * Slide the piece now sitting on `to` in from the position of `from`.
   * Call AFTER boardView.render() so the destination piece exists.
   */
  async slide(boardView, from, to, duration = 180) {
    const fromCell = boardView.cells.get(from);
    const toCell = boardView.cells.get(to);
    if (!fromCell || !toCell) return;
    const pieceEl = toCell.querySelector('.piece');
    if (this._instant() || !pieceEl || !pieceEl.animate) return;

    const a = fromCell.getBoundingClientRect();
    const b = toCell.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    const anim = pieceEl.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' },
      ],
      { duration, easing: 'cubic-bezier(.22,.61,.36,1)' },
    );
    await anim.finished.catch(() => {});
  }
}
