import React from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './brand/Logo';
import { Input } from './ui/input';
import { 
  Search, 
  Settings, 
  LogOut, 
  ChevronDown,
  Bell
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface NavbarProps {
  eventName?: string;
  showSearch?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ eventName, showSearch = true }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="max-w-[98%] mx-auto px-2 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/events')}>
          <Logo className="h-7 w-auto" showText={true} />
        </div>

        {/* Middle: Search or Event Name */}
        <div className="flex-1 flex justify-center overflow-hidden">
          {eventName ? (
            <div className="flex items-center gap-1.5 truncate px-4">
              <span className="text-muted-foreground text-xs font-normal shrink-0">Event /</span>
              <span className="text-sm md:text-base font-bold text-white truncate">{eventName}</span>
            </div>
          ) : showSearch && (
            <div className="flex-1 max-w-xl hidden md:flex relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search events" 
                className="pl-9 h-9 bg-accent/20 border-border/40 focus:border-primary/50 transition-all rounded-full text-sm"
              />
            </div>
          )}
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-2 shrink-0">
          {eventName && (
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full border border-background" />
            </Button>
          )}

          <Button variant="ghost" size="icon" className="hidden sm:flex h-9 w-9 text-muted-foreground hover:text-foreground">
            <Settings className="h-4.5 w-4.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 p-1 hover:bg-accent/50 rounded-full transition-all cursor-pointer outline-none border-none bg-transparent">
              <Avatar className="h-8 w-8 border border-border/50">
                <AvatarImage src={user?.photoURL || ""} alt={user?.displayName || "User"} />
                <AvatarFallback className="bg-primary/10 text-primary uppercase font-bold text-xs">
                  {user?.displayName?.[0] || user?.email?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-1 border-border/50 bg-card/95 backdrop-blur-md">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{user?.displayName || "Profile"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive transition-colors" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};
