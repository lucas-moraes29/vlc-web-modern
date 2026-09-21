export function NowPlaying({ meta, externalMeta, albumArt }: { meta: any, externalMeta?: any, albumArt?: string | null }) {
  if (!meta) return null

  // Prefer the enriched title/artist from TheTVDB/TMDB/iTunes (externalMeta) when available,
  // falling back to VLC's own raw file metadata.
  const title = externalMeta?.title || meta.title || meta.filename || "No Media Playing"
  const artist = externalMeta?.artist || meta.artist || ""

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 sm:p-8 text-center relative z-10">
      {albumArt ? (
        <img 
          src={albumArt} 
          alt="Album Art" 
          className="w-full max-w-xs sm:max-w-md aspect-square object-cover rounded-xl shadow-2xl mb-6 sm:mb-8 border border-white/10"
        />
      ) : (
        <div className="w-full max-w-xs sm:max-w-md aspect-square rounded-xl bg-muted/50 flex flex-col items-center justify-center mb-6 sm:mb-8 shadow-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music text-muted-foreground mb-4"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        </div>
      )}
      <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground mb-2 drop-shadow-md">{title}</h1>
      <p className="text-base sm:text-xl text-muted-foreground font-medium drop-shadow-sm">{artist}</p>
    </div>
  )
}
