import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { MessageSquare, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Footer from '../components/Footer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateFields = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!isLogin) {
      if (!username.trim()) {
        errs.username = 'Username is required';
      } else if (username.trim().length < 2) {
        errs.username = 'Username must be at least 2 characters';
      } else if (username.trim().length > 30) {
        errs.username = 'Username must be 30 characters or less';
      } else if (!/^[a-zA-Z0-9_\- ]+$/.test(username.trim())) {
        errs.username = 'Only letters, numbers, spaces, hyphens, underscores';
      }
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;
    setLoading(true);
    setErrors({});

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password }
        : { email, username: username.trim(), password };

      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      let data;
      try {
        data = await response.json();
      } catch {
        if (response.status === 429) {
          setErrors({ general: 'Too many attempts. Please wait a moment and try again.' });
          return;
        }
        setErrors({ general: 'Server error. Please try again.' });
        return;
      }

      if (response.ok) {
        toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
        onLogin(data.access_token, data.user);
      } else if (response.status === 429) {
        setErrors({ general: 'Too many attempts. Please wait a moment and try again.' });
      } else {
        if (response.status === 422 && Array.isArray(data.detail)) {
          const fieldErrors = {};
          data.detail.forEach(err => {
            const field = err.loc?.[err.loc.length - 1];
            if (field) fieldErrors[field] = err.msg.replace('Value error, ', '');
          });
          setErrors(fieldErrors);
        } else {
          const msg = typeof data.detail === 'string' ? data.detail : 'Authentication failed';
          if (msg.toLowerCase().includes('email')) {
            setErrors({ email: msg });
          } else if (msg.toLowerCase().includes('username')) {
            setErrors({ username: msg });
          } else if (msg.toLowerCase().includes('password')) {
            setErrors({ password: msg });
          } else {
            setErrors({ general: msg });
          }
        }
      }
    } catch (error) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div 
        className="flex-grow flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1764776257398-ee6913125975?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundBlendMode: 'overlay'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-teal-500/10 backdrop-blur-3xl"></div>
        <Card className="w-full max-w-md shadow-2xl border-violet-200 dark:border-violet-900 relative z-10 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90" data-testid="auth-card">
          <CardHeader className="space-y-2 text-center pb-6">
            <div className="flex justify-center mb-4">
              <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-4 rounded-2xl shadow-lg transform hover:scale-105 transition-transform duration-200">
                <MessageSquare className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-teal-600 bg-clip-text text-transparent">
              {isLogin ? 'Welcome Back' : 'Join ChatHub'}
            </CardTitle>
            <CardDescription className="text-base">
              {isLogin ? 'Sign in to continue your conversations' : 'Create your account and start collaborating'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
              {errors.general && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400" data-testid="auth-error-general">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{errors.general}</span>
                </div>
              )}
              <div className="space-y-1">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }}
                  required
                  className={`h-11 transition-colors ${errors.email ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-violet-500'}`}
                  data-testid="email-input"
                />
                {errors.email && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1" data-testid="email-error">
                    <AlertCircle className="h-3 w-3" />{errors.email}
                  </p>
                )}
              </div>
              {!isLogin && (
                <div className="space-y-1">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); if (errors.username) setErrors(prev => ({ ...prev, username: undefined })); }}
                    required
                    className={`h-11 transition-colors ${errors.username ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-violet-500'}`}
                    data-testid="username-input"
                  />
                  {errors.username && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1" data-testid="username-error">
                      <AlertCircle className="h-3 w-3" />{errors.username}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(prev => ({ ...prev, password: undefined })); }}
                  required
                  className={`h-11 transition-colors ${errors.password ? 'border-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-violet-500'}`}
                  data-testid="password-input"
                />
                {errors.password && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1" data-testid="password-error">
                    <AlertCircle className="h-3 w-3" />{errors.password}
                  </p>
                )}
                {!isLogin && !errors.password && (
                  <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
                )}
              </div>
              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white font-medium shadow-lg hover:shadow-xl transform active:scale-95 transition-all duration-200" 
                disabled={loading}
                data-testid="auth-submit-button"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-900 text-gray-500">or</span>
              </div>
            </div>
            <div className="text-center text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
              </span>
              <button
                type="button"
                onClick={switchMode}
                className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-semibold hover:underline transition-colors"
                data-testid="toggle-auth-mode"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
