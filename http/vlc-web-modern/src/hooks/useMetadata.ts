import { useQuery } from '@tanstack/react-query'

export interface AppMetadata {
  title?: string
  artist?: string
  artwork?: string
  description?: string
  genre?: string
  releaseDate?: string
}

export function useMetadata(searchTerm: string, rawFilename?: string) {
  const isEnabled = localStorage.getItem('vlc-enable-metadata') === 'true'

  return useQuery({
    queryKey: ['itunes-metadata', searchTerm],
    queryFn: async (): Promise<AppMetadata | null> => {
      if (!searchTerm) return null
      
      // Clean up the search term (e.g., remove extensions, specific resolutions, years in parentheses)
      let cleanTerm = searchTerm
        .replace(/\.[^/.]+$/, "") // Remove generic file extension
        .replace(/\([^)]*\)/g, "") // Remove anything in parentheses like (1997)
        .replace(/\[[^\]]*\]/g, "") // Remove anything in brackets
        .replace(/1080p|720p|4k|x264|x265|Bluray|TELESYNC|HDTV|SDTV|AAC|WEBRip|HDRip|H\.264|H\.265/gi, "") // Remove scene markers
        .replace(/[-_.]/g, " ") // Convert spacers to spaces
        .replace(/\s+/g, " ") // Compress spaces
        .trim()

      // 1. Determine extracted parts from raw filename
      let guessType = 'movie'
      let searchTitle = cleanTerm
      let searchYear = ''
      let searchSeason = ''
      let searchEpisode = ''
      
      if (rawFilename) {
        const tvMatch = rawFilename.match(/^(.*?)[-_\s]*[sS](\d{1,2})[eE](\d{1,2})/i)
        if (tvMatch) {
          guessType = 'tv'
          searchTitle = tvMatch[1].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
          searchSeason = parseInt(tvMatch[2], 10).toString()
          searchEpisode = parseInt(tvMatch[3], 10).toString()
        } else {
          const movieMatch = rawFilename.match(/^(.*?)[-_\s]*\((\d{4})\)/)
          if (movieMatch) {
             searchTitle = movieMatch[1].replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
             searchYear = movieMatch[2]
          }
        }
      }

      // 2. Check for manual overrides 
      let overrideObj: any = null
      if (rawFilename) {
        const storedOverride = localStorage.getItem(`vlc-meta-override-${rawFilename}`)
        if (storedOverride) {
           try {
             overrideObj = JSON.parse(storedOverride)
             if (overrideObj.title) searchTitle = overrideObj.title
             if (overrideObj.year) searchYear = overrideObj.year
             if (overrideObj.season) searchSeason = overrideObj.season
             if (overrideObj.episode) searchEpisode = overrideObj.episode
             if (overrideObj.type) guessType = overrideObj.type
           } catch (e) { /* ignore parses */ }
        }
      }
      
      let source = guessType === 'tv' 
        ? (localStorage.getItem('vlc-tv-metadata-source') || 'itunes') 
        : (localStorage.getItem('vlc-movie-metadata-source') || 'itunes')
        
      if (overrideObj && overrideObj.provider && overrideObj.provider !== 'auto') {
        source = overrideObj.provider
      }

      if (source === 'tvmaze') {
        try {
          const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(searchTitle)}`)
          const data = await res.json()
          if (data && data.length > 0) {
            const item = data[0].show
            return {
              title: item.name,
              artist: 'TV Series',
              artwork: item.image?.original || item.image?.medium,
              description: item.summary ? item.summary.replace(/<[^>]*>?/gm, '') : undefined,
              genre: item.genres?.[0] || 'TV Show',
              releaseDate: item.premiered
            }
          }
        } catch (err) {
           console.error("TVMaze API fetching failed", err)
        }
        return null
      }

      if (source === 'tmdb') {
        try {
          const token = localStorage.getItem('vlc-tmdb-token')
          if (!token) throw new Error("Missing TMDB token")
          
          let searchType = 'multi'
          if (rawFilename) {
             const override = localStorage.getItem(`vlc-meta-override-${rawFilename}`)
             if (override) {
               const p = JSON.parse(override)
               if (p.type === 'movie') searchType = 'movie'
               if (p.type === 'tv') searchType = 'tv'
             }
          }

          let queryParam = `query=${encodeURIComponent(searchTitle)}`
          if (searchType === 'movie' && searchYear) queryParam += `&year=${searchYear}`
          if (searchType === 'tv' && searchYear) queryParam += `&first_air_date_year=${searchYear}`

          const res = await fetch(`https://api.themoviedb.org/3/search/${searchType}?${queryParam}&include_adult=false&language=en-US&page=1`, {
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${token}`
            }
          })
          const data = await res.json()
          
          if (data.results && data.results.length > 0) {
            const item = data.results[0]
            const isTv = item.media_type === 'tv' || searchType === 'tv'
            return {
              title: item.title || item.name,
              artist: isTv ? 'TV Series' : 'Movie',
              artwork: item.poster_path ? `https://image.tmdb.org/t/p/w600_and_h900_bestv2${item.poster_path}` : undefined,
              description: item.overview,
              genre: isTv ? 'TV Show' : 'Movie',
              releaseDate: item.release_date || item.first_air_date
            }
          }
        } catch (err) {
           console.error("TMDB API fetching failed", err)
        }
        return null
      }

      if (source === 'thetvdb') {
        try {
          const apiKey = localStorage.getItem('vlc-tvdb-key')
          if (!apiKey) throw new Error("Missing TheTVDB API key")
          
          let bearer = localStorage.getItem('vlc-tvdb-bearer')
          if (!bearer) {
            const authRes = await fetch('https://api4.thetvdb.com/v4/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ apikey: apiKey })
            })
            const authData = await authRes.json()
            if (authData.data?.token) {
               bearer = authData.data.token
               localStorage.setItem('vlc-tvdb-bearer', bearer as string)
            } else {
               throw new Error("Failed to authenticate with TheTVDB")
            }
          }

          let safeType = guessType === 'tv' ? 'series' : 'movie'
          
          let queryParams = `query=${encodeURIComponent(searchTitle)}&type=${safeType}`
          if (searchYear) queryParams += `&year=${searchYear}`

          const res = await fetch(`https://api4.thetvdb.com/v4/search?${queryParams}`, {
            headers: { accept: 'application/json', Authorization: `Bearer ${bearer}` }
          })
          
          if (res.status === 401) {
            localStorage.removeItem('vlc-tvdb-bearer')
            throw new Error("TheTVDB token expired")
          }

          const data = await res.json()
          
          if (data.data && data.data.length > 0) {
            const seriesItem = data.data[0] // Could be movie or series
            
            // If it's a TV series and we extracted season/episode, do the extended fetch
            if (safeType === 'series') {
               if (searchSeason && searchEpisode && seriesItem.tvdb_id) {
                  const epRes = await fetch(`https://api4.thetvdb.com/v4/series/${seriesItem.tvdb_id}/episodes/official?season=${searchSeason}&episodeNumber=${searchEpisode}`, {
                     headers: { Authorization: `Bearer ${bearer}` }
                  })
                  const epData = await epRes.json()
                  
                  if (epData.data?.episodes && epData.data.episodes.length > 0) {
                     const episodeId = epData.data.episodes[0].id
                     
                     const extRes = await fetch(`https://api4.thetvdb.com/v4/episodes/${episodeId}/extended`, {
                        headers: { accept: 'application/json', Authorization: `Bearer ${bearer}` }
                     })
                     const extData = await extRes.json()
                     if (extData.data) {
                        return {
                          title: extData.data.name || seriesItem.name,
                          artist: seriesItem.name + ` (S${searchSeason}E${searchEpisode})`,
                          artwork: extData.data.image || seriesItem.image_url,
                          description: extData.data.overview || seriesItem.overview,
                          genre: 'TV Series',
                          releaseDate: extData.data.aired
                        }
                     }
                  }
               }
            }
            
            // Fallback for Movies or if TV extended fetch failed/wasn't attempted
            return {
              title: seriesItem.name,
              artist: seriesItem.type === 'movie' ? 'Movie' : 'TV Series',
              artwork: seriesItem.image_url,
              description: seriesItem.overview,
              genre: seriesItem.type,
              releaseDate: seriesItem.year ? `${seriesItem.year}-01-01` : undefined
            }
          }
        } catch (err) {
           console.error("TheTVDB API fetching failed", err)
        }
        return null
      }

      // 3. Fallback to iTunes Integration
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTitle + (searchYear ? ' ' + searchYear : ''))}&limit=15&media=all`)
      const data = await res.json()
      
      if (data.results && data.results.length > 0) {
        let items = data.results.filter((i: any) => 
          i.kind === 'feature-movie' || 
          i.kind === 'tv-episode' || 
          i.kind === 'song' || 
          i.collectionType === 'TV Season'
        )
        
        // Manual override type reinforcement
        if (rawFilename) {
          const override = localStorage.getItem(`vlc-meta-override-${rawFilename}`)
          if (override) {
            const p = JSON.parse(override)
            if (p.type === 'movie') items = data.results.filter((i: any) => i.kind === 'feature-movie')
            if (p.type === 'tv') items = data.results.filter((i: any) => i.kind === 'tv-episode' || i.collectionType === 'TV Season')
          }
        }

        const item = items.length > 0 ? items[0] : data.results[0]
        return {
          title: item.trackName || item.collectionName,
          artist: item.artistName,
          artwork: item.artworkUrl100?.replace('100x100', '600x600'),
          description: item.longDescription || item.shortDescription || item.description,
          genre: item.primaryGenreName,
          releaseDate: item.releaseDate
        }
      }
      return null
    },
    enabled: isEnabled && !!searchTerm,
    staleTime: 1000 * 60 * 60 * 24 // 24 hours
  })
}
