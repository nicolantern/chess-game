import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/utils/events.js';
import { SoundManager } from '../src/assets/audio.js';
import { ChessClock } from '../src/ui/Clock.js';
import { MatchController } from '../src/ui/MatchController.js';
import { squareFromAlgebraic } from '../src/engine/board.js';

const sq = squareFromAlgebraic;

describe('EventBus', () => {
  it('subscribes, emits, and unsubscribes', () => {
    const bus = new EventBus();
    const fn = vi.fn();
    const off = bus.on('x', fn);
    bus.emit('x', 42);
    expect(fn).toHaveBeenCalledWith(42);
    off();
    bus.emit('x', 1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('SoundManager', () => {
  it('is a safe no-op without an AudioContext', () => {
    const sm = new SoundManager({ enabled: true });
    expect(() => sm.play('move')).not.toThrow();
  });
  it('respects the enabled flag', () => {
    const sm = new SoundManager({ enabled: true });
    sm.setEnabled(false);
    expect(sm.enabled).toBe(false);
  });
});

describe('ChessClock', () => {
  it('counts down the active side and flags at zero', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onFlag = vi.fn();
    const clock = new ChessClock({ minutes: 1, onFlag });
    clock.start(0);
    vi.advanceTimersByTime(61000);
    expect(onFlag).toHaveBeenCalledWith(0);
    expect(clock.remaining[0]).toBe(0);
    vi.useRealTimers();
  });
  it('treats null minutes as unlimited', () => {
    expect(new ChessClock({ minutes: null }).unlimited).toBe(true);
  });
});

describe('MatchController', () => {
  it('emits move events on a legal move and rejects illegal ones', () => {
    const mc = new MatchController({ mode: 'pvp', timeMinutes: null });
    const moved = vi.fn();
    mc.bus.on('move', moved);
    expect(mc.tryMove(sq('e2'), sq('e4'))).toBe(true);
    expect(moved).toHaveBeenCalled();
    expect(mc.tryMove(sq('e5'), sq('e4'))).toBe(false);
  });

  it('tracks captured pieces', () => {
    const mc = MatchController.fromFen(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
      { mode: 'pvp', timeMinutes: null },
    );
    mc.tryMove(sq('e4'), sq('d5'));
    // A black pawn was captured; captured[BLACK] should now hold one piece.
    expect(mc.captured[1].length).toBe(1);
  });

  it('detects promotion intent', () => {
    const mc = MatchController.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', {
      mode: 'pvp',
      timeMinutes: null,
    });
    expect(mc.isPromotion(sq('a7'), sq('a8'))).toBe(true);
    expect(mc.isPromotion(sq('e1'), sq('e2'))).toBe(false);
  });

  it('undo restores position and captured tray', () => {
    const mc = MatchController.fromFen(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2',
      { mode: 'pvp', timeMinutes: null },
    );
    const before = mc.game.fen();
    mc.tryMove(sq('e4'), sq('d5'));
    mc.undo();
    expect(mc.game.fen()).toBe(before);
    expect(mc.captured[1].length).toBe(0);
  });
});
