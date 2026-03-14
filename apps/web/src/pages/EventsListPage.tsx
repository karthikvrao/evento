import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Navbar } from '../components/Navbar';
import { EventCard } from '../components/EventCard';
import { EventListRow } from '../components/EventListRow';
import { type Event } from '../components/EventCard';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/button';
import { Plus, LayoutGrid, List, Filter, Sparkles, Search } from 'lucide-react';
import { Input } from '../components/ui/input';
import { CreateEventModal } from '../components/modals/CreateEventModal';



// Mock Data
const MOCK_EVENTS: Event[] = [
  {
    id: '1',
    name: 'Main Stage Tech Summit 2026',
    description: 'A global gathering of tech innovators discussing the future of AI and multimodal storytelling.',
    date: 'Oct 24, 2026',
    time: '09:00 AM',
    location: 'San Francisco, CA',
    type: 'Conference',
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800',
    isFavorite: true,
    createdAt: '2 days ago'
  },
  {
    id: '2',
    name: 'Creative Writers Workshop',
    description: 'Intensive workshop for storytellers to master the balance between human creativity and AI-assisted narrative.',
    date: 'Nov 12, 2026',
    time: '02:00 PM',
    location: 'Online / Zoom',
    type: 'Workshop',
    imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=800',
    isFavorite: false,
    createdAt: '1 week ago'
  },
  {
    id: '3',
    name: 'Underground Beats Festival',
    description: 'An immersive experience connecting music with live-generated AI visuals in a real-time stream.',
    date: 'Dec 05, 2026',
    time: '08:00 PM',
    location: 'London, UK',
    type: 'Concert',
    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800',
    isFavorite: false,
    createdAt: '3 days ago'
  },
  {
    id: '4',
    name: 'AI Product Expo',
    description: 'Discover the latest AI-first tools and products shaping the next decade of digital interaction.',
    date: 'Oct 15, 2026',
    time: '10:00 AM',
    location: 'Berlin, Germany',
    type: 'Conference',
    imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800',
    isFavorite: true,
    createdAt: '5 hours ago'
  },
];

const EVENT_TYPES = ['All', 'Conference', 'Workshop', 'Concert', 'Meetup'];

export default function EventsListPage() {
  const [view, setView] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [events, setEvents] = useState<Event[]>(MOCK_EVENTS);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const navigate = useNavigate();

  const handleCreateEvent = (eventData: any) => {
    console.log('Generating Event Space with data:', eventData);
    // In Phase 7, this will call the API to create the event and then navigate
    // For now, we'll just navigate to a mock ID
    navigate('/events/new-event-mock-id');
  };

  const toggleFavorite = (id: string) => {
    setEvents((prev: Event[]) => prev.map(e => e.id === id ? { ...e, isFavorite: !e.isFavorite } : e));
  };

  const filteredEvents = events.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || e.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="max-w-[98%] mx-auto px-2 md:px-4 py-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Events</h1>
            <p className="text-muted-foreground mt-1">Manage and create immersive event experiences.</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Mobile Search - visible only on small screens */}
            <div className="md:hidden relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search" 
                 className="pl-9 h-10 w-full bg-accent/20 border-border/40"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>
            
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex items-center gap-2 px-6 h-11 font-semibold group rounded-xl"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              <span>Create Event</span>
            </Button>
          </div>
        </div>

        {/* Filters and View Toggles */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 py-2">
          <div className="flex flex-wrap items-center gap-2">
            {EVENT_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border cursor-pointer ${
                  selectedType === type 
                    ? 'bg-primary/10 border-primary text-primary shadow-sm' 
                    : 'bg-accent/40 border-border/50 text-muted-foreground hover:border-muted-foreground/50 hover:bg-accent/60'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto">

            <div className="flex items-center p-1 bg-accent/40 rounded-xl border border-border/50">
              <button 
                className={`p-2 rounded-lg transition-all cursor-pointer ${view === 'card' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setView('card')}
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button 
                className={`p-2 rounded-lg transition-all cursor-pointer ${view === 'list' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setView('list')}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            
            <div className="h-8 w-[1px] bg-border/50 mx-1 hidden sm:block" />
            
            <Button variant="outline" size="sm" className="hidden sm:flex border-border/50 text-muted-foreground hover:text-foreground h-10 rounded-xl px-4">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {/* Dynamic Content Rendering */}
        {filteredEvents.length > 0 ? (
          view === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* New Event Card (Placeholder) */}
              <div 
                className="group relative flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-border/50 rounded-2xl bg-accent/10 hover:bg-accent/20 hover:border-primary/40 transition-all duration-300 cursor-pointer text-center p-6"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 mb-4 scale-110">
                  <Plus className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-lg mb-2">Create New Event</h3>
                <p className="text-sm text-muted-foreground px-4">Ready to start a new event experience?</p>
              </div>

              {filteredEvents.map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  onToggleFavorite={toggleFavorite}
                  onClick={(id: string) => navigate(`/events/${id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-card/30 backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden shadow-sm">
              <div className="flex flex-col">
                {filteredEvents.map(event => (
                  <EventListRow 
                    key={event.id} 
                    event={event} 
                    onToggleFavorite={toggleFavorite}
                    onClick={(id) => navigate(`/events/${id}`)}
                  />
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 rounded-full bg-primary/5 mb-6">
              <Sparkles className="h-12 w-12 text-primary/40" />
            </div>
            <h3 className="text-2xl font-bold mb-2">No events found</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mb-8">
              We couldn't find any events matching your current search or filters.
            </p>
            <Button 
              variant="outline" 
              className="border-primary/30 text-primary hover:bg-primary/5 rounded-xl h-11 px-8"
              onClick={() => {
                setSearchQuery('');
                setSelectedType('All');
              }}
            >
              Clear all filters
            </Button>
          </div>
        )}
      </main>

      {/* Simplified Footer */}
      <footer className="mt-auto border-t border-border/40 py-8 bg-background/50">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 opacity-70">
            <Logo className="h-4 w-auto grayscale contrast-125" showText={true} />
            <span className="font-medium">© 2026 Evento Inc.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-primary transition-colors">Documentation</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
          </div>
        </div>
      </footer>

      <CreateEventModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreate={handleCreateEvent}
      />
    </div>
  );
}
