import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser, loginUser } from '../services/api.js';
import { setToken, updateUserInfoFromToken } from '../utils/auth.js'; // Import updateUserInfoFromToken

function AuthPage({ setIsAuthenticated }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      let response;
      if (isLogin) {
        response = await loginUser(username, password);
        setMessage('Login successful!');
      } else {
        response = await registerUser(username, password);
        setMessage('Registration successful! Please log in.');
        setIsLogin(true);
      }

      if (response && response.token) {
        setToken(response.token);
        updateUserInfoFromToken(response.token); // Update user info after setting token
        setIsAuthenticated(true);
        navigate('/');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setMessage(error.message || 'An error occurred during authentication.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)]">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          {isLogin ? 'Login' : 'Register'}
        </h2>
        {message && (
          <p className={`mb-4 text-center ${message.includes('successful') ? 'text-green-600' : 'text-red-600'}`}>
            {message}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-300 ease-in-out"
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-purple-600 hover:text-purple-500 focus:outline-none"
          >
            {isLogin ? 'Register here' : 'Login here'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default AuthPage;
