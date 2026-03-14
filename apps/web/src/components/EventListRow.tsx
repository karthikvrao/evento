import React from 'react';
import { Heart, Calendar, MoreHorizontal } from 'lucide-react';
import { type Event } from './EventCard';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface EventListRowProps {
  event: Event;
  onToggleFavorite: (id: string) => void;
  onClick: (id: string) => void;
}

export const EventListRow: React.FC<EventListRowProps> = ({ event, onToggleFavorite, onClick }) => {
  return (
    <div 
      className="group flex items-center gap-6 p-4 border-b border-border/50 hover:bg-accent/10 transition-colors cursor-pointer"
      onClick={() => onClick(event.id)}
    >
      {/* Mini Image */}
      <div className="h-12 w-12 rounded-lg overflow-hidden flex-shrink-0 border border-border/50">
        <img src={event.imageUrl} alt="" className="h-full w-full object-cover" />
      </div>

      {/* Event Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h4 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
            {event.name}
          </h4>
          <Badge variant="outline" className="h-5 text-[10px] tracking-widest font-bold uppercase opacity-70">
            {event.type}
          </Badge>
        </div>
      </div>

      {/* Date Created */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground w-40 hidden sm:flex">
        <Calendar className="h-4 w-4" />
        <span>{event.createdAt}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="icon" 
          className={`h-8 w-8 hover:bg-accent/50 ${event.isFavorite ? 'text-primary' : 'text-muted-foreground'}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(event.id);
          }}
        >
          <Heart className={`h-4 w-4 ${event.isFavorite ? 'fill-current' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
