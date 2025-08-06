import { io } from 'socket.io-client';
import Delta from 'quill-delta'; // Import Delta directly

let socket = null;
const WS_SERVER_URL = 'http://localhost:3001';

/**
 * Connects to the WebSocket server for a specific note.
 * @param {string} noteId The ID of the note to join.
 * @param {string} token Optional JWT token for authentication.
 */
export const connectWebSocket = (noteId, token = null) => {
  if (socket && socket.connected) {
    console.log('Already connected to WebSocket.');
    return;
  }

  const query = { noteId };
  if (token) {
    query.token = token;
  }

  socket = io(WS_SERVER_URL, {
    query: query,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server:', socket?.id);
    window.dispatchEvent(new Event('websocket-connected'));
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from WebSocket server:', reason);
    window.dispatchEvent(new Event('websocket-disconnected'));
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
  });

  // Event for initial content when a user connects
  socket.on('initial-note-content', (delta) => {
    // Ensure the received delta is converted to a Delta object
    const event = new CustomEvent('initial-note-content', { detail: new Delta(delta) });
    window.dispatchEvent(event);
  });

  // Event for subsequent deltas from other users
  socket.on('delta-from-server', (delta) => {
    // Ensure the received delta is converted to a Delta object
    const event = new CustomEvent('websocket-delta-received', { detail: new Delta(delta) });
    window.dispatchEvent(event);
  });

  socket.on('users-online', (count) => {
    const event = new CustomEvent('websocket-users-online', { detail: count });
    window.dispatchEvent(event);
  });

  socket.on('new-comment-from-server', (comment) => {
    const event = new CustomEvent('websocket-comment-received', { detail: comment });
    window.dispatchEvent(event);
  });
};

/**
 * Disconnects from the WebSocket server.
 */
export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Sends a Quill delta to the WebSocket server.
 * @param {string} noteId The ID of the note.
 * @param {object} delta The Quill delta object.
 */
export const sendDelta = (noteId, delta) => {
  if (socket && socket.connected) {
    socket.emit('send-delta', { noteId, delta });
  } else {
    console.warn('WebSocket not connected. Cannot send delta.');
  }
};

export const onReceiveDelta = (callback) => {
  if (socket) {
    socket.on('delta-from-server', callback);
  }
};

export const onReceiveComment = (callback) => {
  if (socket) {
    socket.on('new-comment-from-server', callback);
  }
};
