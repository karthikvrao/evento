import React from 'react';
import { Heart, Calendar, Clock, MapPin, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: string;
  imageUrl: string;
  isFavorite: boolean;
  createdAt: string;
}

interface EventCardProps {
  event: Event;
  onToggleFavorite: (id: string) => void;
  onClick: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onToggleFavorite, onClick }) => {
  return (
    <div 
      className="group relative flex flex-col bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      onClick={() => onClick(event.id)}
    >
      {/* Image Container */}
      <div className="relative h-48 w-full overflow-hidden">
        <img 
          src={event.imageUrl} 
          alt={event.name} 
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge className="bg-primary/90 text-primary-foreground border-none hover:bg-primary uppercase text-[10px] tracking-widest font-bold px-2 py-1">
            {event.type}
          </Badge>
        </div>

        {/* Favorite Button */}
        <button 
          className="absolute top-3 right-3 p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/20 text-white hover:bg-primary/80 transition-all z-10 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(event.id);
          }}
        >
          <Heart className={`h-4 w-4 ${event.isFavorite ? 'fill-white' : ''}`} />
        </button>

        <div className="absolute bottom-3 left-3 text-white">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <Calendar className="h-3 w-3" />
            <span>{event.date}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {event.name}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {event.description}
        </p>

        <div className="pt-2 flex items-center justify-between mt-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{event.time}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[100px]">{event.location}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
