import React from 'react';
import { Heart, Calendar, Clock, MapPin, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { EventItem } from '../hooks/useEvents';

/**
 * Formats an ISO date string into a short human-readable format.
 * Falls back to "—" if the value is missing or invalid.
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

// ── Gradient placeholder colours for events without a cover image ────────
const GRADIENT_PALETTES = [
  'from-blue-600/40 to-indigo-800/40',
  'from-emerald-600/40 to-teal-800/40',
  'from-purple-600/40 to-fuchsia-800/40',
  'from-amber-600/40 to-orange-800/40',
  'from-rose-600/40 to-pink-800/40',
  'from-cyan-600/40 to-sky-800/40',
];

function gradientForId(id: string): string {
  // Simple hash to pick a consistent gradient per event id
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GRADIENT_PALETTES[Math.abs(hash) % GRADIENT_PALETTES.length];
}

// ── Component ────────────────────────────────────────────────────────────

interface EventCardProps {
  event: EventItem;
  onToggleFavorite?: (id: string) => void;
  onClick: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onToggleFavorite, onClick }) => {
  const eventType = event.metadata?.event_type || event.status || '';
  const location = event.metadata?.location;
  const dateLabel = formatDate(event.created_at);

  return (
    <div 
      className="group relative flex flex-col bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      onClick={() => onClick(event.id)}
    >
      {/* Image / Gradient Placeholder */}
      <div className="relative h-48 w-full overflow-hidden">
        {/* Gradient placeholder with first letter of event name */}
        <div className={`h-full w-full bg-gradient-to-br ${gradientForId(event.id)} flex items-center justify-center`}>
          <span className="text-5xl font-bold text-white/30 select-none">
            {(event.name || 'E').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        {/* Badges */}
        {eventType && (
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className="bg-primary/90 text-primary-foreground border-none hover:bg-primary uppercase text-[10px] tracking-widest font-bold px-2 py-1">
              {eventType}
            </Badge>
          </div>
        )}

        {/* Favorite Button */}
        {onToggleFavorite && (
          <button 
            className="absolute top-3 right-3 p-2 rounded-full bg-black/20 backdrop-blur-md border border-white/20 text-white hover:bg-primary/80 transition-all z-10 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(event.id);
            }}
          >
            <Heart className="h-4 w-4" />
          </button>
        )}

        <div className="absolute bottom-3 left-3 text-white">
          <div className="flex items-center gap-1.5 text-xs font-medium text-white/90">
            <Calendar className="h-3 w-3" />
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {event.name || 'Untitled Event'}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {event.description || 'No description yet'}
        </p>

        <div className="pt-2 flex items-center justify-between mt-auto">
          {event.start_time && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDate(event.start_time)}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-[100px]">{location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
