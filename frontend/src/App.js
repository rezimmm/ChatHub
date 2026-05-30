import { useState, useEffect, useCallback } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import InvitePage from "./pages/InvitePage";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

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
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchCurrentUser]);

  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 font-semibold animate-pulse">Loading ChatHub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <HashRouter>
        <Routes>
          <Route 
            path="/auth" 
            element={
              token ? <Navigate to="/" /> : <AuthPage onLogin={handleLogin} />
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
      </HashRouter>
    </div>
  );
}

export default App;
