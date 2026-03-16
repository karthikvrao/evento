import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar,
  History
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useEvents } from '../../hooks/useEvents';

interface LeftSidebarProps {
  isCollapsed: boolean;
  width?: number;
  isResizing?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onNewEvent: () => void;
  activeEventId?: string;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
  isCollapsed, 
  width = 256,
  isResizing = false,
  onMouseDown,
  onToggle, 
  onNewEvent,
  activeEventId 
}) => {
  const navigate = useNavigate();
  const { data: eventsData, isLoading: isLoadingEvents } = useEvents(1, 3);
  const recentEvents = eventsData?.items || [];

  return (
    <TooltipProvider delay={0}>
      <aside 
        style={{ width: isCollapsed ? 64 : width }}
        className={cn(
          "border-r border-border/40 bg-card/30 backdrop-blur-md flex flex-col relative",
          !isResizing && "transition-[width] duration-300",
          isCollapsed ? "w-16" : ""
        )}
      >
        {/* Resize Handle - Invisible Edge */}
        {!isCollapsed && (
          <div 
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-50 hover:bg-primary/20 transition-colors"
            onMouseDown={onMouseDown}
          />
        )}

        {/* Toggle Button - Offset to overlap border slightly */}
        <Button 
          variant="secondary" 
          size="icon" 
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border shadow-md z-50 bg-background hover:bg-accent"
          onClick={onToggle}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>

        <div className="flex-1 py-6 flex flex-col gap-8 overflow-y-auto no-scrollbar">
          {/* Quick Links */}
          <div className="px-4">
            {!isCollapsed && (
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2">
                Quick Links
              </h2>
            )}
            <Tooltip>
              <TooltipTrigger asChild onClick={() => navigate('/events')}>
                <Button 
                  title="All Events"
                  variant="ghost" 
                  className={cn(
                    "w-full justify-start gap-3 text-sm font-medium hover:bg-primary/10 hover:text-primary transition-all duration-200 group",
                    isCollapsed ? "px-2 justify-center" : "px-4"
                  )}
                >
                  <Calendar className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                  {!isCollapsed && <span>All Events</span>}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right" className="bg-card border-border/50 text-xs font-medium">
                  All Events
                </TooltipContent>
              )}
            </Tooltip>
          </div>

          {/* Recent Events */}
          <div className="px-4">
            {!isCollapsed && (
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
                <History className="h-3 w-3" />
                Recent Events
              </h2>
            )}
            <div className="space-y-1">
              {isLoadingEvents ? (
                <div className="text-xs text-muted-foreground px-4">Loading...</div>
              ) : recentEvents.length > 0 ? (
                recentEvents.map((event) => {
                  const isActive = event.id === activeEventId;
                  return (
                    <Tooltip key={event.id}>
                      <TooltipTrigger asChild onClick={() => navigate(`/events/${event.id}`)}>
                        <Button 
                          title={event.name || 'Untitled Event'}
                          variant="ghost" 
                          className={cn(
                            "w-full justify-start text-sm transition-all duration-200 group text-left",
                            isCollapsed ? "px-2 justify-center" : "px-4",
                            isActive 
                              ? "bg-primary/10 text-primary font-bold shadow-sm" 
                              : "font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          )}
                        >
                          {isCollapsed ? (
                            <span className="w-6 h-6 rounded bg-accent/20 flex items-center justify-center text-[10px] font-bold">
                              {event.name?.charAt(0) || 'E'}
                            </span>
                          ) : (
                            <span className="truncate">{event.name || 'Untitled Event'}</span>
                          )}
                          {!isCollapsed && isActive && (
                            <div className="ml-auto w-1 h-1 rounded-full bg-primary" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" className="bg-card border-border/50 text-xs font-medium">
                          {event.name || 'Untitled Event'}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground px-4">No recent events</div>
              )}
            </div>
          </div>
        </div>

        {/* New Event Button at bottom */}
        <div className="p-4 border-t border-border/40 bg-background/50 flex justify-center">
          <Tooltip>
            <TooltipTrigger asChild onClick={onNewEvent}>
              <Button 
                title="New Event"
                className={cn(
                  "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all duration-300 group w-full",
                  isCollapsed ? "w-10 h-10 rounded-xl p-0 shrink-0" : "h-11 px-4 gap-2 rounded-lg"
                )}
              >
                <Plus className={cn("h-4 w-4 transition-transform group-hover:rotate-90", !isCollapsed && "shrink-0")} />
                {!isCollapsed && <span className="font-bold tracking-tight">New Event</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="bg-card border-border/50 text-xs font-medium">
                New Event
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
};
