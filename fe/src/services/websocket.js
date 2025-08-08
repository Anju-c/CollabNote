import { io } from 'socket.io-client';
import Delta from 'quill-delta';

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

  console.log('🔌 Connecting to WebSocket:', { noteId, hasToken: !!token });

  socket = io(WS_SERVER_URL, {
    query: query,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: true // Force new connection each time
  });

  // Store socket globally for debugging and external access
  window.socket = socket;

  socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server:', socket?.id);
    window.dispatchEvent(new Event('websocket-connected'));
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from WebSocket server:', reason);
    window.dispatchEvent(new Event('websocket-disconnected'));
  });

  socket.on('connect_error', (error) => {
    console.error('❌ WebSocket connection error:', error);
    window.dispatchEvent(new CustomEvent('websocket-error', { 
      detail: { error: error.message || 'Connection failed' } 
    }));
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected to WebSocket after', attemptNumber, 'attempts');
    window.dispatchEvent(new Event('websocket-connected'));
  });

  socket.on('reconnect_error', (error) => {
    console.error('❌ WebSocket reconnection error:', error);
  });

  socket.on('reconnect_failed', () => {
    console.error('❌ WebSocket reconnection failed - giving up');
    window.dispatchEvent(new CustomEvent('websocket-error', { 
      detail: { error: 'Failed to reconnect to server' } 
    }));
  });

  // Event for initial content when a user connects
  socket.on('initial-note-content', (data) => {
    console.log('📨 Received initial-note-content:', data);
    
    try {
      let delta;
      
      // Handle different data formats from server
      if (data instanceof Delta) {
        delta = data;
      } else if (data && typeof data === 'object' && data.ops) {
        // Data is already a delta-like object
        delta = new Delta(data.ops);
      } else if (typeof data === 'string') {
        // Data is a JSON string
        const parsed = JSON.parse(data);
        delta = new Delta(parsed.ops || parsed);
      } else if (Array.isArray(data)) {
        // Data is an ops array
        delta = new Delta(data);
      } else {
        // Fallback: try to create delta from whatever we got
        delta = new Delta(data);
      }
      
      console.log('✅ Parsed initial delta:', {
        opsCount: delta.ops.length,
        contentLength: delta.length(),
        firstFewOps: delta.ops.slice(0, 3)
      });
      
      const event = new CustomEvent('initial-note-content', { detail: delta });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Error parsing initial content:', error, data);
      // Send empty delta as fallback
      const event = new CustomEvent('initial-note-content', { detail: new Delta() });
      window.dispatchEvent(event);
    }
  });

  // Event for subsequent deltas from other users
  socket.on('delta-from-server', (data) => {
    console.log('📨 Received delta-from-server:', data);
    
    try {
      let delta;
      
      // Handle different data formats
      if (data instanceof Delta) {
        delta = data;
      } else if (data && typeof data === 'object' && data.ops) {
        delta = new Delta(data.ops);
      } else if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        delta = new Delta(parsed.ops || parsed);
      } else if (Array.isArray(data)) {
        delta = new Delta(data);
      } else {
        delta = new Delta(data);
      }
      
      console.log('✅ Parsed server delta:', {
        opsCount: delta.ops.length,
        operations: delta.ops
      });
      
      const event = new CustomEvent('websocket-delta-received', { detail: delta });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Error parsing server delta:', error, data);
    }
  });

  socket.on('users-online', (count) => {
    console.log('👥 Users online:', count);
    const event = new CustomEvent('websocket-users-online', { detail: count });
    window.dispatchEvent(event);
  });

  socket.on('new-comment-from-server', (comment) => {
    console.log('💬 New comment from server:', comment);
    const event = new CustomEvent('websocket-comment-received', { detail: comment });
    window.dispatchEvent(event);
  });

  // Add error handling for delta operations
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
    window.dispatchEvent(new CustomEvent('websocket-error', { detail: error }));
  });

  socket.on('delta-error', (error) => {
    console.error('❌ Delta error:', error);
    window.dispatchEvent(new CustomEvent('websocket-error', { 
      detail: { error: `Delta error: ${error.error}` } 
    }));
  });

  // Add acknowledgment handling
  socket.on('delta-acknowledged', (data) => {
    console.log('✅ Delta acknowledged by server:', data);
    const event = new CustomEvent('websocket-delta-acknowledged', { detail: data });
    window.dispatchEvent(event);
  });

  // Handle sync content response
  socket.on('sync-content', (data) => {
    console.log('🔄 Received sync content:', data);
    try {
      let delta;
      
      if (data instanceof Delta) {
        delta = data;
      } else if (data && typeof data === 'object' && data.ops) {
        delta = new Delta(data.ops);
      } else {
        delta = new Delta(data);
      }
      
      console.log('✅ Parsed sync delta:', {
        opsCount: delta.ops.length,
        contentLength: delta.length()
      });
      
      const event = new CustomEvent('websocket-sync-content', { detail: delta });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('❌ Error parsing sync content:', error);
    }
  });

  socket.on('sync-error', (error) => {
    console.error('❌ Sync error:', error);
    window.dispatchEvent(new CustomEvent('websocket-error', { 
      detail: { error: `Sync error: ${error.error}` } 
    }));
  });

  // Handle force save responses
  socket.on('force-save-complete', (data) => {
    console.log('✅ Force save completed:', data);
  });

  socket.on('force-save-error', (error) => {
    console.error('❌ Force save error:', error);
    window.dispatchEvent(new CustomEvent('websocket-error', { 
      detail: { error: `Save error: ${error.error}` } 
    }));
  });
};

