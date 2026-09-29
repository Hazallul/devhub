import type { User } from '../types';

export function getStoredUser(): User | null {
  try {
    const token = localStorage.getItem('token');
    const raw = localStorage.getItem('user');
    return token && raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: User) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
