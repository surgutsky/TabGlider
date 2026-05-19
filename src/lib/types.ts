export interface SavedTab {
  url: string
  groupRef: string | null  // internal UUID ref to SavedGroup
  pinned: boolean
}

export interface SavedGroup {
  ref: string              // internal UUID (not chrome's numeric id)
  title: string
  color: chrome.tabGroups.ColorEnum
  collapsed: boolean
}

export interface SavedWindow {
  ref: string              // UUID
  tabs: SavedTab[]         // flat ordered array for this window
  groups: SavedGroup[]
}

export interface ClosedTab {
  url: string
  closedAt: string         // "YYYY-MM-DD HH:mm"
}

export interface Profile {
  id: string               // slugified name e.g. "work"
  name: string
  createdAt: string        // "YYYY-MM-DD"
  updatedAt: string        // "YYYY-MM-DD"
  windows: SavedWindow[]
  closedTabs: ClosedTab[]  // max 200, FIFO
}

export interface ProfilesIndex {
  activeProfileId: string
  profiles: Array<{ id: string; name: string; createdAt: string }>
}

export interface Settings {
  closedTabsLimit: number  // default 200
}
