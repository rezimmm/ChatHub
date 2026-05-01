import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { UserPlus, UserMinus, Settings, Crown, Loader2, Link, Copy, Trash2, Plus, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChannelSettingsModal({ open, onClose, channel, currentUser, token, allUsers, onChannelUpdated }) {
  const [members, setMembers] = useState([]);
  const [createdBy, setCreatedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelName, setChannelName] = useState('');
  const [channelDesc, setChannelDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingUser, setAddingUser] = useState(null);
  const [removingUser, setRemovingUser] = useState(null);
  const [invites, setInvites] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [inviteExpiration, setInviteExpiration] = useState('24h');
  const [inviteMaxUses, setInviteMaxUses] = useState('unlimited');

  useEffect(() => {
    if (open && channel) {
      setChannelName(channel.name);
      setChannelDesc(channel.description || '');
      setIsPrivate(channel.is_private || false);
      setPassword(''); 
      fetchMembers();
      fetchInvites();
    }
  }, [open, channel?.id]);

  const fetchInvites = async () => {
    setInviteLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/invites/channels/${channel.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setInvites(data);
      }
    } catch (error) {
      console.error('Failed to load invites', error);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const body = {
        max_uses: inviteMaxUses === 'unlimited' ? null : parseInt(inviteMaxUses)
      };

      if (inviteExpiration === '10m') body.expires_in_minutes = 10;
      else if (inviteExpiration === '1h') body.expires_in_hours = 1;
      else if (inviteExpiration === '24h') body.expires_in_hours = 24;
      else if (inviteExpiration === '7d') body.expires_in_hours = 168;
      else if (inviteExpiration === 'never') body.expires_in_hours = null;

      const response = await fetch(`${BACKEND_URL}/api/invites/channels/${channel.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        toast.success('Invite link created');
        fetchInvites();
      } else {
        toast.error('Failed to create invite link');
      }
    } catch {
      toast.error('Error creating invite link');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    setRevokingInvite(inviteId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/invites/${inviteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        toast.success('Invite revoked');
        fetchInvites();
      } else {
        toast.error('Failed to revoke invite');
      }
    } catch {
      toast.error('Error revoking invite');
    } finally {
      setRevokingInvite(null);
    }
  };

  const copyToClipboard = (inviteToken) => {
    const url = `${window.location.origin}/invite/${inviteToken}`;
    navigator.clipboard.writeText(url);
    toast.success('Invite link copied to clipboard');
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/channels/${channel.id}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members);
        setCreatedBy(data.created_by);
      }
    } catch (error) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChannel = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: channelName.trim(), description: channelDesc.trim(), is_private: isPrivate, password: password || undefined })
      });
      if (response.ok) {
        toast.success('Channel updated');
        if (onChannelUpdated) onChannelUpdated();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId) => {
    setAddingUser(userId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/channels/${channel.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId })
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        fetchMembers();
        if (onChannelUpdated) onChannelUpdated();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to add member');
      }
    } catch {
      toast.error('Failed to add member');
    } finally {
      setAddingUser(null);
    }
  };

  const handleRemoveMember = async (userId) => {
    setRemovingUser(userId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/channels/${channel.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        if (userId === currentUser.id) {
          toast.success('You left the channel');
          onClose();
        } else {
          toast.success('Member removed');
        }
        fetchMembers();
        if (onChannelUpdated) onChannelUpdated();
      } else {
        const err = await response.json();
        toast.error(err.detail || 'Failed to remove member');
      }
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setRemovingUser(null);
    }
  };

  if (!channel) return null;
  const isCreator = currentUser.id === createdBy;
  const memberIds = members.map(m => m.id);
  const nonMembers = allUsers.filter(u => !memberIds.includes(u.id));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg h-[85vh] flex flex-col p-0 overflow-hidden" data-testid="channel-settings-modal">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-violet-600" />Channel Settings
          </DialogTitle>
          <DialogDescription>Manage channel details and members.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-6">
            {/* Channel info */}
            {isCreator && (
              <form onSubmit={handleSaveChannel} className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Channel Name</label>
                  <Input value={channelName} onChange={(e) => setChannelName(e.target.value)} className="h-10" data-testid="channel-settings-name" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
                  <Input value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} className="h-10" placeholder="Optional" data-testid="channel-settings-desc" />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input 
                    type="checkbox" 
                    id="settingsIsPrivate" 
                    checked={isPrivate} 
                    onChange={(e) => setIsPrivate(e.target.checked)} 
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-600"
                  />
                  <label htmlFor="settingsIsPrivate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Make channel private (Password protected)
                  </label>
                </div>
                {isPrivate && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                      {channel.is_private ? "New Password (leave blank to keep current)" : "Password"}
                    </label>
                    <Input
                      type="password"
                      placeholder="Channel password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!channel.is_private && isPrivate} // Required only if making it private for the first time
                      className="h-10"
                    />
                  </div>
                )}
                <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-700" disabled={saving} data-testid="save-channel-settings">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
              </form>
            )}

            {/* Members */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Members ({members.length})</h4>
              {loading ? (
                <div className="text-center text-sm text-gray-500 py-4">Loading...</div>
              ) : (
                <div className="space-y-1">
                  {members.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50" data-testid={`member-${member.username}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: member.avatar_color }}>
                          {member.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{member.username}</span>
                          {member.id === createdBy && (
                            <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          {member.id === currentUser.id && (
                            <span className="text-xs text-gray-400">(you)</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 truncate block">{member.email}</span>
                      </div>
                      {member.id === currentUser.id && member.id !== createdBy && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingUser === member.id}
                          className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs gap-1"
                          data-testid="leave-channel-btn"
                        >
                          {removingUser === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
                          Leave
                        </Button>
                      )}
                      {isCreator && member.id !== createdBy && member.id !== currentUser.id && (
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingUser === member.id}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          data-testid={`remove-member-${member.username}`}
                        >
                          {removingUser === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add members */}
            {nonMembers.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add Members</h4>
                <div className="space-y-1">
                  {nonMembers.map(user => (
                    <div key={user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50" data-testid={`add-member-${user.username}`}>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: user.avatar_color }}>
                          {user.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">{user.username}</span>
                        <span className={`text-xs ${user.is_online ? 'text-emerald-500' : 'text-gray-400'}`}>
                          {user.is_online ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => handleAddMember(user.id)}
                        disabled={addingUser === user.id}
                        className="h-8 w-8 p-0 text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        data-testid={`add-btn-${user.username}`}
                      >
                        {addingUser === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invite Links */}
            <div className="pt-2 border-t dark:border-slate-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Link className="h-4 w-4 text-violet-600" /> Invite Links
                </h4>
              <div className="space-y-3 mb-4 p-3 bg-violet-50/50 dark:bg-violet-900/10 rounded-lg border border-violet-100 dark:border-violet-900/20">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Expire After</label>
                    <select 
                      value={inviteExpiration} 
                      onChange={(e) => setInviteExpiration(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900/30 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="10m">10 Minutes</option>
                      <option value="1h">1 Hour</option>
                      <option value="24h">24 Hours</option>
                      <option value="7d">7 Days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Max Uses</label>
                    <select 
                      value={inviteMaxUses} 
                      onChange={(e) => setInviteMaxUses(e.target.value)}
                      className="w-full text-xs bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-900/30 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      <option value="unlimited">Unlimited</option>
                      <option value="1">1 Use</option>
                      <option value="5">5 Uses</option>
                      <option value="10">10 Uses</option>
                      <option value="25">25 Uses</option>
                    </select>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={handleCreateInvite}
                  disabled={creatingInvite}
                  className="w-full h-8 text-xs gap-1 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                >
                  {creatingInvite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Generate New Link
                </Button>
              </div>
              </div>
              
              {inviteLoading && invites.length === 0 ? (
                <div className="text-center py-2 text-xs text-gray-500">Loading invites...</div>
              ) : invites.length === 0 ? (
                <div className="text-center py-4 px-2 border-2 border-dashed rounded-lg border-gray-100 dark:border-slate-800 text-xs text-gray-400 italic">
                  No active invite links. Create one to share this channel.
                </div>
              ) : (
                <div className="space-y-2">
                  {invites.map(invite => (
                    <div key={invite.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-800/50 group border border-transparent hover:border-violet-100 dark:hover:border-violet-900/30 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                          <span className="truncate">{invite.token.substring(0, 15)}...</span>
                          <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-bold scale-[0.85]">
                            {invite.use_count} uses
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          Expires: {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => copyToClipboard(invite.token)}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                          title="Copy Link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleRevokeInvite(invite.id)}
                          disabled={revokingInvite === invite.id}
                          className="h-7 w-7 p-0 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Revoke Link"
                        >
                          {revokingInvite === invite.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
