import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Send, Hash, MessageSquare, Smile, MoreVertical, Edit2, Trash2, Pin, Reply, Paperclip, X, Loader2, ChevronUp, FileText, Check, CheckCheck, Settings, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import EmojiPicker from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Skeleton } from './ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import MessageContent from './MessageContent';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChatArea({ channel, messages, onSendMessage, onEditMessage, onDeleteMessage, onAddReaction, onPinMessage, onTyping, currentUser, typingUsers, loadingMessages, hasMoreMessages, onLoadMore, onUploadFile, token, onOpenThread, onMarkRead, users, onOpenChannelSettings, onOpenUserList }) {
  const [message, setMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const shouldAutoScroll = useRef(true);
  const observerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // IntersectionObserver for read receipts
  useEffect(() => {
    if (!onMarkRead || !currentUser) return;
    
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const msgId = entry.target.dataset.msgId;
          const msgUserId = entry.target.dataset.msgUserId;
          if (msgId && msgUserId !== currentUser.id) {
            onMarkRead(msgId);
          }
        }
      });
    }, { threshold: 0.5 });

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [onMarkRead, currentUser]);

  // Observe new message elements
  useEffect(() => {
    if (!observerRef.current || !scrollContainerRef.current) return;
    
    const msgElements = scrollContainerRef.current.querySelectorAll('[data-msg-id]');
    msgElements.forEach(el => observerRef.current.observe(el));
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [messages]);

  const handleScroll = (e) => {
    const el = e.target;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    shouldAutoScroll.current = atBottom;
    
    if (el.scrollTop < 50 && hasMoreMessages && !loadingMessages) {
      onLoadMore();
    }
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTyping(true);
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      if (editingMessage) {
        onEditMessage(editingMessage.id, message);
        setEditingMessage(null);
      } else {
        onSendMessage(message, replyingTo?.id);
        setReplyingTo(null);
      }
      setMessage('');
      shouldAutoScroll.current = true;
      onTyping(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleEdit = (msg) => {
    setEditingMessage(msg);
    setMessage(msg.content);
    setReplyingTo(null);
  };

  const handleReply = (msg) => {
    setReplyingTo(msg);
    setEditingMessage(null);
  };

  const handleEmojiClick = (emojiData) => {
    setMessage(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0 || !onUploadFile) return;
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 10MB)`);
        continue;
      }
      setUploading(true);
      try {
        const result = await onUploadFile(file);
        console.log('Upload result:', result);
        
        if (result) {
          // Robustly get URL and filename from various possible response formats
          const fileUrl = result.url || result.file_url || result.fullUrl || '';
          const fileName = result.filename || result.file_name || file.name || 'file';
          
          if (!fileUrl) {
            console.error('No URL in upload result:', result);
            toast.error('Upload succeeded but no URL was returned');
            continue;
          }

          const isImage = file.type.startsWith('image/');
          const content = isImage
            ? `[Image: ${fileName}](${fileUrl})`
            : `[File: ${fileName}](${fileUrl})`;
          
          await onSendMessage(content);
        }
      } catch (error) {
        console.error('File upload error:', error);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); };
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e); };

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 transition-colors duration-200">
        <div className="text-center text-gray-500 dark:text-gray-400 p-8">
          <MessageSquare className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p className="text-lg sm:text-xl font-medium">Select a channel to start chatting</p>
          <p className="text-sm mt-2">Choose a channel from the sidebar or start a direct message</p>
        </div>
      </div>
    );
  }

  const pinnedMessages = messages.filter(msg => msg.pinned);
  // Only show main channel messages (not thread replies)
  const mainMessages = messages.filter(msg => !msg.thread_id);

  return (
    <div 
      className={`flex-1 flex flex-col bg-white dark:bg-slate-900 transition-colors duration-200 min-w-0 ${dragOver ? 'ring-2 ring-violet-500 ring-inset' : ''}`} 
      data-testid="chat-area"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Channel header */}
      <div className="h-14 sm:h-16 border-b border-gray-200 dark:border-slate-700 items-center px-4 sm:px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hidden md:flex">
        <div className="flex items-center gap-3 flex-1 min-w-0 pr-40"> {/* Add padding right so floating icons don't cover text if it gets too long */}
          <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg flex-shrink-0">
            <Hash className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate" data-testid="channel-name">{channel.name}</h2>
              {channel.description && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{channel.description}</p>
              )}
            </div>
            {onOpenChannelSettings && !channel.is_dm && (
              <Button variant="ghost" size="icon" onClick={onOpenChannelSettings} className="h-8 w-8 flex-shrink-0 text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 ml-1" data-testid="channel-settings-button" title="Channel Settings">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onOpenUserList} 
            className="h-9 w-9 text-gray-500 hover:text-violet-600 lg:hidden"
            title="Team Members"
          >
            <Users className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {dragOver && (
        <div className="absolute inset-0 bg-violet-500/10 backdrop-blur-sm z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <Paperclip className="h-12 w-12 text-violet-600 mx-auto mb-3" />
            <p className="text-lg font-semibold text-gray-900 dark:text-white">Drop files to upload</p>
          </div>
        </div>
      )}

      {pinnedMessages.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-900/50 px-4 sm:px-6 py-2">
          <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
            <Pin className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium truncate">Pinned: {pinnedMessages[0].content.substring(0, 50)}...</span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6" ref={scrollContainerRef} onScroll={handleScroll}>
        {hasMoreMessages && mainMessages.length > 0 && (
          <div className="flex justify-center mb-4">
            <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMessages} className="text-xs text-gray-500" data-testid="load-more-button">
              {loadingMessages ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Loading...</> : <><ChevronUp className="h-3 w-3 mr-1" /> Load older messages</>}
            </Button>
          </div>
        )}

        {loadingMessages && mainMessages.length === 0 && (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-3/4" /></div>
              </div>
            ))}
          </div>
        )}

        <TooltipProvider>
          <div className="space-y-1" data-testid="messages-container">
            {mainMessages.map((msg, index) => {
              const isOwnMessage = msg.user_id === currentUser.id;
              const replyToMessage = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null;
              const prevMsg = index > 0 ? mainMessages[index - 1] : null;
              const isConsecutive = prevMsg && prevMsg.user_id === msg.user_id && 
                (new Date(msg.timestamp) - new Date(prevMsg.timestamp)) < 300000;
              
              const fileMatch = msg.content.match(/\[(File|Image): (.+?)\]\((.+?)\)/);
              const isFileMessage = !!fileMatch;
              const isImageFile = fileMatch && fileMatch[1] === 'Image';
              
              // Construct the correct file URL handling relative paths and potential double slashes
              let fileUrl = '';
              if (isFileMessage) {
                const rawPath = fileMatch[3];
                if (rawPath.startsWith('http')) {
                  fileUrl = rawPath;
                } else {
                  // Ensure single slash between BACKEND_URL and relative path
                  const base = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
                  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
                  fileUrl = `${base}${path}`;
                }
              }
              
              // Read receipt info
              const readBy = msg.read_by || [];
              const readByOthers = readBy.filter(id => id !== msg.user_id);
              const readByNames = users ? readByOthers.map(id => users.find(u => u.id === id)?.username).filter(Boolean) : [];
              
              return (
                <div 
                  key={msg.id} 
                  className="group" 
                  data-testid="message-item"
                  data-msg-id={msg.id}
                  data-msg-user-id={msg.user_id}
                >
                  {replyToMessage && (
                    <div className="ml-10 sm:ml-14 mb-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                      <Reply className="h-3 w-3" />
                      Replying to <span className="font-medium">{replyToMessage.username}</span>
                    </div>
                  )}
                  <div className={`flex gap-2 sm:gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 -mx-2 px-2 ${isConsecutive ? 'py-0.5' : 'py-2'} rounded-lg transition-colors`}>
                    {isConsecutive ? (
                      <div className="w-8 sm:w-10 flex-shrink-0" />
                    ) : (
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                        <AvatarImage src={msg.avatar_url?.startsWith('http') ? msg.avatar_url : `${BACKEND_URL}${msg.avatar_url || ''}`} />
                        <AvatarFallback className="text-white font-semibold text-xs sm:text-sm" style={{ backgroundColor: msg.avatar_color }}>
                          {msg.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex-1 min-w-0">
                      {!isConsecutive && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-sm text-gray-900 dark:text-white" data-testid="message-username">{msg.username}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400" data-testid="message-timestamp">
                            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                          </span>
                          {msg.edited && <span className="text-xs text-gray-400 italic">(edited)</span>}
                          {msg.pinned && <Pin className="h-3 w-3 text-yellow-600" />}
                        </div>
                      )}
                      
                      {isFileMessage ? (
                        <div className="mt-1">
                          {isImageFile ? (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block max-w-sm">
                              <img src={fileUrl} alt={fileMatch[2]} className="rounded-lg max-h-64 object-cover border border-gray-200 dark:border-slate-700 hover:opacity-90 transition-opacity" data-testid="message-image" />
                              <span className="text-xs text-gray-500 mt-1 block">{fileMatch[2]}</span>
                            </a>
                          ) : (
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors max-w-sm" data-testid="message-file">
                              <FileText className="h-8 w-8 text-violet-600 flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-white block truncate">{fileMatch[2]}</span>
                                <span className="text-xs text-gray-500">Click to download</span>
                              </div>
                            </a>
                          )}
                        </div>
                      ) : (
                        <MessageContent content={msg.content} />
                      )}
                      
                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(
                            msg.reactions.reduce((acc, r) => { acc[r.emoji] = acc[r.emoji] || []; acc[r.emoji].push(r); return acc; }, {})
                          ).map(([emoji, reactions]) => (
                            <button key={emoji} onClick={() => onAddReaction(msg.id, emoji)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${
                                reactions.some(r => r.user_id === currentUser.id)
                                  ? 'bg-violet-100 dark:bg-violet-900/30 ring-1 ring-violet-600'
                                  : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'
                              }`} data-testid={`reaction-${emoji}`}
                            >
                              <span>{emoji}</span><span className="font-medium">{reactions.length}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Thread indicator */}
                      {msg.reply_count > 0 && (
                        <button
                          onClick={() => onOpenThread && onOpenThread(msg)}
                          className="flex items-center gap-2 mt-2 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 px-2 py-1 rounded-md transition-colors"
                          data-testid={`thread-indicator-${msg.id}`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}
                        </button>
                      )}

                      {/* Read receipts - only for own messages */}
                      {isOwnMessage && (
                        <div className="mt-1 flex items-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center cursor-default" data-testid={`read-receipt-${msg.id}`}>
                                {readByOthers.length > 0 ? (
                                  <CheckCheck className="h-3.5 w-3.5 text-blue-500" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {readByOthers.length > 0 
                                ? `Read by ${readByNames.slice(0, 5).join(', ')}${readByNames.length > 5 ? ` +${readByNames.length - 5} more` : ''}`
                                : 'Sent'
                              }
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      )}
                    </div>
                    
                    {/* Message actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 flex-shrink-0">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Smile className="h-3.5 w-3.5" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0 border-0" align="end">
                          <EmojiPicker onEmojiClick={(emojiData) => onAddReaction(msg.id, emojiData.emoji)} width={300} height={350} />
                        </PopoverContent>
                      </Popover>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`message-menu-${msg.id}`}>
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleReply(msg)} data-testid="reply-message">
                            <Reply className="h-4 w-4 mr-2" />Reply
                          </DropdownMenuItem>
                          {onOpenThread && (
                            <DropdownMenuItem onClick={() => onOpenThread(msg)} data-testid="start-thread">
                              <MessageSquare className="h-4 w-4 mr-2" />Thread
                            </DropdownMenuItem>
                          )}
                          {isOwnMessage && (
                            <>
                              <DropdownMenuItem onClick={() => handleEdit(msg)} data-testid="edit-message">
                                <Edit2 className="h-4 w-4 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteMessage(msg.id)} className="text-red-600" data-testid="delete-message">
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => onPinMessage(msg.id)} data-testid="pin-message">
                            <Pin className="h-4 w-4 mr-2" />{msg.pinned ? 'Unpin' : 'Pin'} Message
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {typingUsers.length > 0 && (
              <div className="flex gap-3 text-sm text-gray-500 dark:text-gray-400 italic ml-2 py-2" data-testid="typing-indicator">
                <div className="w-8 sm:w-10"></div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs">{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </TooltipProvider>
      </div>

      {/* Message input */}
      <div className="border-t border-gray-200 dark:border-slate-700 p-2 sm:p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {(editingMessage || replyingTo) && (
          <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-gray-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm min-w-0">
              {editingMessage ? (
                <><Edit2 className="h-4 w-4 text-violet-600 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 truncate">Editing message</span></>
              ) : (
                <><Reply className="h-4 w-4 text-violet-600 flex-shrink-0" /><span className="text-gray-700 dark:text-gray-300 truncate">Replying to <strong>{replyingTo.username}</strong></span></>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setEditingMessage(null); setReplyingTo(null); setMessage(''); }} className="h-6 w-6 p-0 flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2 items-end">
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileUpload(e.target.files)} className="hidden" data-testid="file-input" />
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploading} data-testid="file-upload-button">
            {uploading ? <Loader2 className="h-5 w-5 animate-spin text-gray-500" /> : <Paperclip className="h-5 w-5 text-gray-500 dark:text-gray-400" />}
          </Button>
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-10 w-10 flex-shrink-0 hidden sm:flex" data-testid="emoji-picker-button">
                <Smile className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 border-0" align="start" side="top">
              <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={350} />
            </PopoverContent>
          </Popover>
          <Input value={message} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={editingMessage ? 'Edit your message...' : `Message #${channel.name}`} className="flex-1 h-10 sm:h-11 bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-sm" data-testid="message-input" />
          <Button type="submit" className="h-10 sm:h-11 px-3 sm:px-6 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 shadow-lg shadow-violet-600/30 transform active:scale-95 transition-all duration-200" disabled={!message.trim() || uploading} data-testid="send-message-button">
            <Send className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">{editingMessage ? 'Update' : 'Send'}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
