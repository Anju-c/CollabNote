import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createNote } from '../services/api.js';

function HomePage() {
  const navigate = useNavigate();

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
      <p className="mt-8 text-sm text-gray-500">
        Already have a note ID? Just paste it in the URL: <span className="font-mono text-purple-700">/note/your-note-id</span>
      </p>
    </div>
  );
}

export default HomePage;
