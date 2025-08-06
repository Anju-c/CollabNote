import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import NotePage from './pages/NotePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { getToken, removeToken } from './utils/auth.js';
import { io } from 'socket.io-client'; // Import io directly here for initial content handling

// Define the WebSocket server URL
const WS_SERVER_URL = 'http://localhost:3001';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken()) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogout = () => {
    removeToken();
    setIsAuthenticated(false);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-gray-100 font-inter">
      <nav className="bg-white shadow-md py-4 px-6 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-purple-700">
          CollabNotebook
        </Link>
        <div>
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-300 ease-in-out"
            >
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md shadow-sm transition duration-300 ease-in-out"
            >
              Login / Register
            </Link>
          )}
        </div>
      </nav>

      <div className="container mx-auto p-4">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Pass WS_SERVER_URL to NotePage */}
          <Route path="/note/:id" element={<NotePage WS_SERVER_URL={WS_SERVER_URL} />} />
          <Route path="/auth" element={<AuthPage setIsAuthenticated={setIsAuthenticated} />} />
          <Route path="*" element={<h2 className="text-center text-xl text-gray-700 mt-8">404 - Page Not Found</h2>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
