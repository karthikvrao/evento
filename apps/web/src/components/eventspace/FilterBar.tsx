import React from 'react';
import { 
  LayoutGrid, 
  Heart, 
  Mail, 
  Image as ImageIcon, 
  Video 
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { cn } from '../../lib/utils';

interface FilterBarProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

const filters = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
];

export const FilterBar: React.FC<FilterBarProps> = ({ activeFilter, onFilterChange }) => {
  return (
    <div className="h-12 border-b border-border/40 flex items-center pr-6 justify-end gap-2 bg-background/50 backdrop-blur-sm">
      <TooltipProvider>
        {filters.map((filter) => {
          const Icon = filter.icon;
          const isActive = activeFilter === filter.id;
          
          return (
            <Tooltip key={filter.id}>
              <TooltipTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary shadow-inner shadow-primary/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  onClick={() => onFilterChange(filter.id)}
                >
                  <Icon className={cn("h-4.5 w-4.5", isActive && "fill-current/10")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-border/50 text-xs font-medium">
                <p>{filter.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
};
