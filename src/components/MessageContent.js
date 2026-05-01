import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ExternalLink } from 'lucide-react';

// URL regex for link detection
const URL_REGEX = /https?:\/\/[^\s<]+/g;

function LinkPreview({ href, children }) {
  const isExternal = href?.startsWith('http');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-0.5 break-all"
      data-testid="message-link"
    >
      {children}
      {isExternal && <ExternalLink className="h-3 w-3 flex-shrink-0 inline" />}
    </a>
  );
}

export default function MessageContent({ content }) {
  if (!content) return null;

  return (
    <div className="text-sm text-gray-800 dark:text-gray-200 break-words leading-relaxed message-markdown" data-testid="message-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ node, href, children, ...props }) => (
            <LinkPreview href={href}>{children}</LinkPreview>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            if (inline) {
              return (
                <code className="bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono text-pink-600 dark:text-pink-400" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <div className="my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600" data-testid="code-block">
                <div className="bg-gray-100 dark:bg-slate-700 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 font-mono border-b border-gray-200 dark:border-slate-600">
                  {className?.replace('language-', '') || 'code'}
                </div>
                <pre className="bg-gray-50 dark:bg-slate-800 p-3 overflow-x-auto">
                  <code className={`${className || ''} text-xs font-mono`} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          p: ({ node, children, ...props }) => (
            <p className="mb-1 last:mb-0" {...props}>{children}</p>
          ),
          ul: ({ node, children, ...props }) => (
            <ul className="list-disc list-inside mb-1 space-y-0.5" {...props}>{children}</ul>
          ),
          ol: ({ node, children, ...props }) => (
            <ol className="list-decimal list-inside mb-1 space-y-0.5" {...props}>{children}</ol>
          ),
          blockquote: ({ node, children, ...props }) => (
            <blockquote className="border-l-3 border-violet-500 pl-3 my-1 text-gray-600 dark:text-gray-400 italic" {...props}>
              {children}
            </blockquote>
          ),
          h1: ({ node, children, ...props }) => (
            <h1 className="text-lg font-bold mb-1" {...props}>{children}</h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2 className="text-base font-bold mb-1" {...props}>{children}</h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3 className="text-sm font-bold mb-1" {...props}>{children}</h3>
          ),
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-gray-200 dark:border-slate-600 rounded" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ node, children, ...props }) => (
            <th className="bg-gray-100 dark:bg-slate-700 px-3 py-1.5 text-left font-semibold border-b border-gray-200 dark:border-slate-600" {...props}>
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td className="px-3 py-1.5 border-b border-gray-100 dark:border-slate-700" {...props}>
              {children}
            </td>
          ),
          hr: () => <hr className="my-2 border-gray-200 dark:border-slate-700" />,
          img: ({ node, src, alt, ...props }) => (
            <img src={src} alt={alt || ''} className="max-h-64 rounded-lg my-1" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
