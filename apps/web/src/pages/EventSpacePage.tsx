import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Navbar } from '../components/Navbar';
import { CreateEventModal } from '../components/modals/CreateEventModal';
import { FilterBar } from '../components/eventspace/FilterBar';
import { LeftSidebar } from '../components/eventspace/LeftSidebar';
import { AiAssistantPanel } from '../components/eventspace/AiAssistantPanel';
import { ContentCard } from '../components/eventspace/ContentCard';
import { ChatMessage } from '../components/eventspace/ChatMessage';
import { MediaViewerModal } from '../components/modals/MediaViewerModal';
import type { MediaItem } from '../components/modals/MediaViewerModal';

// Mock data
const mockEvents = [
  { id: '1', name: 'Tech Innovation Summit 2026' },
  { id: '2', name: 'Product Launch Workshop' },
  { id: '3', name: 'Marketing Strategy Session' },
];

const mockContent = [
  {
    id: 'c1',
    title: 'Welcome Email Draft',
    type: 'email' as const,
    subject: 'Your Exclusive Invitation to Tech Nexus 2026',
    content: 'Get ready for an immersive experience at the Tech Innovation Summit. We are excited to have you join us for a day of inspiration and networking.',
    emailImage: 'https://images.unsplash.com/photo-1540575861501-7cf05a4b125a?w=1200&h=400&fit=crop',
    isFavorite: true,
    timestamp: '10:30 AM',
  },
  {
    id: 'c2',
    title: 'Official Event Poster',
    type: 'poster' as const,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
    isFavorite: false,
    timestamp: '10:30 AM',
  },
  {
    id: 'c5',
    title: 'Workshop Variations',
    type: 'poster' as const,
    image: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&q=80',
    isFavorite: false,
    timestamp: '10:30 AM',
  },
  {
    id: 'c4',
    title: 'Keynote Speaker Bio',
    type: 'text' as const,
    content: 'Biography and introduction for Dr. Sarah Chen, our main keynote speaker.',
    isFavorite: false,
    timestamp: '10:35 AM',
  },
  {
    id: 'c3',
    title: 'Social Media Teaser',
    type: 'video' as const,
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80',
    isFavorite: true,
    timestamp: '10:35 AM',
  },
];

