import type { Profile, SavedTab, SavedGroup, SavedWindow, ClosedTab } from '../types'

type PartialProfile = Omit<Profile, 'id' | 'closedTabsLimit'>

const VALID_COLORS = new Set([
  'grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange',
])

function isValidColor(s: string): s is chrome.tabGroups.ColorEnum {
  return VALID_COLORS.has(s)
}

// ### Group Title [blue] [collapsed]
function parseGroupHeader(line: string): SavedGroup | null {
  const inner = line.slice(3).trim()
  const tokens = inner.split(/\s+/)
  if (tokens.length === 0) return null

  const colorToken = tokens.findIndex(t => isValidColor(t.replace(/^\[|\]$/g, '')))
  if (colorToken === -1) return null

  const color = tokens[colorToken].replace(/^\[|\]$/g, '') as chrome.tabGroups.ColorEnum
  const afterColor = tokens.slice(colorToken + 1)
  const collapsed = afterColor.some(t => t.replace(/^\[|\]$/g, '') === 'collapsed')
  const title = tokens.slice(0, colorToken).map(t => t.replace(/^\[|\]$/g, '')).join(' ')

  return { ref: crypto.randomUUID(), title, color, collapsed }
}

export function parseProfile(md: string): PartialProfile {
  const lines = md.split('\n')

  let name = ''
  let createdAt = ''
  let updatedAt = ''
  const windows: SavedWindow[] = []
  const closedTabs: ClosedTab[] = []

  let currentWindow: SavedWindow | null = null
  let currentGroupRef: string | null = null
  let inClosedTabs = false

  function ensureWindow(): SavedWindow {
    if (currentWindow === null) {
      currentWindow = { ref: crypto.randomUUID(), tabs: [], groups: [] }
      windows.push(currentWindow)
    }
    return currentWindow
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (line === '') continue

    if (line.startsWith('# ')) {
      const heading = line.slice(2).trim()
      if (heading === 'Closed Tabs') {
        inClosedTabs = true
      } else {
        name = heading
        inClosedTabs = false
        currentWindow = null
        currentGroupRef = null
      }
      continue
    }

    if (inClosedTabs) {
      if (line.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}, /)) {
        const commaIdx = line.indexOf(', ')
        closedTabs.push({ url: line.slice(commaIdx + 2), closedAt: line.slice(0, commaIdx) })
      }
      continue
    }

    // metadata line: "created: YYYY-MM-DD, updated: YYYY-MM-DD"
    if (line.startsWith('created:')) {
      const parts = line.split(',')
      createdAt = (parts[0].split(':')[1] ?? '').trim()
      updatedAt = (parts[1]?.split(':')[1] ?? '').trim()
      continue
    }

    if (line.startsWith('## ')) {
      currentWindow = { ref: crypto.randomUUID(), tabs: [], groups: [] }
      windows.push(currentWindow)
      currentGroupRef = null
      continue
    }

    if (line.startsWith('### ')) {
      const win = ensureWindow()
      const sub = line.slice(4).trim()
      if (sub === 'ungrouped') {
        currentGroupRef = null
      } else {
        const group = parseGroupHeader(line)
        if (group) {
          win.groups.push(group)
          currentGroupRef = group.ref
        }
      }
      continue
    }

    if (line.startsWith('http://') || line.startsWith('https://')) {
      const win = ensureWindow()
      const pinned = line.endsWith(' [pinned]')
      const url = pinned ? line.slice(0, -' [pinned]'.length) : line
      win.tabs.push({ url, groupRef: currentGroupRef, pinned })
      continue
    }
  }

  const now = new Date().toISOString().slice(0, 10)
  return {
    name,
    createdAt: createdAt || now,
    updatedAt: updatedAt || now,
    windows,
    closedTabs,
  }
}
