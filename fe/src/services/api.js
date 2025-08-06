import { getToken } from '../utils/auth.js';

const API_BASE_URL = 'http://localhost:3001/api';

const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// --- Note API ---
export const createNote = async () => {
  const response = await fetch(`${API_BASE_URL}/notes/new`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to create note.');
  }
  return response.json();
};

// --- Auth API ---
export const registerUser = async (username, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed.');
  }
  return data;
};

export const loginUser = async (username, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Login failed.');
  }
  return data;
};

// --- Comment API ---
export const getComments = async (noteId) => {
  const response = await fetch(`${API_BASE_URL}/notes/${noteId}/comments`, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch comments.');
  }
  return response.json();
};

export const addComment = async (noteId, text) => {
  const response = await fetch(`${API_BASE_URL}/notes/${noteId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ text }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to add comment.');
  }
  return data;
};
