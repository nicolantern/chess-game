// MatchController owns one playable match: a Game, an optional AI opponent, and
// the clock. It translates user intents (tryMove/undo) into engine calls and
// broadcasts state changes over an EventBus, so the view layer stays a pure
// observer. Events: 'move', 'status', 'tick', 'thinking', 'gameover', 'undo'.

import { Game } from '../engine/game.js';
import { ChessAI } from '../ai/ai.js';
import { ChessClock } from './Clock.js';
import { EventBus } from '../utils/events.js';
import { pieceType, pieceColor, PAWN, WHITE } from '../engine/pieces.js';
import { rankOf } from '../engine/board.js';

export class MatchController {
  constructor(opts = {}) {
    const { mode = 'pvp', aiLevel = 'medium', aiColor = 1, timeMinutes = null, time = null } = opts;
    this.startConfig = opts; // kept verbatim so a game can be serialized/resumed
    this.startedAt = Date.now();
    this.bus = new EventBus();
    this.mode = mode; // 'pvp' | 'ai'
    this.aiColor = aiColor; // which side the AI plays in 'ai' mode
    this.ai = mode === 'ai' ? new ChessAI(aiLevel) : null;
    this.game = new Game();
    // Accept either the newer `time` object or the legacy `timeMinutes` number.
    const tc = time || { minutes: timeMinutes, increment: 0, delay: 0 };
    this.clock = new ChessClock({
      minutes: tc.minutes,
      increment: tc.increment || 0,
      delay: tc.delay || 0,
      onTick: (remaining) => this.bus.emit('tick', remaining),
      onFlag: (side) => this._onFlag(side),
    });
    // Captured pieces, grouped by the color of the captured piece.
    this.captured = { [WHITE]: [], [1]: [] };
    this.resigned = null;
    // FEN snapshot after each ply (index 0 = initial), for history review.
    this.fens = [this.game.fen()];
  }

  static fromFen(fen, opts) {
    const mc = new MatchController(opts);
    mc.game.reset(fen);
    return mc;
  }

  /** Begin play (starts the clock and lets the AI move if it is on move). */
  start() {
    this.clock.start(this.game.sideToMove);
    this.bus.emit('status', this.statusPayload());
    if (this._aiToMove()) this._scheduleAI();
  }

  _aiToMove() {
    return this.mode === 'ai' && !this.game.isOver && this.game.sideToMove === this.aiColor;
  }

  /** True if moving from->to is a pawn promotion (so the UI must ask Q/R/B/N). */
  isPromotion(from, to) {
    const piece = this.game.board.squares[from];
    if (!piece || pieceType(piece) !== PAWN) return false;
    const lastRank = pieceColor(piece) === WHITE ? 7 : 0;
    return rankOf(to) === lastRank && this.game.legalMovesFrom(from).some((m) => m.to === to);
  }

  /** Attempt a human move. Returns true if it was legal and applied. */
  tryMove(from, to, promotion = 0) {
    if (this.game.isOver) return false;
    if (this._aiToMove()) return false; // not the human's turn
    const move = this.game.moveByCoords(from, to, promotion);
    if (!move) return false;
    this._afterMove();
    if (this._aiToMove()) this._scheduleAI();
    return true;
  }

  _afterMove() {
    const last = this.game.history[this.game.history.length - 1];
    if (last.captured) this.captured[pieceColor(last.captured)].push(last.captured);
    this.fens.push(this.game.fen());
    this.clock.switch(this.game.sideToMove);
    this.bus.emit('move', { move: last.move, san: last.san });
    this.bus.emit('status', this.statusPayload());
    if (this.game.isOver) {
      this.clock.stop();
      this.bus.emit('gameover', this.statusPayload());
    }
  }

  async _scheduleAI() {
    this.bus.emit('thinking', true);
    const move = await this.ai.chooseMoveAsync(this.game.board);
    this.bus.emit('thinking', false);
    if (!move || this.game.isOver) return;
    this.game.applyMove(move);
    this._afterMove();
  }

  /** Take back a move (a full ply-pair vs the AI so the human is on move). */
  undo() {
    if (!this.game.history.length) return;
    const steps = this.mode === 'ai' ? Math.min(2, this.game.history.length) : 1;
    for (let i = 0; i < steps; i += 1) this.game.undo();
    this.fens.length = this.game.history.length + 1;
    this._rebuildCaptured();
    this.resigned = null;
    // Don't grant increment when reverting a move.
    if (!this.clock.unlimited) this.clock.switch(this.game.sideToMove, false);
    this.bus.emit('undo', null);
    this.bus.emit('status', this.statusPayload());
  }

  /** Resign the current side to move (or a specified color). */
  resign(color = this.game.sideToMove) {
    this.resigned = color;
    this.clock.stop();
    this.bus.emit('gameover', { ...this.statusPayload(), status: 'resign', winner: color ^ 1 });
  }

  /** Claim an available threefold-repetition / fifty-move draw. */
  claimDraw() {
    if (!this.game.canClaimDraw) return false;
    this.clock.stop();
    this.bus.emit('gameover', { ...this.statusPayload(), status: 'draw-repetition', winner: null });
    return true;
  }

  _rebuildCaptured() {
    this.captured = { [WHITE]: [], [1]: [] };
    for (const h of this.game.history) {
      if (h.captured) this.captured[pieceColor(h.captured)].push(h.captured);
    }
  }

  _onFlag(side) {
    this.clock.stop();
    this.bus.emit('gameover', { ...this.statusPayload(), status: 'timeout', winner: side ^ 1 });
  }

  statusPayload() {
    return {
      status: this.game.status,
      winner: this.game.winner,
      check: this.game.check,
      sideToMove: this.game.sideToMove,
      canClaimDraw: this.game.canClaimDraw,
      history: this.game.history.map((h) => h.san),
      captured: this.captured,
      fen: this.game.fen(),
      lastMove: this.game.lastMove,
    };
  }

  destroy() {
    this.clock.stop();
  }

  /** Snapshot the whole game to a plain object (for save / resume / PGN). */
  serialize() {
    const result = this.game.isOver
      ? this.game.status
      : this.resigned != null
        ? 'resign'
        : 'in-progress';
    return {
      startConfig: this.startConfig,
      moves: this.game.history.map((h) => ({
        from: h.move.from,
        to: h.move.to,
        promotion: h.move.promotion || 0,
      })),
      sans: this.game.history.map((h) => h.san),
      result,
      winner: this.game.winner,
      clock: { remaining: [...this.clock.remaining], unlimited: this.clock.unlimited },
      startedAt: this.startedAt,
      savedAt: Date.now(),
    };
  }

  /** Rebuild a controller from a serialize() snapshot (resumes or replays). */
  static deserialize(data) {
    const mc = new MatchController(data.startConfig || {});
    for (const m of data.moves || []) {
      const legal = mc.game
        .legalMoves()
        .find((x) => x.from === m.from && x.to === m.to && (x.promotion || 0) === (m.promotion || 0));
      if (!legal) break;
      mc.game.applyMove(legal);
      mc.fens.push(mc.game.fen());
    }
    mc._rebuildCaptured();
    if (data.clock && !mc.clock.unlimited && Array.isArray(data.clock.remaining)) {
      mc.clock.remaining = data.clock.remaining.slice();
    }
    if (data.startedAt) mc.startedAt = data.startedAt;
    return mc;
  }
}
