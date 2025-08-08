import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import NoteEditor from '../components/NoteEditor.jsx';
import CommentSection from '../components/CommentSection.jsx';
import { connectWebSocket, disconnectWebSocket, sendDelta } from '../services/websocket.js';
import { getToken } from '../utils/auth.js';
import Delta from 'quill-delta';

function NotePage({ WS_SERVER_URL }) {
  const { id: noteId } = useParams();
  const [editorContent, setEditorContent] = useState(new Delta());
  const [isConnected, setIsConnected] = useState(false);
  const [usersOnline, setUsersOnline] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  // Keep track of the authoritative server state
  const serverContent = useRef(new Delta());
  const isReceivingServerUpdate = useRef(false);
  const pendingDeltas = useRef([]);
  const saveTimeout = useRef(null);

  // Debounced save indicator
  const updateSaveStatus = useCallback(() => {
    setLastSaved(new Date());
    
    // Clear existing timeout
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }
    
    // Set new timeout to show "saving..." status briefly
    saveTimeout.current = setTimeout(() => {
      setLastSaved(prev => prev); // This will trigger a re-render to update the display
    }, 1000);
  }, []);

  useEffect(() => {
    if (!noteId) {
      setError("No note ID provided in the URL.");
      setLoading(false);
      return;
    }

    console.log('🔄 Connecting to note:', noteId);
    const token = getToken();
    connectWebSocket(noteId, token);

    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      console.log('🔌 WebSocket connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('🔌 WebSocket disconnected');
      setError("Disconnected from server. Attempting to reconnect...");
    };

    const handleUsersOnline = (event) => {
      const customEvent = event;
      setUsersOnline(customEvent.detail);
      console.log('👥 Users online:', customEvent.detail);
    };

    const handleInitialContent = (event) => {
      const customEvent = event;
      let initialDelta;
      
      try {
        const detail = customEvent.detail;
        console.log('📨 Received initial content:', detail);
        
        if (detail instanceof Delta) {
          initialDelta = detail;
        } else if (detail && detail.ops) {
          initialDelta = new Delta(detail.ops);
        } else if (typeof detail === 'string') {
          const parsed = JSON.parse(detail);
          initialDelta = new Delta(parsed.ops || parsed);
        } else {
          initialDelta = new Delta(detail || []);
        }

        console.log('✅ Parsed initial Delta:', initialDelta.ops);
        console.log('📊 Initial content length:', initialDelta.length());
        
        // Set both editor and server content
        serverContent.current = initialDelta;
        setEditorContent(initialDelta);
        setLoading(false);
        setError(null);
        
        // Set initial save status if there's content
        if (initialDelta.length() > 0) {
          setLastSaved(new Date());
        }
        
      } catch (error) {
        console.error('❌ Error parsing initial content:', error);
        const emptyDelta = new Delta();
        serverContent.current = emptyDelta;
        setEditorContent(emptyDelta);
        setLoading(false);
      }
    };

    const handleIncomingDelta = (event) => {
      const customEvent = event;
      let incomingDelta;
      
      try {
        const detail = customEvent.detail;
        console.log('📨 Received delta from server:', detail);
        
        if (detail instanceof Delta) {
          incomingDelta = detail;
        } else if (detail && detail.ops) {
          incomingDelta = new Delta(detail.ops);
        } else {
          incomingDelta = new Delta(detail);
        }

        console.log('📝 Applying incoming delta:', incomingDelta.ops);

        // Set flag to prevent echo
        isReceivingServerUpdate.current = true;

        setEditorContent((prevContent) => {
          try {
            // Ensure we're working with Delta objects
            const currentDelta = prevContent instanceof Delta ? 
              prevContent : new Delta(prevContent);
            
            console.log('🔄 Current content before compose:', currentDelta.ops.length, 'ops');
            
            // Apply the server delta to current content
            const newContent = currentDelta.compose(incomingDelta);
            
            console.log('✅ New content after compose:', newContent.ops.length, 'ops');
            console.log('📏 New content length:', newContent.length());
            
            // Update server reference
            serverContent.current = newContent;
            
            // Update save status since content changed from server
            updateSaveStatus();
            
            return newContent;
          } catch (error) {
            console.error('❌ Error composing delta:', error);
            console.error('Current content:', prevContent);
            console.error('Incoming delta:', incomingDelta);
            return prevContent;
          }
        });

        // Reset flag after update is applied
        setTimeout(() => {
          isReceivingServerUpdate.current = false;
        }, 50);

      } catch (error) {
        console.error('❌ Error handling incoming delta:', error);
        isReceivingServerUpdate.current = false;
      }
    };

    // Handle delta acknowledgment
    const handleDeltaAck = (event) => {
      const customEvent = event;
      const data = customEvent.detail;
      console.log('✅ Delta acknowledged:', data);
      
      if (data.success) {
        updateSaveStatus();
      }
    };

    // Handle errors
    const handleError = (event) => {
      const customEvent = event;
      console.error('❌ WebSocket error:', customEvent.detail);
      setError(`Error: ${customEvent.detail.error || 'Unknown error'}`);
    };

    // Add event listeners
    window.addEventListener('websocket-connected', handleConnect);
    window.addEventListener('websocket-disconnected', handleDisconnect);
    window.addEventListener('websocket-users-online', handleUsersOnline);
    window.addEventListener('initial-note-content', handleInitialContent);
    window.addEventListener('websocket-delta-received', handleIncomingDelta);
    window.addEventListener('websocket-delta-acknowledged', handleDeltaAck);
    window.addEventListener('websocket-error', handleError);

    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      disconnectWebSocket();
      
      // Clear timeout
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      
      // Remove event listeners
      window.removeEventListener('websocket-connected', handleConnect);
      window.removeEventListener('websocket-disconnected', handleDisconnect);
      window.removeEventListener('websocket-users-online', handleUsersOnline);
      window.removeEventListener('initial-note-content', handleInitialContent);
      window.removeEventListener('websocket-delta-received', handleIncomingDelta);
      window.removeEventListener('websocket-delta-acknowledged', handleDeltaAck);
      window.removeEventListener('websocket-error', handleError);
    };
  }, [noteId, WS_SERVER_URL, updateSaveStatus]);

  const handleEditorChange = (content, delta, source, editor) => {
    // Only process user changes, not programmatic ones
    if (source === 'user' && !isReceivingServerUpdate.current) {
      console.log('👤 User made change:');
      console.log('  - Delta:', delta.ops);
      console.log('  - New content ops:', content.ops.length);
      console.log('  - New content length:', content.length());
      
      // Update local state immediately for responsive typing
      setEditorContent(content);
      
      // Send only the delta (change) to server, not full content
      try {
        sendDelta(noteId, delta);
        console.log('📤 Sent delta to server');
        
        // Store the delta for potential conflict resolution
        pendingDeltas.current.push({
          delta,
          timestamp: Date.now()
        });
        
        // Clean up old pending deltas (keep last 10)
        if (pendingDeltas.current.length > 10) {
          pendingDeltas.current = pendingDeltas.current.slice(-10);
        }
        
      } catch (error) {
        console.error('❌ Error sending delta:', error);
        setError('Failed to send changes to server. Your changes may not be saved.');
      }
    }
  };

  // Request sync with server (useful for conflict resolution)
  const requestSync = useCallback(() => {
    console.log('🔄 Requesting sync with server');
    if (window.socket) {
      window.socket.emit('request-sync');
    }
  }, []);

  // Handle manual save (force save current content)
  const forceSave = useCallback(() => {
    if (window.socket && editorContent) {
      console.log('💾 Force saving current content');
      window.socket.emit('force-save', editorContent);
    }
  }, [editorContent]);

  // Format last saved time
  const formatLastSaved = (date) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    
    return date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-120px)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="ml-4 text-lg text-gray-700">Loading note...</p>
      </div>
    );
  }

  if (error && !isConnected && loading) {
    return (
      <div className="text-center text-red-600 text-xl mt-8">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 py-8">
      <div className="w-full lg:w-3/4 bg-white rounded-lg shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">
            Note: <span className="font-mono text-purple-700 text-lg">{noteId}</span>
          </h2>
          
          {/* Save status indicator */}
          <div className="text-sm text-gray-500">
            Last saved: {formatLastSaved(lastSaved)}
          </div>
        </div>
        
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            {/* Connection status */}
            <div className="flex items-center space-x-2">
              <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-sm text-gray-700">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            {/* Error indicator */}
            {error && (
              <div className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">
                ⚠️ {error}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Users online */}
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-gray-700">
                {usersOnline} user{usersOnline !== 1 ? 's' : ''} online
              </span>
            </div>
            
            {/* Debug buttons in development */}
            {process.env.NODE_ENV === 'development' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={requestSync}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  title="Request sync with server"
                >
                  Sync
                </button>
                <button
                  onClick={forceSave}
                  className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  title="Force save current content"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>

        <NoteEditor
          value={editorContent}
          onChange={handleEditorChange}
          noteId={noteId}
        />
        
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 text-xs text-gray-400 font-mono bg-gray-50 p-3 rounded border-l-4 border-gray-300">
            <div className="font-semibold text-gray-600 mb-2">Debug Info:</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div>• Content ops: {editorContent.ops ? editorContent.ops.length : 0}</div>
                <div>• Content length: {editorContent.length ? editorContent.length() : 0}</div>
                <div>• Server ops: {serverContent.current.ops ? serverContent.current.ops.length : 0}</div>
                <div>• Connected: {isConnected ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div>• Receiving update: {isReceivingServerUpdate.current ? 'Yes' : 'No'}</div>
                <div>• Pending deltas: {pendingDeltas.current.length}</div>
                <div>• Last saved: {lastSaved ? lastSaved.toLocaleTimeString() : 'Never'}</div>
                <div>• Error: {error ? 'Yes' : 'No'}</div>
              </div>
            </div>
            <div className="mt-2">
              <div>• Last content preview: {JSON.stringify(editorContent.ops?.slice(-2) || [])}</div>
            </div>
          </div>
        )}
      </div>

      <div className="w-full lg:w-1/4 bg-white rounded-lg shadow-xl p-6">
        <CommentSection noteId={noteId} />
      </div>
    </div>
  );
}

export default NotePage;