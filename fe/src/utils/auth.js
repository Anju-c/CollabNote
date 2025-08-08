const TOKEN_KEY = 'collabnotebook_jwt';
const USER_INFO_KEY = 'collabnotebook_user_info';

// Use sessionStorage for per-tab authentication (different users per tab)
// Change to localStorage if you want shared auth across tabs
const storage = sessionStorage; // or localStorage

export const setToken = (token) => {
  storage.setItem(TOKEN_KEY, token);
  console.log('🔑 Token stored for tab');
};

export const getToken = () => {
  const token = storage.getItem(TOKEN_KEY);
  if (!token) {
    console.log('⚠️ No token found in storage');
    return null;
  }

  // Check if token is expired
  if (isTokenExpired(token)) {
    console.log('⏰ Token expired, removing from storage...');
    removeToken();
    return null;
  }

  const decoded = decodeToken(token);
  if (decoded) {
    console.log('✅ Valid token found for user:', decoded.username, '(ID:', decoded.userId, ')');
  }

  return token;
};

export const removeToken = () => {
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_INFO_KEY);
  console.log('🧹 Removed token and user info from storage');
};

export const setUserInfo = (userInfo) => {
  storage.setItem(USER_INFO_KEY, JSON.stringify(userInfo));
  console.log('👤 User info stored:', userInfo.username, '(ID:', userInfo.id || userInfo.userId, ')');
};

export const getUserInfo = () => {
  const userInfo = storage.getItem(USER_INFO_KEY);
  if (!userInfo || userInfo === 'null') {
    console.log('⚠️ No user info found in storage');
    return null;
  }
  
  try {
    const parsed = JSON.parse(userInfo);
    console.log('👤 Retrieved user info:', parsed.username, '(ID:', parsed.id || parsed.userId, ')');
    return parsed;
  } catch (error) {
    console.error('❌ Error parsing user info:', error);
    return null;
  }
};

export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("❌ Error decoding token:", e);
    return null;
  }
};

export const updateUserInfoFromToken = (token) => {
  const decoded = decodeToken(token);
  if (decoded && decoded.userId && decoded.username) {
    setUserInfo({ userId: decoded.userId, username: decoded.username, id: decoded.userId });
    console.log('🔄 Updated user info from token:', decoded.username);
  }
};

// New function to check if token is expired
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    
    const now = Date.now() / 1000;
    const isExpired = decoded.exp < now;
    
    if (isExpired) {
      console.log('⏰ Token is expired');
    }
    
    return isExpired;
  } catch (error) {
    console.error('❌ Error checking token expiration:', error);
    return true;
  }
};

// Check if user is authenticated with valid token
export const isAuthenticated = () => {
  const token = getToken();
  const authenticated = token !== null && !isTokenExpired(token);
  console.log('🔐 Authentication status:', authenticated ? 'Authenticated' : 'Not authenticated');
  return authenticated;
};

// Get token expiration time
export const getTokenExpiration = (token) => {
  const decoded = decodeToken(token);
  return decoded ? decoded.exp * 1000 : null; // Convert to milliseconds
};

// Get remaining time until token expires (in minutes)
export const getTokenTimeRemaining = (token) => {
  const exp = getTokenExpiration(token);
  if (!exp) return 0;
  
  const now = Date.now();
  const remaining = exp - now;
  return Math.max(0, Math.floor(remaining / (1000 * 60))); // Minutes
};

// Start periodic token validation check
export const startTokenValidationCheck = () => {
  // Check every 5 minutes
  const interval = setInterval(() => {
    const token = storage.getItem(TOKEN_KEY);
    if (token && isTokenExpired(token)) {
      console.log('⏰ Token expired during validation check, cleaning up...');
      removeToken();
      // Dispatch custom event to notify app components
      window.dispatchEvent(new CustomEvent('token-expired'));
    }
  }, 5 * 60 * 1000); // 5 minutes

  return interval;
};

// Clear validation check interval
export const stopTokenValidationCheck = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
};

// DEBUG UTILITIES
export const debugAuthState = () => {
  const token = storage.getItem(TOKEN_KEY);
  const userInfo = storage.getItem(USER_INFO_KEY);
  
  console.log('🔍 AUTH DEBUG STATE (Tab-specific):');
  console.log('  Storage type:', storage === sessionStorage ? 'sessionStorage' : 'localStorage');
  console.log('  Token:', token ? `${token.substring(0, 20)}...` : 'null');
  console.log('  User Info raw:', userInfo);
  
  if (token) {
    try {
      const payload = decodeToken(token);
      if (payload) {
        console.log('  Token Payload:', payload);
        console.log('  User ID:', payload.userId);
        console.log('  Username:', payload.username);
        console.log('  Token Expires:', new Date(payload.exp * 1000).toLocaleString());
        console.log('  Current Time:', new Date().toLocaleString());
        console.log('  Token Valid:', payload.exp * 1000 > Date.now());
      }
    } catch (e) {
      console.log('  Token decode error:', e.message);
    }
  }
  
  if (userInfo && userInfo !== 'null') {
    try {
      const parsed = JSON.parse(userInfo);
      console.log('  Parsed User Info:', parsed);
    } catch (e) {
      console.log('  User info parse error:', e.message);
    }
  }
  
  return { token, userInfo };
};

export const debugClearAuth = () => {
  removeToken();
  console.log('🔄 Cleared auth state for this tab - please refresh and re-login');
};

export const debugTestAuth = async () => {
  const token = getToken();
  if (!token) {
    console.log('❌ No token found for auth test');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3001/api/notes/recent', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🧪 Auth test response status:', response.status);
    if (response.ok) {
      console.log('✅ Auth test successful - token is valid');
    } else {
      const error = await response.text();
      console.log('❌ Auth test failed:', error);
    }
  } catch (error) {
    console.log('❌ Auth test network error:', error);
  }
};

export const debugSwitchStorageType = (useLocalStorage = false) => {
  const currentToken = storage.getItem(TOKEN_KEY);
  const currentUserInfo = storage.getItem(USER_INFO_KEY);
  
  // Clear current storage
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_INFO_KEY);
  
  // Switch storage type
  // Note: This is just for debugging - you'd need to restart the app
  console.log(`🔄 Switching to ${useLocalStorage ? 'localStorage' : 'sessionStorage'}`);
  console.log('⚠️ Please restart the application for this change to take effect');
  
  return { currentToken, currentUserInfo };
};

// Add to window for easy debugging
if (typeof window !== 'undefined') {
  window.debugAuth = {
    debugAuthState,
    debugClearAuth,
    debugTestAuth,
    debugSwitchStorageType,
    getToken,
    getUserInfo,
    isAuthenticated
  };
  
  console.log('🛠️ Debug utilities available at window.debugAuth');
}