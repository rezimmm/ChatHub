import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { MessageSquare, Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function InvitePage({ user, token }) {
  const { token: inviteToken } = useParams();
  const navigate = useNavigate();
  const [inviteInfo, setInviteInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

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
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Joined ${data.channel_name}!`);
        navigate('/');
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to join channel');
      }
    } catch (error) {
      toast.error('Failed to join channel');
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="absolute top-8 left-8 flex items-center gap-2">
        <div className="bg-violet-600 p-2 rounded-lg">
          <MessageSquare className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-teal-600 bg-clip-text text-transparent">ChatHub</span>
      </div>

      <Card className="max-w-md w-full shadow-2xl border-none overflow-hidden bg-white dark:bg-slate-800">
        <div className="h-24 bg-gradient-to-r from-violet-600 to-teal-600" />
        <CardHeader className="text-center -mt-12">
          <div className="mx-auto p-1 bg-white dark:bg-slate-800 rounded-full shadow-lg">
            <Avatar className="h-20 w-20 border-4 border-white dark:border-slate-800">
              <AvatarFallback className="text-2xl font-bold bg-violet-100 text-violet-600">
                {inviteInfo.channel_name[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl font-bold mt-4">{inviteInfo.channel_name}</CardTitle>
          <CardDescription className="text-base flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4" />
            {inviteInfo.member_count} members
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          <p className="text-gray-600 dark:text-gray-300 italic mb-4">
            "{inviteInfo.channel_description || 'No description provided'}"
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Invited by <span className="font-semibold text-gray-900 dark:text-white">@{inviteInfo.created_by_username}</span>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button 
            onClick={handleJoin} 
            disabled={joining}
            className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-lg font-semibold shadow-lg shadow-violet-600/20 transition-all active:scale-95"
          >
            {joining ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Joining...
              </>
            ) : (
              'Join Channel'
            )}
          </Button>
          {!token && (
            <p className="text-xs text-gray-500 text-center">
              You will be asked to sign in or create an account to join.
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
