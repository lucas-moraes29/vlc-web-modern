import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStatus, sendCommand } from '../api'

export function Settings() {
  const [skipAmount, setSkipAmount] = useState('15')
  const [enableMetadata, setEnableMetadata] = useState(false)
  const [movieSource, setMovieSource] = useState<'itunes' | 'tvmaze' | 'thetvdb' | 'tmdb'>('itunes')
  const [tvSource, setTvSource] = useState<'itunes' | 'tvmaze' | 'thetvdb' | 'tmdb'>('itunes')
  const [tmdbToken, setTmdbToken] = useState('')
  const [tvdbKey, setTvdbKey] = useState('')
  const queryClient = useQueryClient()

  // Read VLC's own fullscreen state from the status it already exposes, instead of
  // tracking the browser page's fullscreen state (which is a different thing entirely).
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: fetchStatus })
  const isFullscreen = !!status?.fullscreen

  const fullscreenMutation = useMutation({
    mutationFn: () => sendCommand('fullscreen'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })

  useEffect(() => {
    setSkipAmount(localStorage.getItem('vlc-skip-amount') || '15')
    setEnableMetadata(localStorage.getItem('vlc-enable-metadata') === 'true')
    setMovieSource((localStorage.getItem('vlc-movie-metadata-source') as any) || 'itunes')
    setTvSource((localStorage.getItem('vlc-tv-metadata-source') as any) || 'itunes')
    setTmdbToken(localStorage.getItem('vlc-tmdb-token') || '')
    setTvdbKey(localStorage.getItem('vlc-tvdb-key') || '')
  }, [])

  const handleSaveSkip = (val: string) => {
    setSkipAmount(val)
    localStorage.setItem('vlc-skip-amount', val)
  }

  const handleSaveMetadata = (val: boolean) => {
    setEnableMetadata(val)
    localStorage.setItem('vlc-enable-metadata', val ? 'true' : 'false')
  }

  const handleSaveMovieSource = (val: 'itunes' | 'tvmaze' | 'thetvdb' | 'tmdb') => {
    setMovieSource(val)
    localStorage.setItem('vlc-movie-metadata-source', val)
  }

  const handleSaveTvSource = (val: 'itunes' | 'tvmaze' | 'thetvdb' | 'tmdb') => {
    setTvSource(val)
    localStorage.setItem('vlc-tv-metadata-source', val)
  }

  const handleSaveTmdbToken = (val: string) => {
    setTmdbToken(val)
    localStorage.setItem('vlc-tmdb-token', val)
  }

  const handleSaveTvdbKey = (val: string) => {
    setTvdbKey(val)
    localStorage.setItem('vlc-tvdb-key', val)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto flex flex-col gap-8 h-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure your VLC Web parameters.</p>
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <label className="text-sm font-medium leading-none">Reprodução em Tela Cheia</label>
          <p className="text-sm text-muted-foreground">Coloca o próprio VLC (no computador) em tela cheia. Clique de novo pra sair.</p>
        </div>
        <button 
          onClick={() => fullscreenMutation.mutate()}
          disabled={fullscreenMutation.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 ${isFullscreen ? 'bg-primary' : 'bg-input'}`}
          role="switch"
          aria-checked={isFullscreen}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${isFullscreen ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-medium leading-none">Skip Ahead / Back Duration (seconds)</label>
        <select 
          value={skipAmount} 
          onChange={(e) => handleSaveSkip(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="5">5 seconds</option>
          <option value="10">10 seconds</option>
          <option value="15">15 seconds</option>
          <option value="30">30 seconds</option>
          <option value="60">60 seconds</option>
        </select>
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <label className="text-sm font-medium leading-none">Metadata Network Access</label>
          <p className="text-sm text-muted-foreground">Automatically fetch missing album/movie artwork and descriptions using the iTunes public API.</p>
        </div>
        <button 
          onClick={() => handleSaveMetadata(!enableMetadata)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${enableMetadata ? 'bg-primary' : 'bg-input'}`}
          role="switch"
          aria-checked={enableMetadata}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${enableMetadata ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

        <div className="flex gap-4 w-full">
           <div className="flex-1 flex flex-col gap-2">
             <label className="text-sm font-medium leading-none" style={{ opacity: enableMetadata ? 1 : 0.5 }}>Default Movie Provider</label>
             <select 
               value={movieSource} 
               disabled={!enableMetadata}
               onChange={(e) => handleSaveMovieSource(e.target.value as any)}
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
             >
               <option value="itunes">iTunes Search API (Default)</option>
               <option value="thetvdb">TheTVDB (Requires API Key)</option>
               <option value="tmdb">The Movie Database / TMDB (Requires Access Token)</option>
             </select>
           </div>
           
           <div className="flex-1 flex flex-col gap-2">
             <label className="text-sm font-medium leading-none" style={{ opacity: enableMetadata ? 1 : 0.5 }}>Default TV Show Provider</label>
             <select 
               value={tvSource} 
               disabled={!enableMetadata}
               onChange={(e) => handleSaveTvSource(e.target.value as any)}
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
             >
               <option value="itunes">iTunes Search API (Default)</option>
               <option value="tvmaze">TVMaze (Free, TV Shows Only)</option>
               <option value="thetvdb">TheTVDB (Requires API Key)</option>
               <option value="tmdb">The Movie Database / TMDB (Requires Access Token)</option>
             </select>
           </div>
        </div>

      {enableMetadata && (movieSource === 'thetvdb' || tvSource === 'thetvdb') && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
          <label className="text-sm font-medium leading-none">TheTVDB API Key</label>
          <input 
            type="password"
            value={tvdbKey}
            onChange={(e) => handleSaveTvdbKey(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Enter your TheTVDB API Key"
          />
          <p className="text-xs text-muted-foreground p-3 border rounded-md bg-muted/50">
            Metadata provided by <a href="https://thetvdb.com/" target="_blank" rel="noopener noreferrer" className="underline font-medium text-foreground hover:text-primary">TheTVDB</a>.
          </p>
        </div>
      )}

      {enableMetadata && (movieSource === 'tmdb' || tvSource === 'tmdb') && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
          <label className="text-sm font-medium leading-none">TMDB API Read Access Token</label>
          <input 
            type="password"
            value={tmdbToken}
            onChange={(e) => handleSaveTmdbToken(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Enter your TMDB API Read Access Token (v4)"
          />
          <p className="text-xs text-muted-foreground p-3 border rounded-md bg-muted/50">
            This product uses the <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="underline font-medium text-foreground hover:text-primary">TMDB API</a> but is not endorsed or certified by TMDB.
          </p>
        </div>
      )}
    </div>
  )
}