const mockMessages = [
  {
    role: 'assistant' as const,
    text: "Hi! I've analyzed your event details. Would you like me to generate some initial drafts for the email newsletter or start with the poster designs?",
    timestamp: '10:24 AM',
  },
  {
    role: 'user' as const,
    text: "Let's start with the posters first. Something modern and tech-focused.",
    timestamp: '10:25 AM',
  },
  {
    role: 'assistant' as const,
    text: "Great choice! Here are a few concepts I've generated with different visual styles. Click them to see them in the main view!",
    media: [
      { type: 'image' as const, url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200&q=80', contentId: 'c2' },
      { type: 'image' as const, url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=200&q=80', contentId: 'c5' },
    ],
    timestamp: '10:25 AM',
  },
];

export default function EventSpacePage() {
  const { id } = useParams<{ id: string }>();
  
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(256);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeViewerIndex, setActiveViewerIndex] = useState(0);
  
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  // Extract all media items for the viewer
  const mediaItems: MediaItem[] = mockContent
    .filter(item => item.type === 'video' || item.type === 'poster' || (item.type === 'email' && (item as any).emailImage))
    .map((item, idx) => ({
      id: item.id,
      title: item.title,
      type: (item.type === 'email' ? 'image' : item.type) as any,
      image: item.type === 'poster' ? (item as any).image : (item as any).image || (item as any).emailImage,
      timestamp: item.timestamp,
      variant: item.type === 'poster' ? (idx % 3 + 1).toString() : undefined,
      resolution: item.type === 'poster' ? '1024x1024' : item.type === 'video' ? '1920x1080' : '1200x400',
      isFavorite: item.isFavorite,
      isSelected: selectedContentIds.includes(item.id)
    }));

  const openMediaViewer = (itemId: string) => {
    const index = mediaItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      setActiveViewerIndex(index);
      setIsViewerOpen(true);
    }
  };

  const activeEvent = mockEvents.find(e => e.id === id) || mockEvents[0];

  const toggleSelect = (contentId: string) => {
    setSelectedContentIds(prev => 
      prev.includes(contentId) 
        ? prev.filter(id => id !== contentId) 
        : [...prev, contentId]
    );
  };

  const toggleFavorite = (contentId: string) => {
    console.log("Toggle favorite:", contentId);
    // In a real app we'd update DB/mockContent state
    // For now we just log it as mockContent is a constant
  };

  const handleMediaClick = (contentId: string) => {
    setHighlightedId(contentId);
    const element = document.getElementById(`content-card-${contentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedId(null), 3000);
  };

  const filteredContent = mockContent.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'favorites') return item.isFavorite;
    return item.type === activeFilter.slice(0, -1) || item.type === activeFilter;
  });

  // Resizing logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft.current) {
        let newWidth = e.clientX;
        if (newWidth < 100) {
          setLeftSidebarCollapsed(true);
          setLeftSidebarWidth(64);
        } else {
          setLeftSidebarCollapsed(false);
          setLeftSidebarWidth(Math.min(Math.max(newWidth, 180), 400));
        }
      }
      if (isDraggingRight.current) {
        let newWidth = window.innerWidth - e.clientX;
        if (newWidth < 100) {
          setRightSidebarCollapsed(true);
          setRightSidebarWidth(64);
        } else {
          setRightSidebarCollapsed(false);
          setRightSidebarWidth(Math.min(Math.max(newWidth, 240), 600));
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLeft.current || isDraggingRight.current) {
        isDraggingLeft.current = false;
        isDraggingRight.current = false;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const onMouseDownLeft = (e: React.MouseEvent) => {
    isDraggingLeft.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const onMouseDownRight = (e: React.MouseEvent) => {
    isDraggingRight.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  };

  const selectedContentItems = mockContent.filter(item => selectedContentIds.includes(item.id));

  // Group content by timestamp
  const groupedContent = filteredContent.reduce((acc, item) => {
    const time = item.timestamp;
    if (!acc[time]) acc[time] = [];
    acc[time].push(item);
    return acc;
  }, {} as Record<string, typeof mockContent>);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-geist">
      {/* Navbar */}
      <Navbar eventName={activeEvent.name} />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <LeftSidebar 
          isCollapsed={leftSidebarCollapsed}
          width={leftSidebarWidth}
          isResizing={isResizing}
          onMouseDown={onMouseDownLeft}
          onToggle={() => {
            setLeftSidebarCollapsed(!leftSidebarCollapsed);
            setLeftSidebarWidth(!leftSidebarCollapsed ? 64 : 256);
          }}
          onNewEvent={() => setIsModalOpen(true)}
          activeEventId={activeEvent.id}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0d0f12]">
          {/* Secondary Filter Bar */}
          <FilterBar 
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          
          <div className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar">
            <div className="max-w-[1400px] mx-auto">
              {filteredContent.length > 0 ? (
                <div className="space-y-20">
                  {Object.entries(groupedContent).map(([time, items]) => (
                    <div key={time} className="space-y-10">
                      {/* Timestamp Separator - More Prominent */}
                      <div className="flex items-center gap-6 px-4">
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/20" />
                        <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] bg-white/5 border border-white/10 px-4 py-1.5 rounded-full whitespace-nowrap shadow-xl">
                          {time}
                        </span>
                        <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/20" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-12 gap-y-16 px-4">
                        {items.map((item) => (
                          <ContentCard 
                            key={item.id}
                            id={item.id}
                            title={item.title}
                            type={item.type}
                            subject={(item as any).subject}
                            image={(item as any).image}
                            content={item.content}
                            emailImage={(item as any).emailImage}
                            isFavorite={item.isFavorite}
                            isActive={highlightedId === item.id}
                            isSelected={selectedContentIds.includes(item.id)}
                            onFavorite={() => toggleFavorite(item.id)}
                            onCopy={() => console.log("Copy content:", item.id)}
                            onDownload={() => console.log("Download asset:", item.id)}
                            onSelect={() => toggleSelect(item.id)}
                            onOpenViewer={() => openMediaViewer(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl">
                    <History className="h-10 w-10 text-white/20" />
                  </div>
                  <div className="space-y-2 px-6">
                    <p className="text-sm md:text-base text-white/30 max-w-sm leading-relaxed font-medium">
                      All generated content, drafts, and assets are organized below. Use the AI Assistant to refine or create more.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right AI Assistant Panel */}
        <AiAssistantPanel 
          isCollapsed={rightSidebarCollapsed}
          width={rightSidebarWidth}
          isResizing={isResizing}
          onMouseDown={onMouseDownRight}
          onToggle={() => {
            setRightSidebarCollapsed(!rightSidebarCollapsed);
            setRightSidebarWidth(!rightSidebarCollapsed ? 64 : 320);
          }}
          selectedContent={selectedContentItems}
          onRemoveSelected={toggleSelect}
        >
          {/* Messages passed via children (simplified pattern) */}
          <div className="space-y-6">
            {mockMessages.map((msg, idx) => (
              <ChatMessage 
                key={idx}
                role={msg.role}
                text={msg.text}
                media={msg.media}
                timestamp={msg.timestamp}
                onMediaClick={handleMediaClick}
              />
            ))}
          </div>
        </AiAssistantPanel>
      </div>

      <MediaViewerModal 
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        items={mediaItems}
        currentIndex={activeViewerIndex}
        onIndexChange={setActiveViewerIndex}
        onFavorite={toggleFavorite}
        onSelect={toggleSelect}
        onCopy={(id) => console.log("Modal Copied:", id)}
        onDownload={(id) => console.log("Modal Downloaded:", id)}
      />

      <CreateEventModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={(data) => {
          console.log("New Event Created:", data);
          setIsModalOpen(false);
          // In a real app, we'd navigate to the new event:
          // navigate(`/events/${newId}`);
        }}
      />
    </div>
  );
}

// Simple placeholder for missing icon in empty state
function History({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="m12 7 v5l4 2"/>
    </svg>
  );
}
