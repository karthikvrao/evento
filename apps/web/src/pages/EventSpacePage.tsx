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
import type { WsAgentMessage } from '../types/chat';
import { useEvent, useChatHistory, useEventMedia, useCreateEvent } from '../hooks/useEvents';

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

  // Live Data State
  const [messages, setMessages] = useState<any[]>([]);
  const [contentCards, setContentCards] = useState<any[]>([]);
  const [isChatConnected, setIsChatConnected] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{userId: string, sessionId: string} | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // TanStack Query Hooks
  const { data: eventData } = useEvent(id || '');
  const activeEventName = eventData?.name || "Loading...";

  const { data: historyData } = useChatHistory(sessionInfo?.sessionId || '');
  const { data: mediaData } = useEventMedia(id || '', sessionInfo?.sessionId || '');
  const createEventMutation = useCreateEvent();

  useEffect(() => {
    // Reset state when navigating to a different event
    setMessages([]);
    setContentCards([]);
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
    
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Use a deterministic session ID right now for MVP or fetch actual user session
        // For hackathon: we can use a fixed session per user-event pair
        const generatedSessionId = `sess_${user.uid}_${id}`.replace(/[^a-zA-Z0-9_]/g, '');
        setSessionInfo({ userId: user.uid, sessionId: generatedSessionId });
        setAuthReady(true);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [id, navigate]);

  // 2. Fetch Initial History & Media (handled by React Query)
  useEffect(() => {
    if (historyData?.messages && messages.length === 0) {
      const historyMsgs = historyData.messages.map((m: any) => ({
        role: m.role,
        text: m.text,
        mediaRefs: m.media_refs || [],
        timestamp: new Date(m.timestamp ? m.timestamp + 'Z' : Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      })).reverse(); // Inverted descending order
      setMessages(historyMsgs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData]);

  useEffect(() => {
    if (mediaData?.media_assets && contentCards.length === 0) {
      setContentCards(mediaData.media_assets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaData]);

  // 3. WebSocket Connection
  useEffect(() => {
    if (!authReady || !sessionInfo || !id) return;

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connectWs = async () => {
      try {
        const auth = getAuth();
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const wsUrl = `${import.meta.env.VITE_API_URL?.replace('http', 'ws')}/chat/ws/${id}/${sessionInfo.userId}/${sessionInfo.sessionId}?token=${token}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsChatConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WsAgentMessage;
            if (data.type === 'message') {
              const newMsg = {
                role: 'assistant' as const,
                text: data.text,
                mediaRefs: data.media_refs || [],
                timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
              };
              
              setMessages(prev => [newMsg, ...prev]);

              // Optimistically append new media assets to the content area
              if (data.media_refs && data.media_refs.length > 0) {
                const newCards = data.media_refs.map(ref => ({
                  id: ref.asset_id,
                  title: `Generated ${ref.asset_type === 'image' ? 'Image' : 'Video'}`,
                  asset_type: ref.asset_type,
                  content_category: ref.asset_type === 'video' ? 'video' : 'poster',
                  public_url: ref.url,
                  thumbnail_url: ref.thumbnail_url,
                  created_at: new Date().toISOString()
                }));
                // Filter out any IDs we already have (in case the HTTP GET caught them)
                setContentCards(prev => {
                  const existingIds = prev.map(p => p.id);
                  const uniqueNew = newCards.filter(c => !existingIds.includes(c.id));
                  return [...uniqueNew, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse WS msg", event.data);
          }
        };

        ws.onclose = () => {
          setIsChatConnected(false);
          // Auto-reconnect
          reconnectTimeout = setTimeout(connectWs, 3000);
        };
      } catch (err) {
        console.error("WS connect failed", err);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onmessage = null;
        ws.onclose = null;
        ws.close();
      }
    };
  }, [authReady, sessionInfo, id]);

  // Handle chat submission
  const handleChatSubmit = (text: string) => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    const userMsg = {
      role: 'user' as const,
      text: text,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    setMessages(prev => [userMsg, ...prev]); // Prepend
    
    wsRef.current.send(JSON.stringify({ text }));
  };

  // Scroll chat to bottom/top on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          <div className="flex flex-col-reverse overflow-y-auto space-y-6 space-y-reverse pb-20 pt-4 px-2">
            {!isChatConnected && messages.length === 0 && (
              <div className="text-sm text-center text-muted-foreground animate-pulse">
                Connecting to Evento Agent...
              </div>
            )}
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={idx}
                role={msg.role}
                text={msg.text}
                mediaRefs={msg.mediaRefs}
                timestamp={msg.timestamp}
                onMediaClick={handleMediaClick}
              />
            ))}
            <div ref={chatBottomRef} />
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

