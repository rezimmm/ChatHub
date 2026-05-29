import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import MessageContent from './MessageContent';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AiAssistantPanel({ channel, onClose, currentUser, token }) {
  const [promptText, setPromptText] = useState('');
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat log when new replies arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chats, loading]);

  const handleAskQuestion = async (question) => {
    if (!question.trim() || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: question.trim(),
      timestamp: new Date()
    };

    setChats(prev => [...prev, userMessage]);
    setPromptText('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/channels/${channel.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt: question.trim(), limit: 40 })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage = {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          content: data.reply || 'No response generated.',
          timestamp: new Date()
        };
        setChats(prev => [...prev, aiMessage]);
      } else {
        const aiMessage = {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          content: 'Failed to fetch reply from AI service. Make sure GEMINI_API_KEY is configured.',
          timestamp: new Date()
        };
        setChats(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error fetching AI reply:', error);
      const aiMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        content: 'An error occurred while connecting to the AI service.',
        timestamp: new Date()
      };
      setChats(prev => [...prev, aiMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAskQuestion(promptText);
  };

  const starterQuestions = [
    'What was discussed recently?',
    'List the action items and decisions.',
    'Who has been most active in this channel?',
  ];

  if (!channel) return null;

  return (
    <div className="w-80 lg:w-96 h-full border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col" data-testid="ai-assistant-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">AI Channel Assistant</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" data-testid="close-ai-assistant">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Channel info disclaimer */}
      <div className="p-3 border-b border-gray-100 dark:border-slate-700/50 bg-violet-50/20 dark:bg-violet-950/10 text-xs text-violet-600 dark:text-violet-400 flex items-center gap-1.5 px-4">
        <span>Asking about the conversation history in <strong>#{channel.name}</strong>.</span>
      </div>

      {/* Chat exchange Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        {chats.length === 0 ? (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="bg-violet-100 dark:bg-violet-900/30 p-3 rounded-full">
              <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Chat with AI Assistant</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                Ask questions about the decisions, topics, or timeline discussed in this channel.
              </p>
            </div>
            
            <div className="w-full pt-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 text-left uppercase tracking-wider">Suggested Questions</p>
              {starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskQuestion(q)}
                  disabled={loading}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/50 hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:border-violet-300 dark:hover:border-violet-900/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chats.map(chat => {
            const isUser = chat.sender === 'user';
            return (
              <div key={chat.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  {isUser ? (
                    <>
                      <AvatarImage src={currentUser?.avatar_url} />
                      <AvatarFallback className="text-white text-xs font-semibold" style={{ backgroundColor: currentUser?.avatar_color || '#7c3aed' }}>
                        {currentUser?.username[0].toUpperCase()}
                      </AvatarFallback>
                    </>
                  ) : (
                    <div className="w-full h-full bg-violet-600 dark:bg-violet-500 flex items-center justify-center text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                </Avatar>
                <div className={`max-w-[75%] rounded-2xl p-3 text-sm ${
                  isUser 
                    ? 'bg-violet-600 text-white rounded-tr-none' 
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                }`}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{chat.content}</p>
                  ) : (
                    <MessageContent content={chat.content} />
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <div className="w-full h-full bg-violet-600 dark:bg-violet-500 flex items-center justify-center text-white">
                <Sparkles className="h-4 w-4 animate-pulse" />
              </div>
            </Avatar>
            <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl rounded-tl-none p-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">AI is reading history and typing...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Ask AI about channel..."
            className="flex-1 h-9 text-sm bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700"
            data-testid="ai-prompt-input"
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 px-3 bg-violet-600 hover:bg-violet-700 text-white"
            disabled={!promptText.trim() || loading}
            data-testid="ai-prompt-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
