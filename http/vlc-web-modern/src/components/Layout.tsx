import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../lib/utils'
import { Library } from './Library'
import { ControlBar } from './ControlBar'
import { Browse } from './Browse'
import { Settings } from './Settings'
import { NowPlaying } from './NowPlaying'
import { ThemeToggle } from './ThemeToggle'
import { MediaInfo } from './MediaInfo'
import { useMetadata } from '../hooks/useMetadata'
import { fetchStatus, sendCommand, sendVlmCommand } from '../api'

export function Layout() {
  const [activeTab, setActiveTab] = useState<'now-playing' | 'playlist' | 'browse' | 'settings'>('now-playing')
  const [isVideoMode, setIsVideoMode] = useState(false)
  const [showMediaInfo, setShowMediaInfo] = useState(false)
  const [localVlmPercent, setLocalVlmPercent] = useState(0)
  const [isIdle, setIsIdle] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isVideoMode) {
      setIsIdle(false)
      return
    }
    let timeout: ReturnType<typeof setTimeout>
    const handleMouseMove = () => {
      setIsIdle(false)
      clearTimeout(timeout)
      timeout = setTimeout(() => setIsIdle(true), 3000)
    }
    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove() // init
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(timeout)
    }
  }, [isVideoMode])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoContainerRef.current?.requestFullscreen().catch(err => console.error(err))
    } else {
      document.exitFullscreen()
    }
  }

  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
  })
  
  const meta: any = status?.information?.category?.meta || {}
  const mediaName = meta.title || meta.filename
  const artworkUrl = meta.artwork_url ? (meta.artwork_url.startsWith('file://') ? `/art?${new Date().getTime()}` : meta.artwork_url) : null

  const { data: externalMeta, refetch: refetchMetadata } = useMetadata(mediaName, meta.filename)
  const displayArtwork = externalMeta?.artwork || artworkUrl

  // Fix 1: Bind video output volume to VLC's master volume cleanly
  useEffect(() => {
    if (videoRef.current && status) {
      videoRef.current.volume = status.volume / 256
    }
  }, [status?.volume])

  return (
    <div 
      className={cn(
        "flex h-screen w-full flex-col bg-background text-foreground overflow-hidden transition-all duration-500",
        isVideoMode && isIdle && isFullscreen ? "cursor-none" : ""
      )}
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-3 sm:px-6 relative z-10">
        <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
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
              className="lucide lucide-play"
            >
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
          <span>VLC Web Modern</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile Tab Bar - horizontal, replaces the sidebar below the md breakpoint */}
      <nav className="flex md:hidden items-center gap-1 overflow-x-auto border-b bg-muted/30 px-2 py-2 shrink-0">
        <NavItem label="Now Playing" active={activeTab === 'now-playing'} onClick={() => setActiveTab('now-playing')} />
        <NavItem label="Playlist" active={activeTab === 'playlist'} onClick={() => setActiveTab('playlist')} />
        <NavItem label="Browse Media" active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} />
        <NavItem label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="hidden md:flex w-64 shrink-0 border-r bg-muted/30 flex-col justify-between">
          {/* Navigation */}
          <nav className="flex flex-col gap-1 p-4 relative z-20">
            <NavItem label="Now Playing" active={activeTab === 'now-playing'} onClick={() => setActiveTab('now-playing')} />
            <NavItem label="Playlist" active={activeTab === 'playlist'} onClick={() => setActiveTab('playlist')} />
            <NavItem label="Browse Media" active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} />
            <NavItem label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </nav>
          
          <div className="p-4 text-xs text-muted-foreground/60 font-medium">
            v1.2.0
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden bg-card/30 relative">
          
          {/* Global Ambient Background Art */}
          {!isVideoMode && artworkUrl && (
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen transition-opacity duration-1000">
              <img src={artworkUrl} className="w-full h-full object-cover blur-[64px] saturate-150" alt="" />
            </div>
          )}

          <div className="relative z-10 w-full h-full flex flex-col">
            {isVideoMode && (
              <div ref={videoContainerRef} className="absolute inset-0 bg-black z-10 flex flex-col justify-center">
                 <div className={cn(
                    "p-4 flex justify-between items-center absolute w-full top-0 bg-gradient-to-b from-black/80 to-transparent z-50 transition-all duration-500",
                    isIdle && isFullscreen ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
                 )}>
                   <button 
                    onClick={() => {
                      if (document.fullscreenElement) document.exitFullscreen()
                      setIsVideoMode(false)
                      sendVlmCommand('del Current').catch(() => {})
                      
                      // Fix 2: Sync playback time when returning to audio mode from video mode
                      if (status && status.length > 0) {
                        const targetSeconds = Math.floor((localVlmPercent / 100) * status.length)
                        sendCommand('seek', targetSeconds).catch(() => {})
                      }
                      
                      sendCommand('pl_play').catch(() => {})
                    }}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-md transition-colors font-medium text-sm"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                     Switch to audio
                   </button>
                 </div>
                 {/* 
                    Using a direct VLC streaming endpoint from VLM on port 8081.
                    The backend transcodes the currently playing context into a WebM stream.
                 */}
                 <video 
                    ref={videoRef}
                    src={`http://${window.location.hostname}:8081/stream.webm`} 
                    autoPlay 
                    controls={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full object-contain"
                 />
                 
                 {/* Fullscreen Player specific control bar overlay */}
                 {isFullscreen && (
                    <div className={cn(
                      "absolute bottom-0 w-full transition-transform duration-500 z-50",
                      isIdle ? "translate-y-full" : "translate-y-0"
                    )}>
                      <ControlBar 
                        isVideoMode={isVideoMode} 
                        onToggleVideo={() => setIsVideoMode(true)}
                        onToggleInfo={() => setShowMediaInfo(!showMediaInfo)}
                        localVlmPercent={localVlmPercent}
                        setLocalVlmPercent={setLocalVlmPercent}
                        onToggleFullscreen={toggleFullscreen}
                        externalMeta={externalMeta}
                      />
                    </div>
                 )}
              </div>
            )}
            
            <div className={`relative z-20 w-full h-full flex-1 overflow-hidden pointer-events-none ${isVideoMode ? (activeTab === 'now-playing' ? 'hidden' : 'bg-background/80 backdrop-blur-3xl') : ''}`}>
               <div className="pointer-events-auto h-full w-full">
                 {activeTab === 'now-playing' && !isVideoMode ? <NowPlaying 
                   meta={meta}
                   externalMeta={externalMeta}
                   albumArt={displayArtwork}
                 /> : null}
                 {activeTab === 'playlist' ? <Library /> : null}
                 {activeTab === 'browse' ? <Browse /> : null}
                 {activeTab === 'settings' ? <Settings /> : null}
               </div>
            </div>

            {/* Media Info Overlay Sidebar */}
            {showMediaInfo && mediaName && (
              <div className="pointer-events-auto h-full">
                 <MediaInfo 
                   externalMeta={externalMeta} 
                   rawFilename={meta.filename}
                   onRefetch={refetchMetadata}
                   onClose={() => setShowMediaInfo(false)} 
                 />
              </div>
            )}
            
          </div>
        </div>
      </div>
      {/* Bottom Control Bar globally, hidden visually if in fullscreen and idle */}
      <div className={cn(
        "relative transition-transform duration-500 z-50",
        isFullscreen ? "hidden" : "w-full"
      )}>
        <ControlBar 
          isVideoMode={isVideoMode} 
          onToggleVideo={() => setIsVideoMode(true)}
          onToggleInfo={() => setShowMediaInfo(!showMediaInfo)}
          localVlmPercent={localVlmPercent}
          setLocalVlmPercent={setLocalVlmPercent}
          onToggleFullscreen={toggleFullscreen}
          displayArtwork={displayArtwork}
          externalMeta={externalMeta}
        />
      </div>
    </div>
  )
}

function NavItem({ label, active = false, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  // Placeholder for icons untill we map them
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors shrink-0 whitespace-nowrap",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
