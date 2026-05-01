import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { MessageSquare } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';

export default function UserList({ users, currentUser, onStartDM }) {
  const onlineUsers = users.filter(u => u.is_online);
  const offlineUsers = users.filter(u => !u.is_online);

  return (
    <div className="w-72 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 transition-colors duration-200" data-testid="user-list">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Team Members</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{onlineUsers.length} online</p>
      </div>
      <ScrollArea className="h-[calc(100vh-89px)]">
        <div className="p-3 space-y-1">
          {onlineUsers.map(user => (
            <UserItem key={user.id} user={user} currentUser={currentUser} onStartDM={onStartDM} />
          ))}
          {offlineUsers.length > 0 && (
            <>
              <div className="pt-4 pb-2 px-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Offline</h4>
              </div>
              {offlineUsers.map(user => (
                <UserItem key={user.id} user={user} currentUser={currentUser} onStartDM={onStartDM} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function UserItem({ user, currentUser, onStartDM }) {
  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-all duration-200 group cursor-pointer"
      data-testid={`user-${user.username}`}
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={user.avatar_url} />
          <AvatarFallback 
            className="text-white font-semibold"
            style={{ backgroundColor: user.avatar_color }}
          >
            {user.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${
          user.is_online ? 'bg-teal-500' : 'bg-gray-400'
        }`} data-testid={`user-status-${user.username}`}></div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.username}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {user.is_online ? user.status || 'Online' : 'Offline'}
        </p>
      </div>
      {user.id !== currentUser.id && (
        <Button
          variant="ghost"
          size="sm"
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600"
          onClick={() => onStartDM(user.id)}
          data-testid={`dm-button-${user.username}`}
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
