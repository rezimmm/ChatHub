import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { MessageSquare, Plus, Hash, LogOut, Users, Star, Settings, Lock } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

export default function Sidebar({ channels, currentChannel, onSelectChannel, onCreateChannel, onToggleFavorite, user, onLogout, onOpenProfile }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [channelPassword, setChannelPassword] = useState('');

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (newChannelName.trim()) {
      const success = await onCreateChannel(newChannelName, newChannelDesc, [user.id], isPrivate, channelPassword);
      if (success) {
        setNewChannelName('');
        setNewChannelDesc('');
        setIsPrivate(false);
        setChannelPassword('');
        setIsDialogOpen(false);
      }
    }
  };

  const publicChannels = channels.filter(ch => !ch.is_dm);
  const directMessages = channels.filter(ch => ch.is_dm);
  const favoriteChannels = publicChannels.filter(ch => ch.is_favorite?.includes(user.id));
  const regularChannels = publicChannels.filter(ch => !ch.is_favorite?.includes(user.id));

  return (
    <div className="w-72 h-full bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-colors duration-200" data-testid="sidebar">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-gradient-to-br from-violet-600 to-violet-700 p-2.5 rounded-xl shadow-lg">
            <MessageSquare className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-600 to-teal-600 bg-clip-text text-transparent">ChatHub</h1>
        </div>
        
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 group"
          data-testid="user-profile-button"
        >
          <Avatar className="h-9 w-9 ring-2 ring-violet-600/20">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback 
              className="text-white font-semibold text-sm"
              style={{ backgroundColor: user.avatar_color }}
            >
              {user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.username}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
              {user.status || 'Online'}
            </p>
          </div>
          <Settings className="h-4 w-4 text-gray-400 group-hover:text-violet-600 transition-colors" />
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-5">
          {favoriteChannels.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5 px-2">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Starred</h3>
              </div>
              <div className="space-y-0.5">
                {favoriteChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    currentChannel={currentChannel}
                    onSelect={onSelectChannel}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={true}
                    userId={user.id}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5 px-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Channels</h3>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 transition-colors"
                    data-testid="create-channel-button"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md" data-testid="create-channel-dialog">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Create New Channel</DialogTitle>
                    <DialogDescription>Add a new channel for your team to collaborate in.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateChannel} className="space-y-4 mt-4">
                    <Input
                      placeholder="Channel name (e.g., marketing)"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      required
                      className="h-11"
                      data-testid="channel-name-input"
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newChannelDesc}
                      onChange={(e) => setNewChannelDesc(e.target.value)}
                      className="h-11"
                      data-testid="channel-description-input"
                    />
                    <div className="flex items-center gap-2 mt-4">
                      <input 
                        type="checkbox" 
                        id="isPrivate" 
                        checked={isPrivate} 
                        onChange={(e) => setIsPrivate(e.target.checked)} 
                        className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-600"
                      />
                      <label htmlFor="isPrivate" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Make channel private (Password protected)
                      </label>
                    </div>
                    {isPrivate && (
                      <Input
                        type="password"
                        placeholder="Channel password"
                        value={channelPassword}
                        onChange={(e) => setChannelPassword(e.target.value)}
                        required={isPrivate}
                        className="h-11"
                      />
                    )}
                    <Button type="submit" className="w-full h-11 bg-violet-600 hover:bg-violet-700" data-testid="create-channel-submit">
                      Create Channel
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-0.5">
              {regularChannels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  currentChannel={currentChannel}
                  onSelect={onSelectChannel}
                  onToggleFavorite={onToggleFavorite}
                  isFavorite={false}
                  userId={user.id}
                />
              ))}
            </div>
          </div>

          {directMessages.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 px-2">Direct Messages</h3>
              <div className="space-y-0.5">
                {directMessages.map(channel => {
                  const unreadCount = channel.unread_count?.[user.id] || 0;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => onSelectChannel(channel)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        currentChannel?.id === channel.id 
                          ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' 
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                      }`}
                      data-testid={`dm-${channel.id}`}
                    >
                      <Users className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate flex-1 text-left">{channel.name}</span>
                      {unreadCount > 0 && currentChannel?.id !== channel.id && (
                        <span className="bg-violet-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center" data-testid={`unread-dm-${channel.id}`}>
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-gray-200 dark:border-slate-700">
        <Button 
          variant="ghost" 
          onClick={onLogout}
          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function ChannelItem({ channel, currentChannel, onSelect, onToggleFavorite, isFavorite, userId }) {
  const unreadCount = channel.unread_count?.[userId] || 0;
  
  return (
    <div className="group relative">
      <button
        onClick={() => onSelect(channel)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
          currentChannel?.id === channel.id 
            ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30' 
            : unreadCount > 0
            ? 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-semibold'
            : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
        }`}
        data-testid={`channel-${channel.name}`}
      >
        {channel.is_private ? (
          <Lock className="h-4 w-4 flex-shrink-0 text-amber-500" />
        ) : (
          <Hash className="h-4 w-4 flex-shrink-0" />
        )}
        <span className="truncate flex-1 text-left">{channel.name}</span>
        {unreadCount > 0 && currentChannel?.id !== channel.id && (
          <span className="bg-violet-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center" data-testid={`unread-${channel.name}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(channel.id);
        }}
        className={`absolute right-2 top-1/2 -translate-y-1/2 transition-opacity ${
          isFavorite ? 'opacity-100' : 'opacity-20 group-hover:opacity-70'
        }`}
        title={isFavorite ? 'Remove from starred' : 'Add to starred'}
        data-testid={`star-${channel.name}`}
      >
        <Star 
          className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
        />
      </button>
    </div>
  );
}
