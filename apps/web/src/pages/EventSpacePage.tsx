import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { getAuth } from 'firebase/auth';
import { Navbar } from '../components/Navbar';
import { CreateEventModal } from '../components/modals/CreateEventModal';
import { FilterBar } from '../components/eventspace/FilterBar';
import { LeftSidebar } from '../components/eventspace/LeftSidebar';
import { AiAssistantPanel } from '../components/eventspace/AiAssistantPanel';
import { ContentCard } from '../components/eventspace/ContentCard';
import { ChatMessage } from '../components/eventspace/ChatMessage';
import { MediaViewerModal } from '../components/modals/MediaViewerModal';
import type { MediaItem } from '../components/modals/MediaViewerModal';
import { useEvent, useCreateEvent } from '../hooks/useEvents';
import { useEventSession } from '../hooks/useEventSession';

export default function EventSpacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // UI State
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

  // Dragging refs
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  // 1. Session & Live Data Management
  const {
    messages,
    contentCards,
    isChatConnected,
    isAgentThinking,
    handleSendMessage
  } = useEventSession(id || '');

  // 2. TanStack Query Hooks (static event info)
  const { data: eventData } = useEvent(id || '');
  const activeEventName = eventData?.name || "Loading...";

  const createEventMutation = useCreateEvent();

  // Navigation Logic (Auth redirection)
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Handle chat submission
  const handleChatSubmit = (text: string) => {
    handleSendMessage(text);
  };

  // Auto-scroll chat handled by AiAssistantPanel's useEffect

  // 4. Auto-scroll main content when new assets arrive
  const mainContentRef = useRef<HTMLDivElement>(null);
  const isMainScrolledToBottom = useRef(true);

  useEffect(() => {
    const container = mainContentRef.current;
    if (!container) return;
    const inner = container.firstElementChild;
    if (!inner) return;

    const handleScroll = () => {
      isMainScrolledToBottom.current = container.scrollHeight - container.scrollTop <= container.clientHeight + 200;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      if (isMainScrolledToBottom.current) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    });

    resizeObserver.observe(inner);
    resizeObserver.observe(container);

    // Initial check
    if (isMainScrolledToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const handleCreateEvent = async (eventData: { name: string; description?: string; type?: string }) => {
    try {
      const result = await createEventMutation.mutateAsync({
        name: eventData.name,
        description: eventData.description,
        event_type: eventData.type,
      });
      setIsModalOpen(false);
      navigate(`/events/${result.event_id}`);
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };


  // Format content cards for UI
  const mediaItems: MediaItem[] = contentCards
    .filter(item => item.asset_type === 'video' || item.asset_type === 'image')
    .map((item) => ({
      id: item.id,
      title: item.title || 'Media Asset',
      type: item.asset_type === 'video' ? 'video' : 'image',
      image: item.public_url,
      timestamp: new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      isFavorite: false,
      isSelected: selectedContentIds.includes(item.id)
    }));

  const openMediaViewer = (itemId: string) => {
    const index = mediaItems.findIndex(item => item.id === itemId);
    if (index !== -1) {
      setActiveViewerIndex(index);
      setIsViewerOpen(true);
    }
  };

  const toggleSelect = (contentId: string) => {
    setSelectedContentIds(prev => 
      prev.includes(contentId) 
        ? prev.filter(id => id !== contentId) 
        : [...prev, contentId]
    );
  };

  const toggleFavorite = (contentId: string) => {
    console.log("Toggle favorite:", contentId);
  };

  const handleMediaClick = (contentId: string) => {
    setHighlightedId(contentId);
    const element = document.getElementById(`content-card-${contentId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedId(null), 3000);
  };

  const filteredContent = contentCards.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'favorites') return false; // Not implemented in DB yet
    
    const uiTypeMap: Record<string, string[]> = {
      'poster': ['poster', 'social_post'],
      'email': ['email'],
      'video': ['video'],
      'text': ['text']
    };
    
    // activeFilter might be "posters", so slice(-1)
    const baseFilter = activeFilter.endsWith('s') ? activeFilter.slice(0, -1) : activeFilter;
    const allowedTypes = uiTypeMap[baseFilter] || [baseFilter];
    
    return allowedTypes.includes(item.content_category);
  });

  // Group content by timestamp
  const groupedContent = filteredContent.reduce<Record<string, any[]>>((acc, item) => {
    const time = new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    if (!acc[time]) acc[time] = [];
    acc[time].push(item);
    return acc;
  }, {});

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


  const selectedContentItems = contentCards
    .filter(item => selectedContentIds.includes(item.id))
    .map(item => ({
      id: item.id,
      type: (item.content_category === 'video' ? 'video' : 'poster') as 'poster' | 'video' | 'email',
      image: item.public_url || item.thumbnail_url
    }));

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground font-geist">
      {/* Navbar */}
      <Navbar eventName={activeEventName} />

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
          activeEventId={id!}
        />

        {/* Main Content Area */}
        <main ref={mainContentRef} className="flex-1 overflow-y-auto bg-background flex flex-col relative custom-scrollbar">
          {/* Secondary Filter Bar */}
          <FilterBar 
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
          
          <div className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar">
            <div className="max-w-[1400px] mx-auto">
              {filteredContent.length > 0 ? (
                <div className="flex flex-col space-y-20">
                  {Object.entries(groupedContent)
                    .sort(([timeA], [timeB]) => timeA.localeCompare(timeB)) // Chronological
                    .map(([time, items]) => (
                    <div key={time} className="space-y-10">
                      {/* Timestamp Separator */}
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
                            title={item.title || 'Generated Content'}
                            type={item.content_category === 'email' ? 'email' : item.content_category === 'video' ? 'video' : 'poster'}
                            subject={item.subject}
                            image={item.public_url}
                            content={item.rich_content}
                            emailImage={item.content_category === 'email' ? item.public_url : undefined}
                            isFavorite={false}
                            isActive={highlightedId === item.id}
                            isSelected={selectedContentIds.includes(item.id)}
                            onFavorite={() => toggleFavorite(item.id)}
                            onCopy={() => console.log("Copy content:", item.id)}
                            onDownload={() => console.log("Download asset:", item.id)}
                            onSelect={() => toggleSelect(item.id)}
                            onOpenViewer={item.asset_type === 'image' || item.asset_type === 'video' ? () => openMediaViewer(item.id) : undefined}
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
          onSend={handleChatSubmit}
          connected={isChatConnected}
        >
          <>
            {/* Typing / thinking indicator — shown while agent generates images */}
            {isAgentThinking && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-accent/50 border border-border/20 max-w-[85%] mr-auto shadow-sm">
                <span className="text-xs text-muted-foreground">Generating content</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            )}
            {/* Map messages backwards so the newest is first in the DOM, pushing it natively to the bottom of the flex-col-reverse panel */}
            {messages.slice().reverse().map((msg, idx) => (
              <ChatMessage 
                key={`msg-${messages.length - 1 - idx}`}
                role={msg.role}
                text={msg.text}
                mediaRefs={msg.mediaRefs}
                timestamp={msg.timestamp}
                onMediaClick={handleMediaClick}
              />
            ))}
            {!isChatConnected && messages.length === 0 && (
              <div className="text-sm text-center text-muted-foreground animate-pulse py-10">
                Connecting to Evento Agent...
              </div>
            )}
          </>
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
        onCreate={handleCreateEvent}
        isCreating={createEventMutation.isPending}
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

