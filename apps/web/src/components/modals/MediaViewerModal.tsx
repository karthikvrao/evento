import React, { useEffect, useCallback, useRef } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Heart, 
  MessageSquarePlus, 
  Copy,
  Check
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export interface MediaItem {
  id: string;
  title: string;
  type: 'poster' | 'video' | 'image';
  image: string;
  timestamp: string;
  variant?: string;
  resolution?: string;
  isFavorite?: boolean;
  isSelected?: boolean;
}

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MediaItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onFavorite?: (id: string) => void;
  onSelect?: (id: string) => void;
  onCopy?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  items,
  currentIndex,
  onIndexChange,
  onFavorite,
  onSelect,
  onCopy,
  onDownload,
}) => {
  const activeItem = items[currentIndex];
  const filmstripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && filmstripRef.current) {
      const activeBtn = filmstripRef.current.children[currentIndex] as HTMLElement;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentIndex, isOpen]);

  const handlePrevious = useCallback(() => {
    onIndexChange((currentIndex - 1 + items.length) % items.length);
  }, [currentIndex, items.length, onIndexChange]);

  const handleNext = useCallback(() => {
    onIndexChange((currentIndex + 1) % items.length);
  }, [currentIndex, items.length, onIndexChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrevious, handleNext]);

  if (!isOpen || !activeItem) return null;

  return (
    <TooltipProvider delay={0}>
      <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/40">
          <div className="flex flex-col">
            <h2 className="text-white font-bold text-lg leading-tight">{activeItem.title}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="capitalize">{activeItem.type}</span>
              {(activeItem.variant || activeItem.resolution) && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span>
                    {activeItem.variant && `Variant ${activeItem.variant}`}
                    {activeItem.variant && activeItem.resolution && ' • '}
                    {activeItem.resolution && `${activeItem.resolution} px`}
                  </span>
                </>
              )}
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>{activeItem.timestamp}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-10 w-10 text-white hover:bg-white/10 transition-colors",
                    activeItem.isSelected && "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20"
                  )}
                  onClick={() => onSelect?.(activeItem.id)}
                >
                  {activeItem.isSelected ? <Check className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" positionerClassName="z-[110]" className="bg-card border-border/50 text-xs font-medium">Add to Chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 text-white hover:bg-white/10 transition-colors"
                  onClick={() => onCopy?.(activeItem.id)}
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" positionerClassName="z-[110]" className="bg-card border-border/50 text-xs font-medium">Copy to clipboard</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn(
                    "h-10 w-10 text-white hover:bg-white/10 transition-colors",
                    activeItem.isFavorite && "text-primary fill-primary"
                  )}
                  onClick={() => onFavorite?.(activeItem.id)}
                >
                  <Heart className={cn("h-5 w-5", activeItem.isFavorite && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" positionerClassName="z-[110]" className="bg-card border-border/50 text-xs font-medium">Favorite</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-10 w-10 text-white hover:bg-white/10 transition-colors"
                  onClick={() => onDownload?.(activeItem.id)}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" positionerClassName="z-[110]" className="bg-card border-border/50 text-xs font-medium">Download</TooltipContent>
            </Tooltip>

            <div className="w-px h-6 bg-white/10 mx-2" />

            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 text-white hover:bg-white/10 transition-colors rounded-full"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 relative flex items-center justify-center p-4 group/viewer">
          {/* Previous Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-6 z-10 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 text-white backdrop-blur-md opacity-0 group-hover/viewer:opacity-100 transition-opacity active:scale-95"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>

          <div className="relative w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-500">
            {activeItem.type === 'video' ? (
              <video 
                src={activeItem.image} 
                controls 
                autoPlay
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : (
              <img 
                src={activeItem.image} 
                alt={activeItem.title} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>

          {/* Next Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-6 z-10 h-12 w-12 rounded-full bg-white/5 hover:bg-white/10 text-white backdrop-blur-md opacity-0 group-hover/viewer:opacity-100 transition-opacity active:scale-95"
            onClick={handleNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </div>

        {/* Filmstrip */}
        <div className="h-24 bg-black/60 border-t border-white/5 flex items-center justify-center px-4 overflow-hidden">
          <div 
            ref={filmstripRef}
            className="flex gap-2 overflow-x-auto no-scrollbar py-2 max-w-full"
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => onIndexChange(index)}
                className={cn(
                  "relative w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 hover:scale-105 active:scale-95",
                  currentIndex === index 
                    ? "border-primary ring-2 ring-primary/20 scale-110 z-10" 
                    : "border-transparent opacity-50 hover:opacity-100"
                )}
              >
                <img 
                  src={item.image} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
