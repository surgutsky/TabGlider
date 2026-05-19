import type { Profile, SavedTab, SavedGroup, SavedWindow } from '../types'

const SKIP_URL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'edge://']

function isCapturableUrl(url: string): boolean {
  return !SKIP_URL_PREFIXES.some(p => url.startsWith(p))
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function captureWindow(winId: number): Promise<SavedWindow> {
  let chromeTabs: chrome.tabs.Tab[]
  let chromeGroups: chrome.tabGroups.TabGroup[]
  try {
    ;[chromeTabs, chromeGroups] = await Promise.all([
      chrome.tabs.query({ windowId: winId }),
      chrome.tabGroups.query({ windowId: winId }),
    ])
  } catch (err) {
    throw new Error(`Failed to query tabs/groups for window ${winId}: ${err}`)
  }

  const groupRefMap = new Map<number, string>()
  const groups: SavedGroup[] = chromeGroups.map(g => {
    const ref = crypto.randomUUID()
    groupRefMap.set(g.id, ref)
    return {
      ref,
      title: g.title ?? '',
      color: g.color,
      collapsed: g.collapsed,
    }
  })

  const tabs: SavedTab[] = chromeTabs
    .filter(t => {
      const url = t.pendingUrl ?? t.url ?? ''
      return url !== '' && isCapturableUrl(url)
    })
    .map(t => ({
      url: t.pendingUrl ?? t.url ?? '',
      groupRef:
        t.groupId !== undefined && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
          ? (groupRefMap.get(t.groupId) ?? null)
          : null,
      pinned: t.pinned,
    }))

  return { ref: crypto.randomUUID(), tabs, groups }
}

export async function captureAllWindows(): Promise<SavedWindow[]> {
  let wins: chrome.windows.Window[]
  try {
    wins = await chrome.windows.getAll({ populate: false })
  } catch (err) {
    throw new Error(`Failed to get windows: ${err}`)
  }

  const results: SavedWindow[] = []
  for (const win of wins.filter(w => w.type === 'normal')) {
    try {
      results.push(await captureWindow(win.id!))
    } catch (err) {
      console.warn(`Failed to capture window ${win.id}: ${err}`)
    }
  }
  return results
}

export function patchProfile(profile: Profile, windows: SavedWindow[]): Profile {
  return {
    ...profile,
    windows,
    updatedAt: today(),
  }
}
