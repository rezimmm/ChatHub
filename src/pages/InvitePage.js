import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { MessageSquare, Users, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function InvitePage({ user, token }) {
  const { token: inviteToken } = useParams();
  const navigate = useNavigate();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');

  useEffect(() => {
    fetchInviteInfo();
  }, [inviteToken]);

  const fetchInviteInfo = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/invites/${inviteToken}/info`);
      if (response.ok) {
        const data = await response.json();
        setInviteInfo(data);
      } else {
        const err = await response.json();
        setError(err.detail || 'Invite link is invalid or expired');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!token) {
      toast.error('Please login first to join');
      navigate('/auth', { state: { from: `/invite/${inviteToken}` } });
      return;
    }

    setJoining(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/invites/${inviteToken}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Joined ${data.channel_name}!`);
        navigate('/', { state: { channelId: data.channel_id } });
      } else {
        const err = await response.json();
        throw new Error(err.detail || err.message || 'Failed to join channel');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to join channel');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
        <Card className="max-w-md w-full shadow-xl border-t-4 border-t-red-500">
          <CardHeader className="text-center">
            <div className="mx-auto bg-red-100 dark:bg-red-900/30 p-3 rounded-full w-fit mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Invalid Invite</CardTitle>
            <CardDescription className="text-base">{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate('/')} className="w-full bg-violet-600 hover:bg-violet-700">
              Go to Home
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100 via-slate-50 to-teal-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob dark:opacity-10"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-teal-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:opacity-10"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-fuchsia-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 dark:opacity-10"></div>

      <div className="absolute top-8 left-8 flex items-center gap-3 z-10">
        <div className="bg-gradient-to-tr from-violet-600 to-teal-500 p-2.5 rounded-xl shadow-lg shadow-violet-500/30">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <span className="text-2xl font-black bg-gradient-to-r from-violet-600 to-teal-600 bg-clip-text text-transparent drop-shadow-sm">ChatHub</span>
      </div>

      <div className="relative w-full max-w-md z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-teal-500 transform scale-[0.96] rounded-3xl blur-xl opacity-30 dark:opacity-20"></div>
        <Card className="relative w-full shadow-2xl border border-white/50 dark:border-slate-700/50 overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-3xl">
          <div className="h-32 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-teal-500 relative">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>
          <CardHeader className="text-center -mt-16 pb-2 relative z-10">
            <div className="mx-auto p-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-xl inline-block mb-3">
              <Avatar className="h-24 w-24 border-4 border-white dark:border-slate-700 shadow-inner">
                <AvatarFallback className="text-4xl font-black bg-gradient-to-tr from-violet-100 to-teal-50 text-violet-700 dark:from-slate-700 dark:to-slate-600 dark:text-white">
                  {inviteInfo.channel_name[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{inviteInfo.channel_name}</CardTitle>
            <div className="flex items-center justify-center gap-2 mt-2">
              <CardDescription className="text-sm font-medium flex items-center gap-1.5 bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 w-fit px-3 py-1 rounded-full">
                <Users className="h-4 w-4" />
                {inviteInfo.member_count} Members
              </CardDescription>
              {inviteInfo.is_private && (
                <CardDescription className="text-sm font-bold flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 w-fit px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/30">
                  <Lock className="h-3.5 w-3.5" />
                  Private
                </CardDescription>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-center py-6 px-8 relative z-10">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 mb-6 border border-slate-100 dark:border-slate-700/50 shadow-sm">
              <p className="text-gray-700 dark:text-gray-300 italic text-[15px] leading-relaxed">
                "{inviteInfo.channel_description || 'Join our vibrant community and start chatting today!'}"
              </p>
            </div>
            <div className="inline-flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-4 py-2 rounded-full text-sm font-medium border border-violet-100 dark:border-violet-800/30">
              <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse"></span>
              Invited by <span className="font-bold">@{inviteInfo.created_by_username || 'Unknown'}</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8 px-8 relative z-10">
            {inviteInfo?.requires_password && (
              <div className="w-full space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">Channel Password</label>
                <input
                  type="password"
                  placeholder="Enter password to join..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 text-gray-900 dark:text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-slate-500 shadow-inner"
                />
              </div>
            )}
            <Button 
              onClick={handleJoin} 
              disabled={joining || (inviteInfo?.requires_password && !password)}
              className="w-full h-14 bg-gradient-to-r from-violet-600 to-teal-600 hover:from-violet-500 hover:to-teal-500 text-white text-lg font-bold rounded-xl shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden border-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:animate-shine" />
              {joining ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Joining Community...
                </>
              ) : (
                'Accept Invite'
              )}
            </Button>
            {!token && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
                You'll be prompted to sign in or create an account first.
              </p>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
