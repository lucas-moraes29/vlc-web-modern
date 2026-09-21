import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

export function MediaInfo({ 
  externalMeta, 
  rawFilename, 
  onRefetch, 
  onClose 
}: { 
  externalMeta: any, 
  rawFilename?: string, 
  onRefetch?: () => void, 
  onClose: () => void 
}) {
  const isLoading = !externalMeta; // Simplified loading state
  
  const [fixOpen, setFixOpen] = useState(false)
  const [fixTitle, setFixTitle] = useState("")
  const [fixYear, setFixYear] = useState("")
  const [fixSeason, setFixSeason] = useState("")
  const [fixEpisode, setFixEpisode] = useState("")
  const [fixType, setFixType] = useState<'movie'|'tv'>('movie')
  const [fixProvider, setFixProvider] = useState<'auto' | 'itunes' | 'tvmaze' | 'thetvdb' | 'tmdb'>('auto')

  useEffect(() => {
    if (!rawFilename) return
    const stored = localStorage.getItem(`vlc-meta-override-${rawFilename}`)
    if (stored) {
      try {
        const p = JSON.parse(stored)
        setFixTitle(p.title || "")
        setFixYear(p.year || "")
        setFixSeason(p.season || "")
        setFixEpisode(p.episode || "")
        setFixType(p.type || 'movie')
        setFixProvider(p.provider || 'auto')
        return
      } catch(e) {}
    }
    
    // Auto-infer from filename if no override exists
    const tvMatch = rawFilename.match(/^(.*?)[-_\s]*[sS](\d{1,2})[eE](\d{1,2})/i)
    if (tvMatch) {
       setFixType('tv')
       setFixTitle(tvMatch[1].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim())
       setFixSeason(parseInt(tvMatch[2], 10).toString())
       setFixEpisode(parseInt(tvMatch[3], 10).toString())
       setFixYear("")
    } else {
       const movieMatch = rawFilename.match(/^(.*?)[-_\s]*\((\d{4})\)/)
       if (movieMatch) {
         setFixType('movie')
         setFixTitle(movieMatch[1].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim())
         setFixYear(movieMatch[2])
       } else {
         setFixType('movie')
         let clean = rawFilename.replace(/\.[^/.]+$/, "").replace(/1080p|720p|4k|x264|x265|Bluray|HDTV|SDTV|AAC|WEBRip|HDRip|H\.264|H\.265/gi, "").replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
         setFixTitle(clean)
       }
    }
  }, [rawFilename, fixOpen])

  const handleSaveFix = () => {
    if (!rawFilename) return
    localStorage.setItem(`vlc-meta-override-${rawFilename}`, JSON.stringify({
      title: fixTitle,
      year: fixYear,
      season: fixSeason,
      episode: fixEpisode,
      type: fixType,
      provider: fixProvider
    }))
    setFixOpen(false)
    if (onRefetch) onRefetch()
  }

  return (
    <div className="absolute right-0 top-0 h-full w-full sm:w-80 bg-card/90 backdrop-blur-xl border-l z-50 p-6 flex flex-col pt-16 shadow-2xl animate-in fade-in slide-in-from-right-8 fade-out slide-out-to-right-8 duration-300">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 bg-muted hover:bg-muted/80 text-foreground p-2 rounded-full transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <h2 className="text-xl font-bold mb-6">Media Info</h2>

      {isLoading ? (
        <div className="flex animate-pulse flex-col space-y-4">
          <div className="h-48 w-full bg-muted rounded-xl" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
        </div>
      ) : externalMeta ? (
        <div className="flex flex-col gap-4 overflow-y-auto pb-6">
          {externalMeta.artwork && (
            <img 
              src={externalMeta.artwork} 
              alt="Artwork" 
              className="w-full aspect-square object-cover rounded-xl shadow-lg border border-white/10"
            />
          )}
          
          <div>
            <h3 className="text-2xl font-bold leading-tight">{externalMeta.title}</h3>
            {externalMeta.artist && <p className="text-lg text-muted-foreground">{externalMeta.artist}</p>}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {externalMeta.genre && <span className="px-2 py-1 bg-primary/20 text-primary rounded-full">{externalMeta.genre}</span>}
            {externalMeta.releaseDate && <span className="px-2 py-1 bg-muted rounded-full">{new Date(externalMeta.releaseDate).getFullYear()}</span>}
          </div>

          {externalMeta.description && (
            <p className="text-sm text-foreground/80 leading-relaxed mt-4">
              {externalMeta.description}
            </p>
          )}
        </div>
      ) : (
        <div className="text-muted-foreground text-center mt-12 flex flex-col items-center">
           <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-ghost mb-4 opacity-50"><path d="M9 10h.01"/><path d="M14 10h.01"/><path d="M10 16c1.1.2 2.9.2 4 0"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>
           <p>No external metadata found for this media.</p>
        </div>
      )}

      {/* Fix Match Dialog - Anchored to bottom of sidebar */}
      {rawFilename && (
        <Dialog.Root open={fixOpen} onOpenChange={setFixOpen}>
          <Dialog.Trigger asChild>
            <button className="mt-auto w-full py-3 text-sm font-medium border-t hover:bg-muted transition-colors flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
              Fix Match
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
            <Dialog.Content className="fixed top-[50%] left-[50%] z-50 overflow-hidden transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md bg-card p-6 shadow-2xl rounded-xl border">
              <Dialog.Title className="text-lg font-semibold tracking-tight">Fix Metadata Match</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mt-1.5 mb-6">
                Manually override the metadata search query for <span className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">{rawFilename}</span>
              </Dialog.Description>
              
              <div className="flex flex-col gap-4">
                 <div>
                   <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Title (Required)</label>
                   <input 
                     type="text" 
                     value={fixTitle}
                     onChange={(e) => setFixTitle(e.target.value)}
                     className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                     placeholder="e.g. Star Wars" 
                   />
                 </div>
                 <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Year (Optional)</label>
                     <input 
                       type="text" 
                       value={fixYear}
                       onChange={(e) => setFixYear(e.target.value)}
                       className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                       placeholder="e.g. 1977" 
                     />
                   </div>
                   <div className="flex-1">
                     <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Type</label>
                     <select 
                       value={fixType}
                       onChange={(e) => setFixType(e.target.value as 'movie'|'tv')}
                       className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                     >
                        <option value="movie">Movie</option>
                        <option value="tv">TV Show</option>
                     </select>
                   </div>
                 </div>

                 {fixType === 'tv' && (
                   <div className="flex gap-4 animate-in slide-in-from-top-2 fade-in">
                     <div className="flex-1">
                       <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Season</label>
                       <input 
                         type="text" 
                         value={fixSeason}
                         onChange={(e) => setFixSeason(e.target.value)}
                         className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                         placeholder="e.g. 2" 
                       />
                     </div>
                     <div className="flex-1">
                       <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Episode</label>
                       <input 
                         type="text" 
                         value={fixEpisode}
                         onChange={(e) => setFixEpisode(e.target.value)}
                         className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                         placeholder="e.g. 1" 
                       />
                     </div>
                   </div>
                 )}

                 <div>
                   <label className="text-xs font-semibold uppercase text-muted-foreground mb-1 block">Metadata Provider Override</label>
                   <select 
                     value={fixProvider}
                     onChange={(e) => setFixProvider(e.target.value as any)}
                     className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                   >
                      <option value="auto">Auto (Use Default Settings)</option>
                      <option value="itunes">iTunes Search API</option>
                      <option value="tmdb">The Movie Database (TMDB)</option>
                      <option value="thetvdb">TheTVDB</option>
                      <option value="tvmaze">TVMaze</option>
                   </select>
                 </div>
              </div>
              
              <div className="mt-8 flex justify-end gap-3">
                <Dialog.Close asChild>
                  <button className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-md text-sm font-medium transition-colors">Cancel</button>
                </Dialog.Close>
                <button 
                  onClick={handleSaveFix}
                  disabled={!fixTitle}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Save & Refetch
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