/**
 * Disconnects from the WebSocket server.
 */
export const disconnectWebSocket = () => {
  if (socket) {
    console.log('🔌 Disconnecting WebSocket');
    socket.disconnect();
    socket = null;
    window.socket = null;
  }
};

/**
 * Sends a Quill delta to the WebSocket server.
 * @param {string} noteId The ID of the note.
 * @param {object} delta The Quill delta object.
 */
export const sendDelta = (noteId, delta) => {
  if (socket && socket.connected) {
    try {
      // Ensure delta is properly formatted
      let deltaToSend;
      
      if (delta instanceof Delta) {
        deltaToSend = delta;
      } else if (delta && delta.ops) {
        deltaToSend = new Delta(delta.ops);
      } else {
        deltaToSend = new Delta(delta);
      }
      
      const payload = {
        noteId,
        delta: deltaToSend
      };
      
      console.log('📤 Sending delta to server:', {
        noteId,
        opsCount: deltaToSend.ops.length,
        ops: deltaToSend.ops
      });
      
      socket.emit('send-delta', payload);
    } catch (error) {
      console.error('❌ Error sending delta:', error);
      throw error; // Re-throw so calling code can handle it
    }
  } else {
    const error = new Error('WebSocket not connected. Cannot send delta.');
    console.warn('⚠️', error.message);
    throw error;
  }
};

/**
 * Request sync with server content
 */
export const requestSync = () => {
  if (socket && socket.connected) {
    console.log('🔄 Requesting sync with server');
    socket.emit('request-sync');
  } else {
    console.warn('⚠️ Cannot request sync - WebSocket not connected');
  }
};

/**
 * Force save current content to server
 * @param {object} content The current editor content
 */
export const forceSave = (content) => {
  if (socket && socket.connected) {
    console.log('💾 Force saving content to server');
    socket.emit('force-save', content);
  } else {
    console.warn('⚠️ Cannot force save - WebSocket not connected');
  }
};

// Legacy callback-based event listeners (for backward compatibility)
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

// Utility functions for debugging
export const getSocket = () => socket;

export const getSocketStatus = () => {
  if (!socket) return 'No socket';
  if (socket.connected) return 'Connected';
  if (socket.connecting) return 'Connecting';
  if (socket.disconnected) return 'Disconnected';
  return 'Unknown';
};

export const debugSocket = () => {
  console.log('🔍 Socket Debug Info:', {
    exists: !!socket,
    id: socket?.id,
    connected: socket?.connected,
    disconnected: socket?.disconnected,
    status: getSocketStatus(),
    url: WS_SERVER_URL
  });
  return socket;
};

// Add to window for debugging
if (typeof window !== 'undefined') {
  window.debugWebSocket = {
    getSocket,
    getSocketStatus,
    debugSocket,
    requestSync,
    forceSave,
    disconnect: disconnectWebSocket
  };
  
  console.log('🛠️ WebSocket debug utilities available at window.debugWebSocket');
}

export default {
  connectWebSocket,
  disconnectWebSocket,
  sendDelta,
  requestSync,
  forceSave,
  onReceiveDelta,
  onReceiveComment,
  getSocket,
  getSocketStatus,
  debugSocket
};