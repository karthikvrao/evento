import React from 'react';
import { cn } from '../../lib/utils';
import { ImageIcon, Video } from 'lucide-react';

interface MediaItem {
  type: 'image' | 'video';
  url: string;
  contentId?: string;
}

interface ChatMessageProps {
  role: 'user' | 'assistant';
  text: string;
  media?: MediaItem[];
  timestamp: string;
  onMediaClick?: (contentId: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  text,
  media,
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
        {text}

        {/* Interleaved Media */}
        {media && media.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {media.map((item, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 shadow-sm transition-transform duration-200",
                  item.contentId ? "cursor-pointer hover:scale-105 active:scale-95 hover:border-primary/50" : "cursor-default"
                )}
                onClick={() => item.contentId && onMediaClick?.(item.contentId)}
              >
                <img 
                  src={item.url} 
                  alt={`attachment-${idx}`} 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  {item.type === 'image' ? (
                    <ImageIcon className="h-3 w-3 text-white opacity-70" />
                  ) : (
                    <Video className="h-3 w-3 text-white opacity-70" />
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
