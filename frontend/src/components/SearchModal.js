import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Search } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function SearchModal({ open, onClose, onSelectMessage, token }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (searchQuery) => {
    setQuery(searchQuery);
    if (searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/messages/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" data-testid="search-modal">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold">Search Messages</DialogTitle>
          <DialogDescription>Find messages across all your channels.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search messages... (Ctrl+K)"
              className="h-12 pl-10 text-base"
              autoFocus
              data-testid="search-input"
            />
          </div>
          <ScrollArea className="h-96">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="text-gray-500">Searching...</div>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                {results.map(message => (
                  <button
                    key={message.id}
                    onClick={() => onSelectMessage(message)}
                    className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    data-testid={`search-result-${message.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                        style={{ backgroundColor: message.avatar_color }}
                      >
                        {message.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">{message.username}</span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{message.content}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.trim().length >= 2 ? (
              <div className="flex justify-center items-center h-32 text-gray-500">
                No messages found
              </div>
            ) : (
              <div className="flex justify-center items-center h-32 text-gray-500">
                Type to search messages
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
