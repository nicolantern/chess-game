// Minimal publish/subscribe event bus. The UI subscribes to game/clock events
// so nothing has to poll; `on` returns an unsubscribe function.

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    this.listeners.get(type)?.forEach((fn) => fn(payload));
  }
}
