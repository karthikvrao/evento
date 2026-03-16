import React from 'react';
import { Heart, Calendar, MoreHorizontal } from 'lucide-react';
import type { EventItem } from '../hooks/useEvents';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

/**
 * Formats an ISO date string into a short human-readable format.
 */
function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

interface EventListRowProps {
  event: EventItem;
  onToggleFavorite?: (id: string) => void;
  onClick: (id: string) => void;
}

export const EventListRow: React.FC<EventListRowProps> = ({ event, onToggleFavorite, onClick }) => {
  const eventType = event.metadata?.event_type || event.status || '';

  return (
    <div 
      className="group flex items-center gap-6 p-4 border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer"
      onClick={() => onClick(event.id)}
    >
      {/* Mini Gradient Placeholder */}
      <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 border border-border/50 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
        <span className="text-lg font-bold text-primary/50 select-none">
          {(event.name || 'E').charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Event Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h4 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
            {event.name || 'Untitled Event'}
          </h4>
          {eventType && (
            <Badge variant="outline" className="h-5 text-[10px] tracking-widest font-bold uppercase opacity-70">
              {eventType}
            </Badge>
          )}
        </div>
      </div>

      {/* Date Created */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground w-40 hidden sm:flex">
        <Calendar className="h-4 w-4" />
        <span>{formatDate(event.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onToggleFavorite && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 hover:bg-accent/50 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(event.id);
            }}
          >
            <Heart className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
