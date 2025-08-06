import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import NoteEditor from '../components/NoteEditor.jsx';
import CommentSection from '../components/CommentSection.jsx';
import { connectWebSocket, disconnectWebSocket, sendDelta } from '../services/websocket.js';
import { getToken } from '../utils/auth.js';
import Delta from 'quill-delta'; // Import Delta directly from quill-delta

function NotePage({ WS_SERVER_URL }) {
  const { id: noteId } = useParams();
  // Initialize editorContent with an empty Delta object
  const [editorContent, setEditorContent] = useState(new Delta());
  const [isConnected, setIsConnected] = useState(false);
  const [usersOnline, setUsersOnline] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const latestServerContent = useRef(new Delta()); // Initialize with empty Delta

  useEffect(() => {
    if (!noteId) {
      setError("No note ID provided in the URL.");
      setLoading(false);
      return;
    }

    const token = getToken();
    connectWebSocket(noteId, token);

    const handleConnect = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
      // Loading state will be set to false after initial content is received
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      setError("Disconnected from server. Please check your network.");
      setLoading(false);
    };

    const handleUsersOnline = (event) => {
      const customEvent = event;
      setUsersOnline(customEvent.detail);
    };

    const handleInitialContent = (event) => {
      const customEvent = event;
      const initialDelta = customEvent.detail instanceof Delta ? customEvent.detail : new Delta(); // Safe fallback
      setEditorContent(initialDelta);
      latestServerContent.current = initialDelta;
      setLoading(false);
    };

    const handleIncomingDelta = (event) => {
      const customEvent = event;
      const delta = customEvent.detail;

      setEditorContent((prevContent) => {
        // Ensure prevContent is a Delta object before composing
        const currentDelta = prevContent instanceof Delta ? prevContent : new Delta(prevContent);
        const newContent = currentDelta.compose(delta);
        latestServerContent.current = newContent;
        return newContent;
      });
    };

    window.addEventListener('websocket-connected', handleConnect);
    window.addEventListener('websocket-disconnected', handleDisconnect);
    window.addEventListener('websocket-users-online', handleUsersOnline);
    window.addEventListener('initial-note-content', handleInitialContent);
    window.addEventListener('websocket-delta-received', handleIncomingDelta);

    return () => {
      disconnectWebSocket();
      window.removeEventListener('websocket-connected', handleConnect);
      window.removeEventListener('websocket-disconnected', handleDisconnect);
      window.removeEventListener('websocket-users-online', handleUsersOnline);
      window.removeEventListener('initial-note-content', handleInitialContent);
      window.removeEventListener('websocket-delta-received', handleIncomingDelta);
    };
  }, [noteId, WS_SERVER_URL]);

  const handleEditorChange = (content, delta, source, editor) => {
    if (source === 'user') {
      sendDelta(noteId, delta);
      // This line is crucial for local state update and ensuring persistence
      setEditorContent(editor.getContents()); // <--- UNCOMMENTED AND NOW ACTIVE
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-120px)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="ml-4 text-lg text-gray-700">Loading note...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 text-xl mt-8">
        <p>{error}</p>
        <p className="text-gray-600 text-base mt-2">Please ensure the backend is running and you have a valid note ID.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 py-8">
      <div className="w-full lg:w-3/4 bg-white rounded-lg shadow-xl p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Note: <span className="font-mono text-purple-700">{noteId}</span></h2>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2">
            <span className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm text-gray-700">
              Status: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-gray-700">
              Users online: {usersOnline}
            </span>
          </div>
        </div>
        <NoteEditor
          value={editorContent}
          onChange={handleEditorChange}
          noteId={noteId}
        />
      </div>

      <div className="w-full lg:w-1/4 bg-white rounded-lg shadow-xl p-6">
        <CommentSection noteId={noteId} />
      </div>
    </div>
  );
}

export default NotePage;
