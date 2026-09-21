import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStatus, fetchPlaylist, sendCommand, sendVlmCommand } from '../api'
import type { VlcPlaylistNode } from '../api'
import { Button } from './ui/button'
import { Slider } from './ui/slider'

// Helper to find absolute URI of the current item by iterating over the playlist tree
function findUriInPlaylist(node: VlcPlaylistNode, targetId: string): string | null {
  if (node.id === targetId && node.uri) {
    return node.uri
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findUriInPlaylist(child, targetId)
      if (found) return found
    }
  }
  return null
}

export function ControlBar({ 
  isVideoMode, 
  onToggleVideo,
  onToggleInfo,
  onToggleFullscreen,
  localVlmPercent,
  setLocalVlmPercent,
  displayArtwork,
  externalMeta
}: { 
  isVideoMode?: boolean, 
  onToggleVideo?: () => void,
  onToggleInfo?: () => void,
  onToggleFullscreen?: () => void,
  localVlmPercent: number,
  setLocalVlmPercent: React.Dispatch<React.SetStateAction<number>>,
  displayArtwork?: string | null,
  externalMeta?: any
}) {
  const queryClient = useQueryClient()
  
  const { data: status } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
  })

  const { data: playlist } = useQuery({
    queryKey: ['playlist-full'],
    queryFn: fetchPlaylist,
  })

  // Local state for VLM since VLC doesn't expose it through status.json
  const [isVlmPlaying, setIsVlmPlaying] = useState(true)

  // Decouple dragging from API polling
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [localProgressPercent, setLocalProgressPercent] = useState(0)
  
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)
  const [localVolumePercent, setLocalVolumePercent] = useState(0)

  // Synthetic progress for VLM since status.time freezes when the main playlist pauses
  useEffect(() => {
    if (isVideoMode && isVlmPlaying && status && status.length > 0) {
      const interval = setInterval(() => {
        setLocalVlmPercent(p => Math.min(100, p + (100 / status.length)))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isVideoMode, isVlmPlaying, status?.length])

  useEffect(() => {
    if (isVideoMode && status && status.length > 0) {
      setLocalVlmPercent((status.time / status.length) * 100)
    }
  }, [isVideoMode])

  const mutation = useMutation({
    mutationFn: (command: string) => sendCommand(command),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })

  // Volume mutation separate because it takes a param
  const volumeMutation = useMutation({
    mutationFn: (val: number) => sendCommand('volume', val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })

  // Seek mutation separate because it takes a param (mirrors volumeMutation above).
  // Passing command + val separately avoids sendCommand double-encoding "seek&val=X"
  // into a single opaque `command` value, which is what broke the progress slider.
  const seekMutation = useMutation({
    mutationFn: (val: number) => sendCommand('seek', val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })
  

  if (!status) return <div className="h-24 shrink-0 border-t bg-card" /> // Skeleton

  const isPlaying = status.state === 'playing'
  const progressPercent = status.length > 0 ? (status.time / status.length) * 100 : 0
  
  // Convert seconds to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const meta = status.information?.category?.meta || {}
  const title = externalMeta?.title || meta.title || meta.filename || "No Media Playing"
  const artist = externalMeta?.artist || meta.artist || ""

  const skipAmount = parseInt(localStorage.getItem('vlc-skip-amount') || '15', 10)

  const skip = (seconds: number) => {
    if (isVideoMode) {
      if (status.length > 0) {
        const currentSec = (localVlmPercent / 100) * status.length
        const newSec = Math.max(0, Math.min(status.length, currentSec + seconds))
        const targetPercent = (newSec / status.length) * 100
        sendVlmCommand(`control Current seek ${targetPercent}`)
        setLocalVlmPercent(targetPercent)
      }
    } else {
      if (status.length > 0) {
        const newSec = Math.max(0, Math.min(status.length, status.time + seconds))
        seekMutation.mutate(newSec)
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t bg-card px-3 py-2 sm:h-24 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6 sm:py-0">
      {/* Current Media Info */}
      <div className="flex w-full items-center gap-3 overflow-hidden sm:w-1/3 sm:gap-4">
        {displayArtwork ? (
          <img src={displayArtwork} alt="Album Art" className="h-10 w-10 sm:h-14 sm:w-14 rounded object-cover shadow-sm bg-muted shrink-0" />
        ) : (
          <div className="flex h-10 w-10 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded bg-muted">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music text-muted-foreground"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
        )}
        <div className="flex flex-col truncate pr-4">
          <div className="truncate font-semibold">{title}</div>
          <div className="truncate text-sm text-muted-foreground">{artist}</div>
          
          {!isVideoMode && isPlaying && (
            <div className="mt-1">
              <button 
                onClick={async () => {
                  let fileUri = meta.filename // In VLC metadata this usually holds the MRL/URL or standard filename
                  // On some desktop versions, we need to explicitly search the playlist for the absolute URI (MRL) 
                  // because the filename may just be a display name
                  if (playlist && status.currentplid !== undefined) {
                    const resolvedUri = findUriInPlaylist(playlist, status.currentplid.toString())
                    if (resolvedUri) fileUri = resolvedUri
                  }

                  if (fileUri) {
                    try {
                      try { await sendVlmCommand('del Current') } catch (e) { /* Ignore if it doesn't exist */ }
                      const vlmSetup = `new Current broadcast enabled input "${fileUri}" output #transcode{vcodec=VP80,vb=2048,fps=25,scale=1,acodec=vorb,ab=128,channels=2,samplerate=44100}:std{access=http,mux=webm,dst=0.0.0.0:8081/stream.webm}`
                      await sendVlmCommand(vlmSetup)
                      
                      // Fix 5: Disable subtitles to prevent codec popups (start-time broke VP8 keyframes natively, using delayed seek instead)
                      await sendVlmCommand(`setup Current option no-sout-spu`)
                      
                      await sendVlmCommand('control Current play')
                      
                      // Fix 1: Pause the main native application's playlist so audio doesn't double stack locally
                      if (status.state === 'playing') {
                        await sendCommand('pl_pause')
                      }

                      // Fix 2: Sync playback manually by seeking *after* transcoding has initialized to prevent I-frame drops
                      if (status.length > 0 && status.time > 0) {
                        const targetPercent = (status.time / status.length) * 100
                        setTimeout(() => {
                           sendVlmCommand(`control Current seek ${targetPercent}`).catch(() => {})
                        }, 2500)
                      }
                      
                      setIsVlmPlaying(true)
                      onToggleVideo?.()
                    } catch (err: any) {
                      // Need to alert the user of what VLC refused
                      alert(`VLM Transcoder Error: ${err.message}`)
                    }
                  }
                }}
                className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors w-fit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-video"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
                Switch to video
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex w-full flex-col items-center gap-2 sm:w-1/3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => mutation.mutate('pl_previous')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-back"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => skip(-skipAmount)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rewind"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>
          </Button>
          <Button 
            variant="default" 
            size="icon" 
            className="h-10 w-10 rounded-full"
            onClick={() => {
              if (isVideoMode) {
                if (isVlmPlaying) {
                  sendVlmCommand('control Current pause')
                  setIsVlmPlaying(false)
                } else {
                  sendVlmCommand('control Current play')
                  setIsVlmPlaying(true)
                }
              } else {
                mutation.mutate('pl_pause')
              }
            }}
          >
            {(isVideoMode ? isVlmPlaying : isPlaying) ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pause"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => skip(skipAmount)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-fast-forward"><polygon points="13 19 22 12 13 5 13 19"/><polygon points="2 19 11 12 2 5 2 19"/></svg>
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => mutation.mutate('pl_next')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
          </Button>
        </div>
        
        <div className="flex w-full items-center gap-2 text-xs text-muted-foreground font-medium">
          <div className="w-10 text-right">{isVideoMode ? "Live" : formatTime(status.time)}</div>
          <Slider 
            value={[isVideoMode ? localVlmPercent : (isDraggingProgress ? localProgressPercent : progressPercent)]} 
            max={100} 
            step={1}
            onPointerDown={(e) => {
              // React 18 / Radix pointer events can bubble/interfere, stop propagation
              e.stopPropagation()
            }}
            onValueChange={(vals) => {
              setIsDraggingProgress(true)
              if (isVideoMode) {
                 setLocalVlmPercent(vals[0])
              } else {
                 setLocalProgressPercent(vals[0])
              }
            }}
            onValueCommit={(vals) => {
              setIsDraggingProgress(false)
              const targetPercent = vals[0]
              if (isVideoMode) {
                // Seek VLM Stream
                sendVlmCommand(`control Current seek ${targetPercent}`)
                setLocalVlmPercent(targetPercent)
              } else if (status.length > 0) {
                // Seek Main Playlist
                const seconds = Math.floor((targetPercent / 100) * status.length)
                seekMutation.mutate(seconds)
              }
            }}
            className="w-full max-w-[400px]" 
          />
          <div className="w-10">{formatTime(status.length || 0)}</div>
        </div>
      </div>

      {/* Volume / Extra Controls */}
      <div className="flex w-full items-center justify-center gap-3 sm:w-1/3 sm:justify-end">
        {isVideoMode && (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground mr-1" onClick={onToggleFullscreen} aria-label="Fullscreen">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-maximize"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground sm:mr-2" onClick={onToggleInfo} aria-label="Media Info">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </Button>
        {/* Volume control: kept visible on mobile too — it controls VLC's volume on the
            remote computer, not the phone's own volume, so the phone's hardware buttons
            don't apply here. */}
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-2 text-muted-foreground"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          <Slider 
            value={[isDraggingVolume ? localVolumePercent : status.volume / 2.56]} // Convert 0-256 (VLC max native volume) to 0-100%
            max={100} 
            step={1} 
            className="w-24" 
            onPointerDown={(e) => e.stopPropagation()}
            onValueChange={(vals) => {
               setIsDraggingVolume(true)
               setLocalVolumePercent(vals[0])
            }}
            onValueCommit={(vals) => {
               setIsDraggingVolume(false)
               // Let's scale standard volume 0-100% to 0-256. 256 is 100%, 512 is 200%.
               const vlcVolume = Math.round(vals[0] * 2.56)
               volumeMutation.mutate(vlcVolume)
            }}
          />
        </div>
      </div>
    </div>
  )
}
