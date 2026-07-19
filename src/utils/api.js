// Thin client for the account backend. In dev the base URL is empty, so calls
// go to '/api/...' and Vite proxies them to the server; in a deployed build set
// VITE_API_URL to the server's origin.

import { getToken } from './session.js';

const BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Is it running?', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no/invalid JSON body */
  }
  if (!res.ok) throw new ApiError((data && data.error) || 'Request failed', res.status);
  return data;
}

export const api = {
  register: (username, password) => request('/api/register', { method: 'POST', body: { username, password } }),
  login: (username, password) => request('/api/login', { method: 'POST', body: { username, password } }),
  getProfile: () => request('/api/profile', { auth: true }),
  putProfile: (profile) => request('/api/profile', { method: 'PUT', auth: true, body: { profile } }),
  social: {
    get: () => request('/api/social', { auth: true }),
    request: (username) => request('/api/social/requests', { method: 'POST', auth: true, body: { username } }),
    accept: (username) => request('/api/social/requests/accept', { method: 'POST', auth: true, body: { username } }),
    decline: (username) => request('/api/social/requests/decline', { method: 'POST', auth: true, body: { username } }),
    unfriend: (username) => request(`/api/social/friends/${encodeURIComponent(username)}`, { method: 'DELETE', auth: true }),
    challenge: (username, time) => request('/api/social/challenges', { method: 'POST', auth: true, body: { username, time } }),
    acceptChallenge: (id) => request(`/api/social/challenges/${encodeURIComponent(id)}/accept`, { method: 'POST', auth: true }),
    counterChallenge: (id, time) => request(`/api/social/challenges/${encodeURIComponent(id)}/counter`, { method: 'POST', auth: true, body: { time } }),
    declineChallenge: (id) => request(`/api/social/challenges/${encodeURIComponent(id)}/decline`, { method: 'POST', auth: true }),
  },
};
