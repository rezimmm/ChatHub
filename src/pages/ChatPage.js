import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import UserList from '../components/UserList';
import SearchModal from '../components/SearchModal';
import UserProfileModal from '../components/UserProfileModal';
import ThreadPanel from '../components/ThreadPanel';
import ChannelSettingsModal from '../components/ChannelSettingsModal';
import { Toaster } from '../components/ui/sonner';
import { toast } from 'sonner';
import { Moon, Sun, Menu, Users, X, Wifi, WifiOff, Loader2, Settings } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export default function ChatPage({ user, token, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [currentUser, setCurrentUser] = useState(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userListOpen, setUserListOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [activeThread, setActiveThread] = useState(null);
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false);
  const wsRef = useRef(null);
  const currentChannelRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const readQueueRef = useRef(new Set());
  const readTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { currentChannelRef.current = currentChannel; }, [currentChannel]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setWsStatus('connecting');
    const ws = new WebSocket(`${WS_URL}/api/ws/${user.id}`);
    
    ws.onopen = () => { setWsStatus('connected'); reconnectAttemptRef.current = 0; };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      
      if (data.type === 'message') {
        setMessages(prev => {
          if (prev.some(msg => msg.id === data.data.id)) return prev;
          return [...prev, data.data];
        });
        // Browser notification for messages from others
        if (data.data.user_id !== user.id && document.hidden && Notification.permission === 'granted') {
          try {
            new Notification(`${data.data.username}`, {
              body: data.data.content.substring(0, 100),
              icon: data.data.avatar_url || undefined,
              tag: data.data.id
            });
          } catch { /* notification not supported */ }
        }
      } else if (data.type === 'message_updated' || data.type === 'thread_updated') {
        setMessages(prev => prev.map(msg => msg.id === data.data.id ? data.data : msg));
      } else if (data.type === 'message_deleted') {
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
      } else if (data.type === 'reaction_updated') {
        setMessages(prev => prev.map(msg => msg.id === data.data.id ? data.data : msg));
      } else if (data.type === 'message_read') {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.message_id) {
            const readBy = msg.read_by || [];
            if (!readBy.includes(data.user_id)) {
              return { ...msg, read_by: [...readBy, data.user_id] };
            }
          }
          return msg;
        }));
      } else if (data.type === 'typing') {
        const curChannel = currentChannelRef.current;
        if (data.channel_id === curChannel?.id) {
          setTypingUsers(prev => ({ ...prev, [data.user_id]: data.is_typing ? data.username : null }));
          setTimeout(() => { setTypingUsers(prev => { const u = { ...prev }; delete u[data.user_id]; return u; }); }, 3000);
        }
      } else if (data.type === 'user_status') {
        setUsers(prev => prev.map(u => u.id === data.user_id ? { ...u, is_online: data.is_online, status: data.status, last_seen: data.last_seen || data.timestamp } : u));
      } else if (data.type === 'channel_updated') {
        fetchChannels();
      }
    };

    ws.onerror = () => setWsStatus('disconnected');
    ws.onclose = () => {
      setWsStatus('disconnected');
      wsRef.current = null;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectAttemptRef.current = attempt + 1;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => { setWsStatus('reconnecting'); connectWebSocket(); }, delay);
    };
    wsRef.current = ws;
  }, [user.id]);

  const fetchChannels = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/channels`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setChannels(data);
      return data;
    } catch { toast.error('Failed to load channels'); return []; }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      setUsers(await response.json());
    } catch { toast.error('Failed to load users'); }
  }, [token]);

  const fetchMessages = useCallback(async (channelId, before = null) => {
    try {
      setLoadingMessages(true);
      let url = `${BACKEND_URL}/api/channels/${channelId}/messages?limit=50`;
      if (before) url += `&before=${encodeURIComponent(before)}`;
      const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (before) { setMessages(prev => [...data, ...prev]); } else { setMessages(data); }
      setHasMoreMessages(data.length === 50);
    } catch { toast.error('Failed to load messages'); } finally { setLoadingMessages(false); }
  }, [token]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const channelData = await fetchChannels();
      await fetchUsers();
      if (channelData.length > 0) {
        const targetChannelId = location.state?.channelId;
        if (targetChannelId) {
          const target = channelData.find(c => c.id === targetChannelId);
          setCurrentChannel(target || channelData[0]);
          // Clear state so reload doesn't get stuck
          navigate('/', { replace: true, state: {} });
        } else {
          setCurrentChannel(channelData[0]);
        }
      }
      setLoading(false);
    };
    init();
    connectWebSocket();
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const handleKeyPress = (e) => { if (e.ctrlKey && e.key === 'k') { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      window.removeEventListener('keydown', handleKeyPress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentChannel) {
      fetchMessages(currentChannel.id);
      markAllRead(currentChannel.id);
      setActiveThread(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChannel]);

  useEffect(() => {
    if (channels.length > 0) {
      const exists = currentChannel ? channels.find(c => c.id === currentChannel.id) : null;
      if (!exists) {
        setCurrentChannel(channels[0]);
      } else if (exists !== currentChannel) {
        // Update the current channel object reference if it changed in the channels list
        // (e.g. after a mark-as-read update) but ONLY if we aren't already in an update cycle.
        // Actually, to be safe and avoid loops, we'll only set it if the ID changed.
      }
    }
  }, [channels]); // Remove currentChannel from dependencies to prevent recursive updates

  const loadOlderMessages = async () => {
    if (!currentChannel || !hasMoreMessages || loadingMessages || messages.length === 0) return;
    await fetchMessages(currentChannel.id, messages[0]?.timestamp);
  };

  const markAllRead = async (channelId) => {
    try {
      await fetch(`${BACKEND_URL}/api/channels/${channelId}/read-all`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      setChannels(prev => prev.map(ch => {
        if (ch.id === channelId) { return { ...ch, unread_count: { ...ch.unread_count, [user.id]: 0 } }; }
        return ch;
      }));
    } catch { /* non-critical */ }
  };

  // Batched read receipt marking
  const markMessageRead = useCallback((messageId) => {
    readQueueRef.current.add(messageId);
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(async () => {
      const ids = Array.from(readQueueRef.current);
      readQueueRef.current.clear();
      for (const id of ids) {
        try {
          await fetch(`${BACKEND_URL}/api/messages/${id}/read`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch { /* non-critical */ }
      }
    }, 1000);
  }, [token]);

  const sendMessage = async (content, replyTo = null) => {
    if (!currentChannel || !content.trim()) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ channel_id: currentChannel.id, content: content.trim(), reply_to: replyTo })
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Failed'); }
    } catch (error) { toast.error(error.message || 'Failed to send message'); }
  };

  const sendThreadReply = async (content, threadId, channelId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ channel_id: channelId, content: content.trim(), thread_id: threadId })
      });
      if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Failed'); }
      return true;
    } catch (error) { toast.error(error.message || 'Failed to send reply'); return false; }
  };

  const editMessage = async (messageId, content) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/messages/${messageId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content })
      });
      if (!r.ok) throw new Error();
      toast.success('Message updated');
    } catch { toast.error('Failed to edit message'); }
  };

  const deleteMessage = async (messageId) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/messages/${messageId}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!r.ok) throw new Error();
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete message'); }
  };

  const addReaction = async (messageId, emoji) => {
    try {
      await fetch(`${BACKEND_URL}/api/messages/${messageId}/reactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ emoji })
      });
    } catch { toast.error('Failed to add reaction'); }
  };

  const pinMessage = async (messageId) => {
    try {
      await fetch(`${BACKEND_URL}/api/messages/${messageId}/pin`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      toast.success('Message pin toggled');
    } catch { toast.error('Failed to pin message'); }
  };

  const handleTyping = (isTyping) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && currentChannel) {
      wsRef.current.send(JSON.stringify({ type: 'typing', user_id: user.id, username: user.username, channel_id: currentChannel.id, is_typing: isTyping }));
    }
  };

  const createChannel = async (name, description, members, isPrivate, password) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/channels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, description, is_dm: false, members, is_private: isPrivate, password })
      });
      if (r.ok) {
        const nc = await r.json();
        setChannels(prev => [...prev, nc]);
        setCurrentChannel(nc);
        toast.success('Channel created!');
        return true;
      }
    } catch { toast.error('Failed to create channel'); }
    return false;
  };

  const toggleFavorite = async (channelId) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/channels/${channelId}/favorite`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
      });
      if (r.ok) {
        const updated = await r.json();
        // Update the channels list with the returned channel data
        setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, ...updated } : ch));
        // Also sync currentChannel if it's the one being toggled
        if (currentChannel?.id === channelId) {
          setCurrentChannel(prev => ({ ...prev, ...updated }));
        }
      }
    } catch { toast.error('Failed to toggle favorite'); }
  };

  const createDirectMessage = async (targetUserId) => {
    const existing = channels.find(ch => ch.is_dm && ch.members.length === 2 && ch.members.includes(targetUserId) && ch.members.includes(user.id));
    if (existing) { setCurrentChannel(existing); setUserListOpen(false); return; }
    const target = users.find(u => u.id === targetUserId);
    if (!target) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/channels`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: `${user.username}, ${target.username}`, description: '', is_dm: true, members: [user.id, targetUserId] })
      });
      if (r.ok) {
        const nc = await r.json();
        setChannels(prev => {
          if (prev.some(ch => ch.id === nc.id)) return prev;
          return [...prev, nc];
        });
        setCurrentChannel(nc);
        setUserListOpen(false);
      }
    } catch { toast.error('Failed to create direct message'); }
  };

  const updateUserProfile = async (updates) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/users/me`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      if (r.ok) {
        const updatedUser = await r.json();
        setCurrentUser(updatedUser);
        // Also refresh the entry in the users list (sidebar/user list panel)
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        toast.success('Profile updated!');
        return updatedUser; // Return the object so modal can refresh its state
      }
    } catch { toast.error('Failed to update profile'); }
    return null;
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await fetch(`${BACKEND_URL}/api/upload`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      if (!r.ok) {
        let errorDetail = 'Upload failed';
        try {
          const err = await r.json();
          errorDetail = err.detail || err.message || errorDetail;
        } catch { /* not json */ }
        throw new Error(errorDetail);
      }
      const data = await r.json();
      if (!data.url && !data.file_url) throw new Error('Server returned success but no URL');
      return data;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
      return null;
    }
  };

  const activeTypers = Object.values(typingUsers).filter(Boolean);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900" data-testid="chat-loading">
        <div className="w-72 border-r border-gray-200 dark:border-slate-700 p-4 space-y-4 hidden md:block">
          <Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-16 w-full rounded-xl" />
          <div className="space-y-2 mt-6">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}</div>
        </div>
        <div className="flex-1 flex flex-col">
          <Skeleton className="h-16 w-full" />
          <div className="flex-1 p-6 space-y-4">
            {[1,2,3,4,5].map(i => (<div key={i} className="flex gap-3"><Skeleton className="h-10 w-10 rounded-full flex-shrink-0" /><div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-3/4" /></div></div>))}
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="w-72 border-l border-gray-200 dark:border-slate-700 p-4 space-y-4 hidden lg:block">
          <Skeleton className="h-12 w-full" />
          {[1,2,3].map(i => (<div key={i} className="flex gap-3 items-center"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-1 flex-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-16" /></div></div>))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200" data-testid="chat-page">
      <Toaster position="top-right" />
      
      {(sidebarOpen || userListOpen) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => { setSidebarOpen(false); setUserListOpen(false); }} data-testid="mobile-overlay" />
      )}

      <div className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar channels={channels} currentChannel={currentChannel}
          onSelectChannel={(ch) => { setCurrentChannel(ch); setSidebarOpen(false); }}
          onCreateChannel={createChannel} onToggleFavorite={toggleFavorite}
          user={currentUser} onLogout={onLogout} onOpenProfile={() => setProfileOpen(true)}
          onOpenUserList={() => setUserListOpen(true)}
          wsStatus={wsStatus} darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative bg-white dark:bg-slate-900 overflow-hidden">
        <header className="sticky top-0 z-30 h-14 sm:h-16 border-b border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex-shrink-0 shadow-sm transition-all duration-300">
          <div className="flex items-center justify-between h-full px-3 sm:px-6 gap-2">
            {/* Left Section: Menu & Channel Info */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSidebarOpen(true)} 
                className="md:hidden h-9 w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 flex-shrink-0"
                data-testid="mobile-menu-button"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 dark:text-white truncate text-sm sm:text-lg">
                      {currentChannel ? (currentChannel.is_dm ? currentChannel.name : `# ${currentChannel.name}`) : 'ChatHub'}
                    </span>
                    {currentChannel && !currentChannel.is_dm && (
                      <Button variant="ghost" size="icon" onClick={() => setChannelSettingsOpen(true)} className="h-7 w-7 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 flex-shrink-0">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 md:hidden">
                    <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500' : wsStatus === 'reconnecting' ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-tighter">
                      {wsStatus}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Section: Actions */}
            <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
              {/* Connection Status (Desktop) */}
              <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                wsStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                : wsStatus === 'reconnecting' ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                : 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20'
              }`}>
                {wsStatus === 'connected' ? <Wifi className="h-3 w-3" /> 
                : wsStatus === 'reconnecting' ? <Loader2 className="h-3 w-3 animate-spin" />
                : <WifiOff className="h-3 w-3" />}
                <span className="uppercase tracking-widest">{wsStatus}</span>
              </div>

              {/* Action Group */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setDarkMode(!darkMode)} 
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gray-50 dark:bg-slate-800/50 text-gray-600 dark:text-gray-400 border border-gray-200/50 dark:border-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                  title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {darkMode ? <Sun className="h-4 w-4 text-yellow-500" /> : <Moon className="h-4 w-4 text-violet-600" />}
                </Button>

                <Button 
                  variant="default" 
                  size="icon" 
                  onClick={() => setUserListOpen(true)} 
                  data-testid="mobile-users-button" 
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20 flex-shrink-0 transition-transform active:scale-95 flex items-center justify-center border-2 border-white dark:border-slate-900"
                  title="Show Team Members"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <ChatArea
            channel={currentChannel} messages={messages}
            onSendMessage={sendMessage} onEditMessage={editMessage} onDeleteMessage={deleteMessage}
            onAddReaction={addReaction} onPinMessage={pinMessage} onTyping={handleTyping}
            currentUser={currentUser} typingUsers={activeTypers}
            loadingMessages={loadingMessages} hasMoreMessages={hasMoreMessages} onLoadMore={loadOlderMessages}
            onUploadFile={uploadFile} token={token}
            onOpenThread={(msg) => setActiveThread(msg)}
            onMarkRead={markMessageRead}
            users={users}
            onOpenChannelSettings={() => setChannelSettingsOpen(true)}
            onOpenUserList={() => setUserListOpen(true)}
          />
          {activeThread && (
            <ThreadPanel
              parentMessage={activeThread}
              onClose={() => setActiveThread(null)}
              currentUser={currentUser}
              token={token}
              onSendThreadReply={sendThreadReply}
            />
          )}
        </div>
      </div>

      <div className={`fixed inset-y-0 right-0 z-40 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${userListOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="relative h-full">
          <Button variant="ghost" size="icon" onClick={() => setUserListOpen(false)} className="absolute top-3 right-3 z-10 lg:hidden" data-testid="close-user-list"><X className="h-5 w-5" /></Button>
          <UserList users={users} currentUser={currentUser} onStartDM={createDirectMessage} />
        </div>
      </div>



      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)}
        onSelectMessage={(message) => { const ch = channels.find(c => c.id === message.channel_id); if (ch) setCurrentChannel(ch); setSearchOpen(false); }} token={token} />
      <UserProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} user={currentUser} onUpdate={updateUserProfile} token={token} onLogout={onLogout} onUpload={uploadFile} />
      <ChannelSettingsModal
        open={channelSettingsOpen}
        onClose={() => setChannelSettingsOpen(false)}
        channel={currentChannel}
        currentUser={currentUser}
        token={token}
        allUsers={users}
        onChannelUpdated={fetchChannels}
      />
    </div>
  );
}
