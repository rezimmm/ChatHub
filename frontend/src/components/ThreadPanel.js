import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Send, MessageSquare, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from './ui/skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ThreadPanel({ parentMessage, onClose, currentUser, token, onSendThreadReply }) {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (parentMessage) {
      fetchThread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMessage?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies]);

  const fetchThread = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages/${parentMessage.id}/thread`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReplies(data);
      }
    } catch (error) {
      console.error('Failed to fetch thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;
    
    setSending(true);
    const success = await onSendThreadReply(replyText.trim(), parentMessage.id, parentMessage.channel_id);
    if (success) {
      setReplyText('');
      // Refresh thread
      setTimeout(fetchThread, 300);
    }
    setSending(false);
  };

  // Listen for new thread messages
  useEffect(() => {
    const interval = setInterval(() => {
      if (parentMessage) fetchThread();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMessage?.id]);

  if (!parentMessage) return null;

  return (
    <div className="w-80 lg:w-96 h-full border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col" data-testid="thread-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-violet-600" />
          <h3 className="font-bold text-gray-900 dark:text-white">Thread</h3>
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">{replies.length} replies</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" data-testid="close-thread">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <div className="flex gap-3">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarImage src={parentMessage.avatar_url} />
            <AvatarFallback className="text-white text-sm font-semibold" style={{ backgroundColor: parentMessage.avatar_color }}>
              {parentMessage.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-gray-900 dark:text-white">{parentMessage.username}</span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(parentMessage.timestamp), { addSuffix: true })}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 break-words">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="flex gap-2">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No replies yet</p>
            <p className="text-xs mt-1">Start the conversation</p>
          </div>
        ) : (
          replies.map(reply => (
            <div key={reply.id} className="flex gap-2" data-testid={`thread-reply-${reply.id}`}>
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarImage src={reply.avatar_url} />
                <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: reply.avatar_color }}>
                  {reply.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-xs text-gray-900 dark:text-white">{reply.username}</span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(reply.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 break-words">{reply.content}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply input */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 h-9 text-sm bg-gray-50 dark:bg-slate-900"
            data-testid="thread-reply-input"
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 px-3 bg-violet-600 hover:bg-violet-700"
            disabled={!replyText.trim() || sending}
            data-testid="thread-reply-send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
