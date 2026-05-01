import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { User, Lock, Bell, AlertTriangle, Eye, EyeOff, CheckCircle2, Loader2, Camera, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

function PasswordStrength({ password }) {
  const checks = [
    { label: '6+ characters', pass: password.length >= 6 },
    { label: 'Uppercase letter', pass: /[A-Z]/.test(password) },
    { label: 'Number', pass: /\d/.test(password) },
    { label: 'Special character', pass: /[!@#$%^&*]/.test(password) },
  ];
  const passed = checks.filter(c => c.pass).length;
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passed];
  const strengthColor = ['', 'bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-emerald-500'][passed];

  if (!password) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {[1,2,3,4].map(i => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= passed ? strengthColor : 'bg-gray-200 dark:bg-slate-600'}`} />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {checks.map(c => (
          <span key={c.label} className={`text-xs flex items-center gap-1 ${c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
            <CheckCircle2 className="h-3 w-3" /> {c.label}
          </span>
        ))}
      </div>
      {strengthLabel && <p className="text-xs font-medium text-gray-500">Strength: <span className="text-gray-900 dark:text-white">{strengthLabel}</span></p>}
    </div>
  );
}

export default function UserProfileModal({ open, onClose, user, onUpdate, token, onLogout, onUpload }) {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile tab state
  const [username, setUsername] = useState(user.username);
  const [status, setStatus] = useState(user.status || 'online');
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [profileLoading, setProfileLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Notifications tab state
  const [desktopNotifs, setDesktopNotifs] = useState(
    localStorage.getItem('notif_desktop') !== 'false'
  );
  const [soundNotifs, setSoundNotifs] = useState(
    localStorage.getItem('notif_sound') !== 'false'
  );

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    const updatedUser = await onUpdate({ username, status, bio, avatar_url: avatarUrl });
    setProfileLoading(false);
    if (updatedUser) {
      // Refresh local state from server response so UI reflects saved values immediately
      if (updatedUser.avatar_url !== undefined) setAvatarUrl(updatedUser.avatar_url);
      if (updatedUser.username !== undefined) setUsername(updatedUser.username);
      onClose();
    }
  };

  const handleAvatarClick = () => {
    document.getElementById('avatar-upload-input').click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await onUpload(file);
      // result is { url: '/uploads/...', filename: '...' }
      let url = result?.url || result?.file_url;
      
      // If result is just a string (old format), use it
      if (!url && typeof result === 'string') url = result;
      
      if (url) {
        setAvatarUrl(url);
        toast.success('Avatar uploaded! Save changes to apply.');
      } else {
        console.error('Upload result missing URL:', result);
        toast.error('Upload failed: no URL returned');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // Reset file input so same file can be re-selected
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    toast.info('Avatar removed. Save changes to apply.');
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (res.ok) {
        toast.success('Password changed successfully!');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to change password');
      }
    } catch {
      toast.error('Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const saveNotificationPrefs = (desktop, sound) => {
    localStorage.setItem('notif_desktop', String(desktop));
    localStorage.setItem('notif_sound', String(sound));
  };

  const handleDesktopToggle = () => {
    const newVal = !desktopNotifs;
    setDesktopNotifs(newVal);
    saveNotificationPrefs(newVal, soundNotifs);
    if (newVal && Notification.permission === 'default') {
      Notification.requestPermission().then(perm => {
        if (perm !== 'granted') {
          setDesktopNotifs(false);
          saveNotificationPrefs(false, soundNotifs);
          toast.error('Notification permission denied');
        }
      });
    }
    toast.success(newVal ? 'Desktop notifications enabled' : 'Desktop notifications disabled');
  };

  const handleSoundToggle = () => {
    const newVal = !soundNotifs;
    setSoundNotifs(newVal);
    saveNotificationPrefs(desktopNotifs, newVal);
    toast.success(newVal ? 'Sound notifications enabled' : 'Sound notifications disabled');
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user.username) {
      toast.error(`Type "${user.username}" to confirm deletion`);
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/me`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success('Account deleted');
        onLogout();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Failed to delete account');
      }
    } catch {
      toast.error('Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" data-testid="user-profile-modal">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-xl font-bold">Account Settings</DialogTitle>
          <DialogDescription>Manage your profile, security, and preferences.</DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 dark:border-slate-700 px-6 mt-4">
          {TABS.map(t => {
            const Icon = t.icon;
            const isDanger = t.id === 'danger';
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 ${
                  activeTab === t.id
                    ? isDanger ? 'border-red-500 text-red-600' : 'border-violet-600 text-violet-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">

          {/* ── PROFILE TAB ──────────────────────────────── */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSave} className="space-y-5">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-28 w-28 ring-4 ring-violet-600/20 shadow-xl transition-transform duration-300 group-hover:scale-105">
                    <AvatarImage 
                      src={avatarUrl?.startsWith('http') ? avatarUrl : (avatarUrl ? `${BACKEND_URL}${avatarUrl.startsWith('/') ? '' : '/'}${avatarUrl}` : '')} 
                      className="object-cover" 
                    />
                    <AvatarFallback className="text-white font-bold text-3xl" style={{ backgroundColor: user.avatar_color }}>
                      {username ? username[0].toUpperCase() : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <button 
                    type="button"
                    onClick={handleAvatarClick}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  >
                    {uploadingAvatar ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-8 w-8" />}
                  </button>
                  
                  <input 
                    id="avatar-upload-input"
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />

                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-violet-600 text-white border-2 border-white dark:border-slate-900 text-[10px] px-2 shadow-lg">
                    {user.email}
                  </Badge>
                </div>

                {avatarUrl && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRemoveAvatar}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/10 h-8 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove Photo
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Username</label>
                  <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" className="h-11" data-testid="profile-username-input" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-11" data-testid="profile-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">🟢 Online</SelectItem>
                      <SelectItem value="away">🟡 Away</SelectItem>
                      <SelectItem value="busy">🔴 Busy</SelectItem>
                      <SelectItem value="offline">⚫ Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Bio</label>
                  <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} data-testid="profile-bio-input" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-11">Cancel</Button>
                <Button type="submit" className="flex-1 h-11 bg-violet-600 hover:bg-violet-700" disabled={profileLoading}>
                  {profileLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}

          {/* ── SECURITY TAB ─────────────────────────────── */}
          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange} className="space-y-5">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">🔒 Password Security</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Use a strong, unique password. You'll be logged out of other sessions after changing it.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Current Password</label>
                <div className="relative">
                  <Input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="h-11 pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="h-11 pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={newPassword} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className={`h-11 ${confirmPassword && confirmPassword !== newPassword ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  required
                />
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
                )}
              </div>
              <Button type="submit" className="w-full h-11 bg-violet-600 hover:bg-violet-700" disabled={pwLoading || !currentPassword || !newPassword || newPassword !== confirmPassword}>
                {pwLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Changing...</> : 'Change Password'}
              </Button>
            </form>
          )}

          {/* ── NOTIFICATIONS TAB ───────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Control how ChatHub notifies you about new messages and activity.</p>
              {[
                {
                  label: 'Desktop Notifications',
                  desc: 'Show browser notifications when the app is in the background',
                  icon: '🔔',
                  value: desktopNotifs,
                  toggle: handleDesktopToggle,
                  id: 'desktop-notif'
                },
                {
                  label: 'Sound Notifications',
                  desc: 'Play a sound when new messages arrive',
                  icon: '🔊',
                  value: soundNotifs,
                  toggle: handleSoundToggle,
                  id: 'sound-notif'
                }
              ].map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-200 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={item.toggle}
                    data-testid={item.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                      item.value ? 'bg-violet-600' : 'bg-gray-300 dark:bg-slate-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${item.value ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              ))}
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-300">💡 Notification preferences are saved locally in your browser and may reset if you clear your browser data.</p>
              </div>
            </div>
          )}

          {/* ── DANGER ZONE TAB ──────────────────────────── */}
          {activeTab === 'danger' && (
            <div className="space-y-5">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <p className="text-sm font-bold text-red-700 dark:text-red-400">Delete Account</p>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400">
                  This action is <strong>permanent and irreversible</strong>. Your account, profile, and all messages will be deleted. You will be removed from all channels.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Type <span className="font-bold text-red-600">"{user.username}"</span> to confirm
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder={user.username}
                  className="h-11 border-red-300 focus-visible:ring-red-400"
                  data-testid="delete-confirm-input"
                />
              </div>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== user.username || deleteLoading}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white"
                data-testid="delete-account-button"
              >
                {deleteLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Deleting...</> : '⚠️ Delete My Account'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
