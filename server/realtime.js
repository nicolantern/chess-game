// Real-time online play over WebSockets: JWT-authenticated connections, random
// matchmaking by time control, and message relay between the two players in a
// room. The server is a relay/matchmaker — the clients run the (identical,
// deterministic) chess engine, so game rules live there. Server-side move
// validation is a planned hardening, not part of v1.

import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';

// Tracks which usernames have at least one live socket, and pushes messages to
// all of a user's sockets. Case-insensitive by username. Pure/testable.
export function createPresence() {
  const byUser = new Map(); // lowercased username -> Set<socket>
  const key = (u) => u.toLowerCase();
  return {
    add(username, ws) {
      const k = key(username);
      if (!byUser.has(k)) byUser.set(k, new Set());
      byUser.get(k).add(ws);
    },
    remove(username, ws) {
      const set = byUser.get(key(username));
      if (!set) return;
      set.delete(ws);
      if (set.size === 0) byUser.delete(key(username));
    },
    isOnline(username) {
      return byUser.has(key(username));
    },
    pushTo(username, obj) {
      const set = byUser.get(key(username));
      if (!set || set.size === 0) return false;
      const data = JSON.stringify(obj);
      for (const ws of set) if (ws.readyState === 1) ws.send(data);
      return true;
    },
    socketFor(username) {
      const set = byUser.get(key(username));
      if (!set) return null;
      for (const ws of set) if (ws.readyState === 1) return ws;
      return null;
    },
    users() {
      return [...byUser.keys()];
    },
  };
}

export function attachRealtime(server, jwtSecret) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const queues = new Map(); // time-control key -> a single waiting socket
  const rooms = new Map(); // roomId -> { players: [wsA, wsB], time }

  const presence = createPresence();
  // Notify a user's friends when their online state changes. Injected by index.js.
  let onPresenceChange = () => {};

  const send = (ws, obj) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  };
  const timeKey = (time) => JSON.stringify(time || { minutes: null });

  wss.on('connection', (ws, req) => {
    // Authenticate from the ?token= query parameter.
    let username;
    try {
      const url = new URL(req.url, 'http://localhost');
      username = jwt.verify(url.searchParams.get('token') || '', jwtSecret).username;
    } catch {
      ws.close(4001, 'auth');
      return;
    }
    ws.username = username;
    ws.roomId = null;
    ws.queueKey = null;
    presence.add(username, ws);
    onPresenceChange(username, true);

    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      handle(ws, msg);
    });
    ws.on('close', () => {
      cleanup(ws);
      presence.remove(username, ws);
      if (!presence.isOnline(username)) onPresenceChange(username, false);
    });
  });

  function handle(ws, msg) {
    switch (msg.type) {
      case 'queue':
        enqueue(ws, msg.time);
        break;
      case 'cancel':
        dequeue(ws);
        break;
      case 'move':
        relay(ws, { type: 'move', move: msg.move, clock: msg.clock });
        break;
      case 'resign':
        relay(ws, { type: 'resign' });
        break;
      case 'drawOffer':
        relay(ws, { type: 'drawOffer' });
        break;
      case 'drawAccept':
        relay(ws, { type: 'drawAccept' });
        break;
      case 'drawDecline':
        relay(ws, { type: 'drawDecline' });
        break;
      case 'rematchOffer':
        relay(ws, { type: 'rematchOffer' });
        break;
      case 'rematchAccept':
        rematch(ws);
        break;
      case 'leave':
        relay(ws, { type: 'opponentLeft' });
        endRoom(ws.roomId);
        break;
      default:
        break;
    }
  }

  function enqueue(ws, time) {
    dequeue(ws);
    const key = timeKey(time);
    const waiting = queues.get(key);
    if (waiting && waiting !== ws && waiting.readyState === 1) {
      queues.delete(key);
      waiting.queueKey = null;
      createRoom(waiting, ws, time);
    } else {
      queues.set(key, ws);
      ws.queueKey = key;
      send(ws, { type: 'queued' });
    }
  }

  function dequeue(ws) {
    if (ws.queueKey && queues.get(ws.queueKey) === ws) queues.delete(ws.queueKey);
    ws.queueKey = null;
  }

  function createRoom(a, b, time) {
    const roomId = randomUUID();
    const aIsWhite = Math.random() < 0.5;
    a.color = aIsWhite ? 0 : 1;
    b.color = aIsWhite ? 1 : 0;
    a.roomId = roomId;
    b.roomId = roomId;
    rooms.set(roomId, { players: [a, b], time });
    send(a, { type: 'matched', roomId, color: a.color, opponent: b.username, time });
    send(b, { type: 'matched', roomId, color: b.color, opponent: a.username, time });
  }

  function opponentOf(ws) {
    const room = rooms.get(ws.roomId);
    if (!room) return null;
    return room.players.find((p) => p !== ws) || null;
  }

  function relay(ws, obj) {
    const opp = opponentOf(ws);
    if (opp) send(opp, obj);
  }

  function endRoom(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    for (const p of room.players) if (p.roomId === roomId) p.roomId = null;
    rooms.delete(roomId);
  }

  // Both players agreed to a rematch: tear down the old room and pair them again
  // (colors are re-randomized in createRoom).
  function rematch(ws) {
    const opp = opponentOf(ws);
    const room = rooms.get(ws.roomId);
    if (!opp || !room) return;
    const { time } = room;
    endRoom(ws.roomId);
    createRoom(opp, ws, time);
  }

  function cleanup(ws) {
    dequeue(ws);
    if (ws.roomId) {
      relay(ws, { type: 'opponentLeft' });
      endRoom(ws.roomId);
    }
  }

  // Pair two usernames' live sockets into a room (used by friend challenges).
  function launchGame(from, to, time) {
    const a = presence.socketFor(from);
    const b = presence.socketFor(to);
    if (!a || !b) return false;
    createRoom(a, b, time);
    return true;
  }

  return {
    wss,
    presence,
    isOnline: (u) => presence.isOnline(u),
    pushTo: (u, obj) => presence.pushTo(u, obj),
    setPresenceHandler: (fn) => { onPresenceChange = fn; },
    launchGame,
  };
}
