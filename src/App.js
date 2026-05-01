import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import InvitePage from "./pages/InvitePage";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [authLoading, setAuthLoading] = useState(!!localStorage.getItem('token'));

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      setAuthLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setAuthLoading(false);
    }
  }, [token, fetchCurrentUser]);

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  // While resolving auth state (async user fetch), render a neutral loading screen
  // so we never redirect prematurely (avoids blank /auth flash on page refresh)
  if (authLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0f0f1a'
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid #7c3aed',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route 
            path="/auth" 
            element={
              token && user ? <Navigate to="/" /> : <AuthPage onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/invite/:token" 
            element={<InvitePage user={user} token={token} />} 
          />
          <Route 
            path="/" 
            element={
              token && user ? (
                <ChatPage user={user} token={token} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" />
              )
            } 
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
