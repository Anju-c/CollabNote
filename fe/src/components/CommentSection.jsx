import React, { useState, useEffect } from 'react';
import { getComments, addComment } from '../services/api.js';
import { onReceiveComment } from '../services/websocket.js';
import { getUserInfo } from '../utils/auth.js';

function CommentSection({ noteId }) {
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentUser = getUserInfo();

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedComments = await getComments(noteId);
        setComments(fetchedComments);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setError('Failed to load comments.');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();

    const handleIncomingComment = (event) => {
      const customEvent = event;
      const comment = customEvent.detail;
      if (comment.noteId === noteId) {
        setComments((prevComments) => [...prevComments, comment]);
      }
    };

    window.addEventListener('websocket-comment-received', handleIncomingComment);

    return () => {
      window.removeEventListener('websocket-comment-received', handleIncomingComment);
    };
  }, [noteId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    if (!currentUser || !currentUser.username) {
      alert('You must be logged in to add comments.');
      return;
    }

    try {
      await addComment(noteId, newCommentText);
      setNewCommentText('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment. Please try again.');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-500">Loading comments...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600">{error}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Comments</h3>
      <div className="flex-grow overflow-y-auto pr-2 mb-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm">No comments yet. Be the first to add one!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 p-3 rounded-md mb-3 shadow-sm">
              <p className="text-sm text-gray-800">{comment.text}</p>
              <p className="text-xs text-gray-500 mt-1">
                — {comment.author ? comment.author.username : 'Anonymous'} at {new Date(comment.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleAddComment} className="mt-auto">
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
          rows="3"
          placeholder={currentUser ? "Add a comment..." : "Login to add comments..."}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          disabled={!currentUser}
        ></textarea>
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md shadow-md mt-2 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!currentUser || !newCommentText.trim()}
        >
          Add Comment
        </button>
      </form>
    </div>
  );
}

export default CommentSection;
