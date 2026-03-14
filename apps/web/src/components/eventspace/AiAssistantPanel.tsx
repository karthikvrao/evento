import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Paperclip,
  Sparkles,
  Circle,
  X,
  Video,
  FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface AiAssistantPanelProps {
  isCollapsed: boolean;
  width?: number;
  isResizing?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onToggle: () => void;
  selectedContent?: any[];
  onRemoveSelected?: (id: string) => void;
  children?: React.ReactNode;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ 
  isCollapsed, 
  width = 320,
  isResizing = false,
  onMouseDown,
  onToggle,
  selectedContent = [],
  onRemoveSelected,
  children
}) => {
  const [input, setInput] = useState('');

  return (
    <TooltipProvider delay={0}>
      <aside 
        style={{ width: isCollapsed ? 64 : width }}
        className={cn(
          "border-l border-border/40 bg-card/30 backdrop-blur-md flex flex-col relative",
          !isResizing && "transition-[width] duration-300",
          isCollapsed ? "w-16" : ""
        )}
      >
        {/* Resize Handle - Invisible Edge (Left side for right panel) */}
        {!isCollapsed && (
          <div 
            className="absolute top-0 left-0 w-1 h-full cursor-col-resize z-50 hover:bg-primary/20 transition-colors"
            onMouseDown={onMouseDown}
          />
        )}

        {/* Toggle Button */}
        <Button 
          variant="secondary" 
          size="icon" 
          className="absolute -left-3 top-20 h-6 w-6 rounded-full border border-border shadow-md z-50 bg-background hover:bg-accent"
          onClick={onToggle}
        >
          {!isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        {/* Header */}
        <div className="p-4 border-b border-border/40 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Sparkles className="h-4 w-4 text-primary" />
                <Circle className="absolute -top-1 -right-1 h-2 w-2 fill-primary text-primary animate-pulse" />
              </div>
              <h2 className="text-sm font-bold tracking-tight">AI Assistant</h2>
            </div>
          ) : (
            <div className="mx-auto">
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-1 cursor-pointer">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-card border-border/50 text-xs font-medium">
                  AI Assistant
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Message Thread */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
            {children || (
              <div className="text-sm text-muted-foreground italic text-center py-10">
                No messages yet.
              </div>
            )}
          </div>
        )}

        {/* Input Bar */}
        {!isCollapsed && (
          <div className="p-4 border-t border-border/40 bg-background/50">
            {/* Selected Content Thumbnails */}
            {selectedContent.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto no-scrollbar p-1">
                {selectedContent.map((item) => (
                  <div key={item.id} className="relative group/thumb">
                    <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-accent/20 flex items-center justify-center">
                      {item.type === 'email' && <FileText className="h-5 w-5 text-muted-foreground" />}
                      {item.type === 'poster' && (
                        <img src={item.image || item.emailImage} alt="" className="w-full h-full object-cover" />
                      )}
                      {item.type === 'video' && (
                        <div className="relative w-full h-full">
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Video className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                      {item.type === 'text' && <FileText className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <button 
                      onClick={() => onRemoveSelected?.(item.id)}
                      className="absolute -top-1.5 -right-1.5 bg-black/80 text-white rounded-full p-0.5 border border-white/20 shadow-lg opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative group">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-full"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input 
                placeholder="Type a request..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="pl-10 pr-12 h-11 bg-accent/20 border-border/40 focus:border-primary/50 transition-all rounded-xl text-sm"
              />
              <Button 
                size="icon" 
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full transition-all duration-300",
                  input ? "bg-primary text-white shadow-md scale-100" : "bg-muted-foreground/20 text-muted-foreground scale-90 opacity-50"
                )}
                disabled={!input}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
};
