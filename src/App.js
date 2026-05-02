import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import InvitePage from "./pages/InvitePage";
import SplashScreen from "./components/SplashScreen";
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
      // Simulate a slightly longer splash for aesthetic effect (optional, but nice)
      setTimeout(() => setAuthLoading(false), 1500);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchCurrentUser();
    } else {
      setTimeout(() => setAuthLoading(false), 1000);
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

  // While resolving auth state, render the premium splash screen
  if (authLoading) {
    return <SplashScreen />;
  }

  return (
    <div className="App">
      <BrowserRouter basename={process.env.PUBLIC_URL}>
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
