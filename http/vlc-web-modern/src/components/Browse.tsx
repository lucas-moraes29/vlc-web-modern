import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStatus, fetchPlaylist, browseDirectory, playMediaUri } from '../api'
import type { VlcPlaylistNode, VlcBrowseEntry } from '../api'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'

// Finds the file:// uri of the playlist leaf whose id matches the currently playing item.
function findCurrentItemUri(node: VlcPlaylistNode, currentId: number | string): string | undefined {
  if (node.type === 'leaf' && String(node.id) === String(currentId)) return node.uri
  if (node.children) {
    for (const child of node.children) {
      const found = findCurrentItemUri(child, currentId)
      if (found) return found
    }
  }
  return undefined
}

// Finds the file:// uri of the first leaf in the playlist tree, regardless of playback
// state. Used to default Browse to the same folder the Playlist tab is already showing.
function findFirstItemUri(node: VlcPlaylistNode): string | undefined {
  if (node.type === 'leaf') return node.uri
  if (node.children) {
    for (const child of node.children) {
      const found = findFirstItemUri(child)
      if (found) return found
    }
  }
  return undefined
}

// Strips the last path segment off a file:// uri, returning its parent directory.
// Returns undefined once we're already at the filesystem root (can't go up further).
function getParentUri(uri: string): string | undefined {
  const trimmed = uri.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  if (idx < 'file://'.length) return undefined
  return trimmed.slice(0, idx + 1)
}

function displayPath(uri?: string): string {
  if (!uri) return 'Locais rápidos'
  try {
    return decodeURIComponent(uri.replace(/^file:\/\//, '')) || '/'
  } catch {
    return uri
  }
}

export function Browse() {
  const queryClient = useQueryClient()
  const [streamUrl, setStreamUrl] = useState('')
  const [currentUri, setCurrentUri] = useState<string | undefined>(undefined)
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false)

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ['browse', currentUri],
    queryFn: () => browseDirectory(currentUri),
  })

  // Reuse the same cached queries Library/Layout already use, so we don't fire extra
  // requests to figure out which folder is currently loaded in VLC.
  const { data: status } = useQuery({ queryKey: ['status'], queryFn: fetchStatus })
  const { data: playlist } = useQuery({ queryKey: ['playlist'], queryFn: fetchPlaylist })

  const nowPlayingFolderUri = (() => {
    if (!playlist || status?.currentplid === undefined) return undefined
    const uri = findCurrentItemUri(playlist, status.currentplid)
    return uri ? getParentUri(uri) : undefined
  })()

  const playlistFolderUri = (() => {
    if (!playlist) return undefined
    const uri = findFirstItemUri(playlist)
    return uri ? getParentUri(uri) : undefined
  })()

  // On first load, jump straight to the same folder the Playlist tab is already showing
  // (the folder VLC has open), instead of starting on VLC's generic quick-access list.
  // Runs only once - later manual navigation (including back to the quick-access list) is
  // never overridden by this.
  useEffect(() => {
    if (!hasAutoNavigated && playlistFolderUri) {
      setCurrentUri(playlistFolderUri)
      setHasAutoNavigated(true)
    }
  }, [hasAutoNavigated, playlistFolderUri])

  const playMutation = useMutation({
    mutationFn: (uri: string) => playMediaUri(uri),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
      queryClient.invalidateQueries({ queryKey: ['playlist'] })
    },
  })

  const sortedEntries = (entries ?? []).slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">Browse Media</h2>
          <p className="text-sm text-muted-foreground truncate">{displayPath(currentUri)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {nowPlayingFolderUri && nowPlayingFolderUri !== currentUri && (
            <Button variant="outline" size="sm" onClick={() => setCurrentUri(nowPlayingFolderUri)}>
              Pasta tocando agora
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center text-muted-foreground mt-10">Carregando…</div>
          ) : error ? (
            <div className="text-center text-destructive mt-10">Não foi possível listar essa pasta. Confira se o caminho ainda existe.</div>
          ) : sortedEntries.length === 0 ? (
            <div className="text-center text-muted-foreground mt-10">Pasta vazia.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {sortedEntries.map((entry: VlcBrowseEntry) => (
                <div
                  key={entry.uri}
                  onClick={() => entry.type === 'dir' ? setCurrentUri(entry.uri) : playMutation.mutate(entry.uri)}
                  className="group flex items-center gap-3 rounded-md p-3 hover:bg-muted/50 cursor-pointer transition-colors overflow-hidden"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-secondary-foreground">
                    {entry.type === 'dir' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-folder"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                    )}
                  </div>
                  <div className="truncate font-medium">{entry.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Advanced: manual entry, kept as a fallback for network streams (RTSP/HTTP/etc.) */}
      <div className="border-t p-6">
        <div className="space-y-2 max-w-2xl">
          <h3 className="font-medium text-sm">Abrir stream de rede / URI manual</h3>
          <p className="text-xs text-muted-foreground">
            Use isso para URLs de rede (HTTP, RTSP, RTMP) que não aparecem navegando pelas pastas acima.
          </p>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="https://... or file:///..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && streamUrl.trim()) {
                  playMutation.mutate(streamUrl.trim())
                  setStreamUrl('')
                }
              }}
            />
            <Button
              onClick={() => {
                playMutation.mutate(streamUrl.trim())
                setStreamUrl('')
              }}
              disabled={!streamUrl.trim() || playMutation.isPending}
            >
              Play URL
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
