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

  // Debug current user on component mount and when it changes
  useEffect(() => {
    console.log('💬 CommentSection - Current user:', currentUser);
    if (currentUser) {
      console.log('   Username:', currentUser.username);
      console.log('   User ID:', currentUser.userId || currentUser.id);
    } else {
      console.log('   No authenticated user');
    }
  }, [currentUser]);

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`📥 Fetching comments for note ${noteId}`);
        const fetchedComments = await getComments(noteId);
        console.log(`✅ Fetched ${fetchedComments.length} comments`);
        setComments(fetchedComments);
      } catch (err) {
        console.error('❌ Error fetching comments:', err);
        setError('Failed to load comments.');
      } finally {
        setLoading(false);
      }
    };

    fetchComments();

    const handleIncomingComment = (event) => {
      const customEvent = event;
      const comment = customEvent.detail;
      
      console.log('📨 Received comment via WebSocket:', {
        id: comment.id,
        noteId: comment.noteId,
        authorId: comment.authorId,
        authorUsername: comment.author?.username,
        text: comment.text.substring(0, 50) + '...'
      });
      
      if (comment.noteId === noteId) {
        setComments((prevComments) => {
          console.log(`➕ Adding comment to UI (total will be: ${prevComments.length + 1})`);
          return [...prevComments, comment];
        });
      } else {
        console.log(`⚠️ Ignoring comment for different note: ${comment.noteId} (expected: ${noteId})`);
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

    console.log('📝 Submitting comment:', {
      noteId: noteId,
      text: newCommentText.substring(0, 50) + '...',
      userId: currentUser.userId || currentUser.id,
      username: currentUser.username
    });

    try {
      const newComment = await addComment(noteId, newCommentText);
      console.log('✅ Comment added successfully:', {
        id: newComment.id,
        authorId: newComment.authorId,
        authorUsername: newComment.author?.username
      });
      
      setNewCommentText('');
      
      // Note: The comment will be added to the UI via WebSocket event
      // so we don't need to manually add it here
    } catch (err) {
      console.error('❌ Error adding comment:', err);
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
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">Comments</h3>
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-400">
            User: {currentUser?.username || 'Anonymous'}
          </div>
        )}
      </div>
      
      <div className="flex-grow overflow-y-auto pr-2 mb-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm">No comments yet. Be the first to add one!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 p-3 rounded-md mb-3 shadow-sm">
              <p className="text-sm text-gray-800">{comment.text}</p>
              <div className="text-xs text-gray-500 mt-1 flex justify-between items-center">
                <span>
                  — {comment.author ? comment.author.username : 'Anonymous'} at {new Date(comment.createdAt).toLocaleString()}
                </span>
                {/* Debug info in development */}
                {process.env.NODE_ENV === 'development' && (
                  <span className="font-mono">
                    ID: {comment.authorId}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      
      <form onSubmit={handleAddComment} className="mt-auto">
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
          rows="3"
          placeholder={currentUser ? `Add a comment as ${currentUser.username}...` : "Login to add comments..."}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          disabled={!currentUser}
        ></textarea>
        <button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md shadow-md mt-2 transition duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!currentUser || !newCommentText.trim()}
        >
          {currentUser ? `Add Comment as ${currentUser.username}` : 'Login to Comment'}
        </button>
      </form>
      
      {/* Debug panel in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
          <strong>Debug Info:</strong><br/>
          Comments: {comments.length}<br/>
          Current User: {currentUser?.username || 'None'}<br/>
          User ID: {currentUser?.userId || currentUser?.id || 'None'}<br/>
          <button 
            onClick={() => window.debugAuth?.debugAuthState()} 
            className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
          >
            Debug Auth
          </button>
        </div>
      )}
    </div>
  );
}

export default CommentSection;