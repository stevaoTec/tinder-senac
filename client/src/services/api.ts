import { AuthResponse, Match, Message, SwipeResult, User } from '../types';

export const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_URL = `${BACKEND_URL}/api`;

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro na requisicao' }));
    throw new Error(error.error || 'Erro na requisicao');
  }
  return response.json();
}

// ── Auth ──────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return handleResponse<AuthResponse>(res);
}

export async function register(data: {
  email: string; password: string; name: string; cpf: string; age: number; gender: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return handleResponse<AuthResponse>(res);
}

export async function googleLogin(credential: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  return handleResponse<AuthResponse>(res);
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
  return handleResponse<User>(res);
}

// ── Users ─────────────────────────────────────────────
export async function discoverUsers(): Promise<User[]> {
  const res = await fetch(`${API_URL}/users/discover`, { headers: getHeaders() });
  return handleResponse<User[]>(res);
}

export async function getAdminStats(): Promise<{ totalUsers: number; onlineUsers: number; users: (User & { email?: string; isOnline?: boolean; createdAt?: string })[] }> {
  const res = await fetch(`${API_URL}/users/admin/stats`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function updateProfile(data: Partial<User>): Promise<User> {
  const res = await fetch(`${API_URL}/users/profile`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  return handleResponse<User>(res);
}

export async function uploadProfilePhoto(file: File): Promise<{ profilePhoto: string; photos?: string[] }> {
  const formData = new FormData();
  formData.append('profilePhoto', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/users/profile/photo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  return handleResponse(res);
}

export async function uploadCoverPhoto(file: File): Promise<{ coverPhoto: string }> {
  const formData = new FormData();
  formData.append('coverPhoto', file);
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/users/profile/cover`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });
  return handleResponse(res);
}

export async function getUserById(id: number): Promise<User> {
  const res = await fetch(`${API_URL}/users/${id}`, { headers: getHeaders() });
  return handleResponse<User>(res);
}

// ── Swipes ────────────────────────────────────────────
export async function swipeUser(targetUserId: number, direction: 'like' | 'dislike' | 'superlike'): Promise<SwipeResult> {
  const res = await fetch(`${API_URL}/swipes`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ targetUserId, direction })
  });
  return handleResponse<SwipeResult>(res);
}

export async function rewindSwipe(): Promise<{ success: boolean; user: User }> {
  const res = await fetch(`${API_URL}/swipes/rewind`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse<{ success: boolean; user: User }>(res);
}

// ── Matches ───────────────────────────────────────────
export async function getMatches(): Promise<Match[]> {
  const res = await fetch(`${API_URL}/matches`, { headers: getHeaders() });
  return handleResponse<Match[]>(res);
}

// ── Messages ──────────────────────────────────────────
export async function getMessages(matchId: number): Promise<Message[]> {
  const res = await fetch(`${API_URL}/messages/${matchId}`, { headers: getHeaders() });
  return handleResponse<Message[]>(res);
}

export async function sendMessage(matchId: number, content: string): Promise<{ message: Message; otherUserId: number }> {
  const res = await fetch(`${API_URL}/messages/${matchId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content })
  });
  return handleResponse(res);
}
