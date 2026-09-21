import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPlaylist, playPlaylistItem } from '../api'
import type { VlcPlaylistNode } from '../api'
import { ScrollArea } from './ui/scroll-area'
import { useMetadata } from '../hooks/useMetadata'

export function Library() {
  const queryClient = useQueryClient()
  const { data: playlist, isLoading, error } = useQuery({
    queryKey: ['playlist'],
    queryFn: fetchPlaylist,
  })

  const playMutation = useMutation({
    mutationFn: (id: string) => playPlaylistItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
    },
  })

  const getPlaylistItems = (root: VlcPlaylistNode): VlcPlaylistNode[] => {
    // recursively flatten or find the main playlist node
    let items: VlcPlaylistNode[] = []
    function traverse(node: VlcPlaylistNode) {
      if (node.type === "leaf") {
        items.push(node)
      }
      if (node.children) {
        node.children.forEach(traverse)
      }
    }
    traverse(root)
    return items
  }

  const items = playlist ? getPlaylistItems(playlist) : []

  if (isLoading) {
    return <div className="flex h-full items-center justify-center p-8 text-muted-foreground">Loading playlist...</div>
  }

  if (error) {
    return <div className="flex h-full items-center justify-center p-8 text-destructive">Failed to load playlist. Ensure VLC is running.</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="text-2xl font-semibold">Playlist</h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4">
          {items.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">Playlist is empty.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {items.map((item) => (
                <LibraryItem 
                  key={item.id} 
                  item={item} 
                  onPlay={() => playMutation.mutate(item.id)} 
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function LibraryItem({ item, onPlay }: { item: VlcPlaylistNode, onPlay: () => void }) {
  // Same enrichment treatment as Now Playing: fetch external metadata (TheTVDB/TMDB/iTunes)
  // using the raw playlist entry name, and prefer its title/artwork when available.
  const { data: externalMeta } = useMetadata(item.name, item.name)
  const title = externalMeta?.title || item.name

  return (
    <div
      onClick={onPlay}
      className="group flex items-center justify-between rounded-md p-3 hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        {externalMeta?.artwork ? (
          <img 
            src={externalMeta.artwork} 
            alt="" 
            className="h-10 w-10 shrink-0 rounded object-cover bg-secondary" 
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-secondary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-music"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
        )}
        <div className="truncate">
          <div className="truncate font-medium">{title}</div>
        </div>
      </div>
    </div>
  )
}
