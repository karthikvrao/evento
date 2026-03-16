import React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils';
import { ImageIcon, Video, FileText } from 'lucide-react';
import type { MediaRef } from '../../types/chat';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  text: string;
  mediaRefs?: MediaRef[];
  timestamp: string;
  onMediaClick?: (contentId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  text,
  mediaRefs,
  timestamp,
  onMediaClick,
}) => {
  const isAssistant = role === 'assistant';

  return (
    <div className={cn(
      "flex flex-col gap-2 max-w-[85%] group",
      isAssistant ? "mr-auto" : "ml-auto items-end"
    )}>
      {/* Message Bubble */}
      <div className={cn(
        "p-3 rounded-2xl text-sm border shadow-sm leading-relaxed transition-all duration-300",
        isAssistant 
          ? "bg-accent/50 text-foreground rounded-tl-none border-border/20 group-hover:bg-accent/70" 
          : "bg-primary text-white rounded-tr-none border-primary/20 shadow-lg shadow-primary/10 group-hover:shadow-primary/20"
      )}>
        {/* Markdown Text rendering */}
        <div className={cn("prose prose-sm max-w-none break-words", isAssistant ? "prose-invert" : "text-white")}>
          <ReactMarkdown
            components={{
              // Add custom styling for paragraphs and links to blend with the chat bubble
              p: ({node, ...props}) => <p className="m-0 mb-2 last:mb-0" {...props} />,
              a: ({node, ...props}) => <a className="underline hover:opacity-80 transition-opacity" target="_blank" rel="noopener noreferrer" {...props} />,
            }}
          >
            {text}
          </ReactMarkdown>
        </div>

        {/* Interleaved Media */}
        {mediaRefs && mediaRefs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {mediaRefs.map((item, idx) => (
              <div 
                key={item.asset_id || idx} 
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 shadow-sm transition-transform duration-200",
                  item.asset_id ? "cursor-pointer hover:scale-105 active:scale-95 hover:border-primary/50" : "cursor-default"
                )}
                onClick={() => item.asset_id && onMediaClick?.(item.asset_id)}
                title={item.asset_type || "Media Attachment"}
              >
                {/* Fallback to URL if thumbnail is missing */}
                {item.asset_type === 'image' || item.thumbnail_url ? (
                  <img 
                    src={item.thumbnail_url || item.url} 
                    alt={`attachment-${idx}`} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-black/40 flex items-center justify-center">
                    {item.asset_type === 'video' ? <Video className="h-6 w-6 text-white/70" /> : <FileText className="h-6 w-6 text-white/70" />}
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  {item.asset_type === 'image' ? (
                    <ImageIcon className="h-3 w-3 text-white opacity-40 shadow-sm" />
                  ) : item.asset_type === 'video' ? (
                    <Video className="h-6 w-6 text-white opacity-80 drop-shadow-md" />
                  ) : (
                    <FileText className="h-4 w-4 text-white opacity-70" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className={cn(
        "text-[10px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity",
        isAssistant ? "ml-1" : "mr-1 text-right"
      )}>
        {isAssistant ? 'Assistant' : 'You'} • {timestamp}
      </span>
    </div>
  );
};
