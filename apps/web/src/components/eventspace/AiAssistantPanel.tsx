import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  Sparkles,
  Circle,
  X,
  Video,
  FileText,
  ImageIcon,
  Plus
} from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
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
  onSend?: (text: string) => void;
  connected?: boolean;
}

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({ 
  isCollapsed, 
  width = 320,
  isResizing = false,
  onMouseDown,
  onToggle,
  selectedContent = [],
  onRemoveSelected,
  children,
  onSend,
  connected = true
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > 5) {
      alert("You can only attach up to 5 items.");
      return;
    }

    const newAttachments = [...attachments];
    
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is too large. Max size is 5MB.`);
        continue;
      }

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) {
        alert(`${file.name} is not a supported file type. Only images and PDFs are allowed.`);
        continue;
      }

      const isDuplicate = attachments.some(a => a.name === file.name && a.file?.size === file.size);
      if (isDuplicate) {
        continue;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const attachment: any = {
        id,
        name: file.name,
        type: isImage ? 'image' : 'pdf',
        file: file
      };

      if (isImage) {
        attachment.preview = URL.createObjectURL(file);
      }

      newAttachments.push(attachment);
    }

    setAttachments(newAttachments);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const filtered = prev.filter(a => a.id !== id);
      // Revoke object URL to avoid memory leaks
      const removed = prev.find(a => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const handleSubmit = () => {
    if (input.trim() && onSend) {
      onSend(input);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
          className="absolute -left-3 top-20 h-6 w-6 rounded-full border border-border shadow-md z-50 bg-background hover:bg-accent focus:outline-none"
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
            <div className="mx-auto mt-2">
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-2 cursor-pointer rounded-xl hover:bg-white/5 transition-colors" onClick={onToggle}>
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
        <div className="flex-1 overflow-y-auto p-4 pb-6 custom-scrollbar flex flex-col-reverse gap-6">
          {isCollapsed ? null : (
            children || (
              <div className="text-sm text-muted-foreground italic text-center py-10 w-full flex items-center justify-center">
                Waiting for connection...
              </div>
            )
          )}
        </div>

        {/* Input Bar */}
        {!isCollapsed && (
          <div className="p-4 border-t border-border/40 bg-background/50">
            {/* Selected Content Thumbnails */}
            {/* Selected Content & Local Attachments */}
            {(selectedContent.length > 0 || attachments.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto custom-scrollbar p-1">
                {/* Apps Content */}
                {selectedContent.map((item) => (
                  <div key={item.id} className="relative group/thumb">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-accent/20 flex items-center justify-center">
                          {item.type === 'email' && <FileText className="h-5 w-5 text-muted-foreground" />}
                          {item.type === 'poster' && (
                            item.image ? <img src={item.image || item.emailImage} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                          {item.type === 'video' && (
                            <div className="relative w-full h-full flex items-center justify-center">
                              {item.image ? <img src={item.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" /> : null}
                              <Video className="h-4 w-4 text-white drop-shadow-md z-10" />
                            </div>
                          )}
                          {item.type === 'text' && <FileText className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-card border-border/50 text-[10px] font-medium max-w-[200px] break-all">
                        {item.title || item.type}
                      </TooltipContent>
                    </Tooltip>
                    <button 
                      onClick={() => onRemoveSelected?.(item.id)}
                      className="absolute -top-1.5 -right-1.5 bg-black/80 text-white rounded-full p-0.5 border border-white/20 shadow-lg opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                {/* Local File Attachments */}
                {attachments.map((file) => (
                  <div key={file.id} className="relative group/thumb">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-border bg-accent/20 flex items-center justify-center">
                          {file.type === 'image' && file.preview ? (
                            <img src={file.preview} alt="" className="w-full h-full object-cover" />
                          ) : (
                            file.type === 'image' ? <ImageIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-5 w-5 text-red-400" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-card border-border/50 text-[10px] font-medium max-w-[200px] break-all">
                        {file.name}
                      </TooltipContent>
                    </Tooltip>
                    <button 
                      onClick={() => removeAttachment(file.id)}
                      className="absolute -top-1.5 -right-1.5 bg-black/80 text-white rounded-full p-0.5 border border-white/20 shadow-lg opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative group">
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <Textarea 
                placeholder={connected ? "Type a request..." : "Connecting..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!connected}
                rows={1}
                className="pl-10 pr-12 min-h-[44px] max-h-32 py-3 bg-accent/20 border-border/40 focus:border-primary/50 transition-all rounded-xl text-sm resize-none custom-scrollbar"
              />
              <div 
                className="absolute left-1 bottom-1.5 z-30"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-full"
                      disabled={!connected}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="bg-card border-border/50 text-xs font-medium">
                    Add files (image or pdf)
                  </TooltipContent>
                </Tooltip>
              </div>
              <Button 
                type="button"
                size="icon" 
                onClick={handleSubmit}
                disabled={!connected || !input.trim()}
                className={cn(
                  "absolute right-1 bottom-1.5 h-8 w-8 rounded-full transition-all duration-300 z-30",
                  input.trim() ? "bg-primary text-white shadow-md scale-100 opacity-100" : "bg-muted-foreground/20 text-muted-foreground scale-90 opacity-50"
                )}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[10px] text-muted-foreground">Evento Agent can make mistakes.</span>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
};
