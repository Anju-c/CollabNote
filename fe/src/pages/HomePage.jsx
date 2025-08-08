import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createNote, getRecentNotes } from '../services/api.js';
import { getToken } from '../utils/auth.js';

function HomePage() {
  const navigate = useNavigate();
  const [recentNotes, setRecentNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = !!getToken();

  useEffect(() => {
    const fetchRecentNotes = async () => {
      if (isAuthenticated) {
        try {
          const notes = await getRecentNotes();
          setRecentNotes(notes);
        } catch (error) {
          console.error('Error fetching recent notes:', error);
          // Handle error, e.g., show a message to the user
        }
      }
      setLoading(false);
    };
    fetchRecentNotes();
  }, [isAuthenticated]);

  const handleCreateNewNote = async () => {
    try {
      const response = await createNote();
      if (response && response.noteId) {
        navigate(`/note/${response.noteId}`);
      } else {
        console.error('Failed to create new note: No noteId received');
        alert('Failed to create new note. Please try again.');
      }
    } catch (error) {
      console.error('Error creating new note:', error);
      alert('Error creating new note. Please check your network and try again.');
    }
  };

  if (loading && isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="ml-4 text-lg text-gray-700 mt-4">Loading your recent notes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <h1 className="text-4xl font-extrabold text-gray-800 mb-6">Welcome to CollabNotebook</h1>
      <p className="text-lg text-gray-600 mb-8 max-w-xl text-center">
        Your real-time collaborative note-taking tool. Create, edit, and share notes instantly.
      </p>
      <button
        onClick={handleCreateNewNote}
        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-300"
      >
        Create New Note
      </button>

      {isAuthenticated && recentNotes.length > 0 && (
        <div className="mt-12 w-full max-w-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Your Recent Notes</h2>
          <ul className="bg-white rounded-lg shadow-md p-4">
            {recentNotes.map((note) => (
              <li key={note.id} className="border-b last:border-b-0 border-gray-200 py-3">
                <button
                  onClick={() => navigate(`/note/${note.id}`)}
                  className="w-full text-left text-purple-600 hover:text-purple-800 font-medium truncate"
                >
                  Note ID: {note.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isAuthenticated && (
        <p className="mt-8 text-sm text-gray-500">
          Login to view your recent notes or paste a note ID to join: <span className="font-mono text-purple-700">/note/your-note-id</span>
        </p>
      )}
    </div>
  );
}

export default HomePage;
