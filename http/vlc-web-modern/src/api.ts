export interface VlcStatus {
  fullscreen: boolean;
  state: "playing" | "paused" | "stopped";
  volume: number;
  time: number;
  length: number;
  position: number;
  currentplid: number;
  information: {
    category: {
      meta: {
        filename: string;
        title?: string;
        artist?: string;
        album?: string;
        artwork_url?: string;
      };
    };
  };
}

export interface VlcPlaylistNode {
  type: string;
  name: string;
  id: string;
  uri?: string;
  children?: VlcPlaylistNode[];
}

const API_BASE = "";

// Helper to make API calls to VLC with basic auth handled correctly by browser.
// Safari and others drop 401 basic auth prompts via fetch() when credentials are not explicit,
// but XMLHttpRequest flawlessly triggers the native prompt.
export function fetchVlc<T>(endpoint: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_BASE}${endpoint}`, true);
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(new Error("Invalid JSON"));
        }
      } else {
        reject(new Error(`VLC API Error: ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network Error"));
    xhr.send();
  });
}

export async function sendVlmCommand(command: string): Promise<string> {
  console.log(`Sending VLM command: ${command}`);
  const query = `command=${encodeURIComponent(command)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", `/requests/vlm_cmd.xml?${query}`, true);
    xhr.withCredentials = true;
    xhr.onload = () => {
      const text = xhr.responseText;
      console.log(`VLM Response: ${text}`);
      const match = text.match(/<error>([\s\S]*?)<\/error>/);
      const errorText = match ? match[1].trim() : "";
      
      // An empty <error> node from VLC VLM actually means success.
      if (errorText && errorText !== "No command") {
         reject(new Error(errorText));
      } else {
         resolve(text);
      }
    };
    xhr.onerror = () => reject(new Error("Network Error"));
    xhr.send();
  });
}

export interface VlcBrowseEntry {
  type: "file" | "dir";
  name: string;
  path?: string;
  uri: string;
  size?: number;
}

// Lists the files/folders VLC can see at a given file:// URI.
// Calling with no uri returns VLC's own list of quick-access locations (drives/home/etc).
export async function browseDirectory(uri?: string): Promise<VlcBrowseEntry[]> {
  const query = uri ? `?uri=${encodeURIComponent(uri)}` : "";
  const data = await fetchVlc<any>(`/requests/browse.json${query}`);
  // Be defensive: some VLC versions wrap the list, most return a plain array.
  return Array.isArray(data) ? data : (data?.element ?? []);
}

export async function fetchStatus(): Promise<VlcStatus> {
  return fetchVlc<VlcStatus>("/requests/status.json");
}

export async function fetchPlaylist(): Promise<VlcPlaylistNode> {
  return fetchVlc<VlcPlaylistNode>("/requests/playlist.json");
}

export async function sendCommand(command: string, val?: string | number): Promise<VlcStatus> {
  let query = `command=${encodeURIComponent(command)}`;
  if (val !== undefined) {
    query += `&val=${encodeURIComponent(val.toString())}`;
  }
  return fetchVlc<VlcStatus>(`/requests/status.json?${query}`);
}

// pl_play uses the "id" query parameter (not "val", unlike most other commands)
// to select which playlist item to play. See: ?command=pl_play&id=<id>
export async function playPlaylistItem(id: string): Promise<VlcStatus> {
  return fetchVlc<VlcStatus>(`/requests/status.json?command=pl_play&id=${encodeURIComponent(id)}`);
}

// in_play uses the "input" query parameter (not "val") to add and immediately play a
// URI (a file:// path from Browse, or a network stream). See: ?command=in_play&input=<uri>
export async function playMediaUri(uri: string): Promise<VlcStatus> {
  return fetchVlc<VlcStatus>(`/requests/status.json?command=in_play&input=${encodeURIComponent(uri)}`);
}
