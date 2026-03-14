import React from 'react';
import { 
  Heart, 
  Copy, 
  Download, 
  Mail, 
  Image as ImageIcon, 
  Video,
  FileText,
  MessageSquarePlus,
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

interface ContentCardProps {
  id: string;
  title: string;
  type: 'email' | 'poster' | 'video' | 'text';
  image?: string;
  subject?: string;
  content?: string;
  emailImage?: string;
  isFavorite: boolean;
  isActive?: boolean;
  isSelected?: boolean;
  onFavorite: () => void;
  onDownload?: () => void;
  onCopy?: () => void;
  onSelect?: () => void;
}

const typeIcons = {
  email: Mail,
  poster: ImageIcon,
  video: Video,
  text: FileText,
};

export const ContentCard: React.FC<ContentCardProps> = ({
  id,
  title,
  type,
  image,
  subject,
  content,
  emailImage,
  isFavorite,
  isActive,
  isSelected,
  onFavorite,
  onDownload,
  onCopy,
  onSelect,
}) => {
  const Icon = typeIcons[type];
  const isEmail = type === 'email';

  return (
    <div 
      className={cn(
        "flex flex-col gap-4 group/container",
        isEmail ? "col-span-full" : ""
      )}
    >
      {/* Title & Icon outside and above */}
      <div className="flex items-center gap-3 px-1">
        <div className={cn(
          "p-1.5 rounded-lg transition-colors",
          isSelected ? "bg-primary text-white" : "bg-white/5 text-muted-foreground group-hover/container:text-white group-hover/container:bg-white/10"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-bold text-sm tracking-tight text-white/80 group-hover/container:text-white transition-colors">{title}</h3>
      </div>

      <div 
        id={`content-card-${id}`}
        className={cn(
          "group relative bg-[#1a1c20] border rounded-2xl overflow-hidden transition-all duration-300 shadow-xl flex flex-col",
          isActive 
            ? "border-primary ring-2 ring-primary/20 animate-pulse-border scale-[1.01]" 
            : isSelected 
              ? "border-emerald-500/80 bg-emerald-500/5 ring-4 ring-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              : "border-border/40 hover:border-primary/40 hover:shadow-primary/5"
        )}
      >
        <style>{`
          @keyframes pulse-border {
            0%, 100% { border-color: rgba(59, 130, 246, 0.5); }
            50% { border-color: rgba(59, 130, 246, 1); }
          }
          .animate-pulse-border {
            animation: pulse-border 0.8s ease-in-out infinite;
          }
        `}</style>

        {/* Header for Email */}
        {isEmail && (
          <div className="flex items-center gap-4 px-4 py-3 bg-accent/5 border-b border-border/20">
            <div className="flex gap-1.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80" />
            </div>
            <div className="flex-1 bg-black/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground line-clamp-1 border border-white/5">
              Subject: {subject}
            </div>
          </div>
        )}

        {/* Main Content / Media */}
        <div className={cn("relative flex-1", !isEmail && "w-full")}>
          {isEmail ? (
            <div className="p-8 space-y-8">
              {emailImage && (
                <div className="rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                  <img 
                    src={emailImage} 
                    alt="email content" 
                    className="w-full h-auto object-cover max-h-[400px] transition-transform duration-700 group-hover:scale-[1.02]" 
                  />
                </div>
              )}

              <div className="space-y-4">
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {content}
                </p>
                <div className="pt-6 flex gap-3">
                  <div className="h-2 w-32 rounded-full bg-white/5" />
                  <div className="h-2 w-64 rounded-full bg-white/5" />
                </div>
              </div>
            </div>
          ) : (
            <>
              {image ? (
                <div className="w-full h-full overflow-hidden">
                  <img 
                    src={image} 
                    alt={title} 
                    className="w-full h-auto min-h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="aspect-video w-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/20">
                  <Icon className="h-12 w-12 text-muted-foreground/20" />
                </div>
              )}
            </>
          )}

          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-2 z-20">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className={cn(
                      "h-10 w-10 rounded-xl border-white/10 text-white backdrop-blur-md shadow-lg transition-all active:scale-95",
                      isSelected ? "bg-primary text-white border-primary" : "bg-white/10 hover:bg-white/20"
                    )}
                    onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
                  >
                    {isSelected ? <Check className="h-5 w-5" /> : <MessageSquarePlus className="h-5 w-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Add to Chat</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className={cn(
                      "h-10 w-10 rounded-xl border-white/10 text-white backdrop-blur-md shadow-lg transition-all active:scale-95",
                      isFavorite ? "bg-primary text-white border-primary" : "bg-white/10 hover:bg-white/20"
                    )}
                    onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                  >
                    <Heart className={cn("h-5 w-5", isFavorite && "fill-current")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Favorite</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 border-white/10 text-white backdrop-blur-md shadow-lg transition-all active:scale-95"
                    onClick={(e) => { e.stopPropagation(); onCopy?.(); }}
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Copy Text</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 border-white/10 text-white backdrop-blur-md shadow-lg transition-all active:scale-95"
                    onClick={(e) => { e.stopPropagation(); onDownload?.(); }}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Download</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Hover Tint Overlay */}
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};
