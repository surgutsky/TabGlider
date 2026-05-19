import type { Profile, SavedWindow } from '../types'

// After crxjs build the switching page lands at switching/index.html.
// Verify this path matches the built output on first run.
const SWITCHING_PAGE = 'switching/index.html'

async function restoreWindow(savedWindow: SavedWindow, targetWindowId: number): Promise<number | undefined> {
  const { tabs, groups } = savedWindow
  const createdTabIds = new Map<number, number>() // tab index → chrome tab id

  const pinnedIndices = tabs.map((t, i) => ({ t, i })).filter(({ t }) => t.pinned).map(({ i }) => i)
  const unpinnedIndices = tabs.map((t, i) => ({ t, i })).filter(({ t }) => !t.pinned).map(({ i }) => i)

  let firstTabId: number | undefined

  for (const i of [...pinnedIndices, ...unpinnedIndices]) {
    const saved = tabs[i]
    try {
      const tab = await chrome.tabs.create({
        url: saved.url,
        pinned: saved.pinned,
        windowId: targetWindowId,
        active: false,
      })
      createdTabIds.set(i, tab.id!)
      if (firstTabId === undefined) firstTabId = tab.id!
    } catch (err) {
      console.warn(`Failed to open tab ${saved.url}: ${err}`)
    }
  }

  const chromeGroupIds = new Map<string, number>()

  for (const savedGroup of groups) {
    const tabIdsForGroup = tabs
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.groupRef === savedGroup.ref)
      .map(({ i }) => createdTabIds.get(i))
      .filter((id): id is number => id !== undefined)

    if (tabIdsForGroup.length === 0) continue

    try {
      const chromeGroupId = await chrome.tabs.group({
        tabIds: tabIdsForGroup,
        createProperties: { windowId: targetWindowId },
      })
      await chrome.tabGroups.update(chromeGroupId, {
        title: savedGroup.title,
        color: savedGroup.color,
      })
      chromeGroupIds.set(savedGroup.ref, chromeGroupId)
    } catch (err) {
      console.warn(`Failed to recreate group "${savedGroup.title}": ${err}`)
    }
  }

  for (const savedGroup of groups) {
    if (!savedGroup.collapsed) continue
    const chromeGroupId = chromeGroupIds.get(savedGroup.ref)
    if (chromeGroupId === undefined) continue
    try {
      await chrome.tabGroups.update(chromeGroupId, { collapsed: true })
    } catch (err) {
      console.warn(`Failed to collapse group "${savedGroup.title}": ${err}`)
    }
  }

  return firstTabId
}

export async function restoreProfile(profile: Profile): Promise<void> {
  let currentWins: chrome.windows.Window[]
  try {
    currentWins = await chrome.windows.getAll({ populate: false })
  } catch (err) {
    throw new Error(`Failed to get current windows: ${err}`)
  }

  const normalWins = currentWins.filter(w => w.type === 'normal')
  const firstWinId = normalWins[0]?.id
  if (firstWinId === undefined) {
    throw new Error('No normal window found')
  }

  // Step 3: open switching page in first window as visual anchor
  let switchingTabId: number
  try {
    const switchingTab = await chrome.tabs.create({
      url: chrome.runtime.getURL(SWITCHING_PAGE),
      windowId: firstWinId,
      active: true,
    })
    switchingTabId = switchingTab.id!
  } catch (err) {
    throw new Error(`Failed to open switching page: ${err}`)
  }

  // Step 4: close all tabs in all normal windows except switching tab
  // Windows with no tabs remaining will close automatically
  try {
    const allTabs = (
      await Promise.all(normalWins.map(w => chrome.tabs.query({ windowId: w.id! })))
    ).flat()
    const toClose = allTabs.map(t => t.id!).filter(id => id !== undefined && id !== switchingTabId)
    if (toClose.length > 0) {
      await chrome.tabs.remove(toClose)
    }
  } catch (err) {
    throw new Error(`Failed to close existing tabs: ${err}`)
  }

  if (profile.windows.length === 0 || profile.windows.every(w => w.tabs.length === 0)) {
    try {
      await chrome.tabs.create({ url: 'chrome://newtab' })
    } catch (err) {
      console.warn(`Failed to open new tab for empty profile: ${err}`)
    }
    try {
      await chrome.tabs.remove(switchingTabId)
    } catch (err) {
      console.warn(`Failed to close switching tab: ${err}`)
    }
    return
  }

  // Steps 5–7: restore each saved window
  let firstRestoredTabId: number | undefined

  for (let i = 0; i < profile.windows.length; i++) {
    const savedWindow = profile.windows[i]
    let targetWindowId: number
    let placeholderTabId: number | undefined

    if (i === 0) {
      // Reuse the window that holds the switching tab
      targetWindowId = firstWinId
    } else {
      // Create a new background window; Chrome opens a newtab placeholder
      try {
        const newWin = await chrome.windows.create({ focused: false })
        targetWindowId = newWin.id!
        placeholderTabId = newWin.tabs?.[0]?.id
      } catch (err) {
        console.warn(`Failed to create window for saved window ${i}: ${err}`)
        continue
      }
    }

    const firstTabId = await restoreWindow(savedWindow, targetWindowId)
    if (i === 0 && firstTabId !== undefined) {
      firstRestoredTabId = firstTabId
    }

    // Close the newtab placeholder now that real tabs exist in the window
    if (placeholderTabId !== undefined) {
      try {
        await chrome.tabs.remove(placeholderTabId)
      } catch (err) {
        console.warn(`Failed to remove placeholder tab: ${err}`)
      }
    }
  }

  // Step 8: close switching page — ensure at least one tab remains first
  if (firstRestoredTabId === undefined) {
    try {
      await chrome.tabs.create({ url: 'chrome://newtab' })
    } catch (err) {
      console.warn(`Failed to open fallback tab before closing switching page: ${err}`)
    }
  }
  try {
    await chrome.tabs.remove(switchingTabId)
  } catch (err) {
    console.warn(`Failed to close switching tab: ${err}`)
  }

  // Activate the first restored tab in the first window
  if (firstRestoredTabId !== undefined) {
    try {
      await chrome.tabs.update(firstRestoredTabId, { active: true })
    } catch {
      // tab may already be active or unavailable
    }
  }
}
