import { getIndex, setIndex, getProfile, setProfile, initDefaultProfile } from '../lib/storage'
import { getSettings } from '../lib/storage/settings'
import { captureAllWindows, patchProfile } from '../lib/tabs/capture'
import { restoreProfile } from '../lib/tabs/restore'
import { debounce } from '../lib/tabs/events'
import type { ClosedTab } from '../lib/types'

;(async () => {
  await initDefaultProfile()
})()

// Returns the content script JS files declared in the manifest — handles hashed filenames.
function getContentScriptFiles(): string[] {
  return chrome.runtime.getManifest().content_scripts?.[0]?.js ?? []
}

async function injectQuickSwitcherIntoAllTabs(): Promise<void> {
  const files = getContentScriptFiles()
  if (files.length === 0) return

  const tabs = await chrome.tabs.query({})
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue
    const url = tab.url
    if (
      url.startsWith('chrome://') ||
      url.startsWith('about:') ||
      url.startsWith('chrome-extension://')
    ) continue
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files })
    } catch {
      // tab may not be injectable — ignore silently
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await initDefaultProfile()
  await injectQuickSwitcherIntoAllTabs()
})

chrome.runtime.onStartup.addListener(async () => {
  await injectQuickSwitcherIntoAllTabs()
})

// Shared mutable flag — set true during profile switching to suppress autosave.
const isSwitchingRef = { value: false }

function formatDateTime(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${dd} ${h}:${mi}`
}

// ─── Autosave ───────────────────────────────────────────────────────────────

async function autosave(): Promise<void> {
  if (isSwitchingRef.value) return
  const index = await getIndex()
  if (!index) return
  const profile = await getProfile(index.activeProfileId)
  if (!profile) return
  const windows = await captureAllWindows()
  await setProfile(patchProfile(profile, windows))
}

const debouncedAutosave = debounce(autosave as () => void, 500)

// ─── Tab URL tracking (needed for closedTabs on removal) ────────────────────

const tabUrls = new Map<number, string>()

chrome.tabs.onCreated.addListener(tab => {
  if (tab.id && tab.url) tabUrls.set(tab.id, tab.url)
  debouncedAutosave()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url) tabUrls.set(tabId, tab.url)
  debouncedAutosave()
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (isSwitchingRef.value) {
    tabUrls.delete(tabId)
    return
  }

  const url = tabUrls.get(tabId)
  tabUrls.delete(tabId)

  if (url && !url.startsWith('chrome-extension://') && !url.startsWith('chrome://')) {
    const index = await getIndex()
    if (index) {
      const profile = await getProfile(index.activeProfileId)
      const settings = await getSettings()
      if (profile) {
        const entry: ClosedTab = { url, closedAt: formatDateTime(new Date()) }
        const closedTabs = [entry, ...profile.closedTabs].slice(0, settings.closedTabsLimit)
        await setProfile({ ...profile, closedTabs })
      }
    }
  }

  debouncedAutosave()
})

chrome.tabs.onMoved.addListener(() => debouncedAutosave())
chrome.tabs.onAttached.addListener(() => debouncedAutosave())
chrome.tabs.onDetached.addListener(() => debouncedAutosave())

chrome.tabGroups.onCreated.addListener(() => debouncedAutosave())
chrome.tabGroups.onRemoved.addListener(() => debouncedAutosave())
chrome.tabGroups.onUpdated.addListener(() => debouncedAutosave())

// ─── Commands ───────────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'open-quick-switcher') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    const url = tab.url ?? ''
    if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return

    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_QUICK_SWITCHER' })
    } catch {
      // content script not injected yet — inject it then retry
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: getContentScriptFiles()
        })
        await chrome.tabs.sendMessage(tab.id, { type: 'OPEN_QUICK_SWITCHER' })
      } catch (err) {
        console.error('TabGlider: could not open quick switcher', err)
      }
    }
  }
})

// ─── Profile switching ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SWITCH_PROFILE') {
    handleSwitchProfile(message.profileId as string)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: String(err) }))
    return true // keep channel open for async response
  }

  if (message.type === 'GET_INDEX') {
    getIndex().then(sendResponse).catch(() => sendResponse(null))
    return true
  }

  if (message.type === 'CREATE_PROFILE') {
    handleCreateProfile(message.name as string)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: String(err) }))
    return true
  }
})

async function handleSwitchProfile(profileId: string): Promise<void> {
  // Step 1: guard autosave
  isSwitchingRef.value = true

  try {
    const index = await getIndex()
    if (!index) throw new Error('No profiles index found')

    // Step 2: save current profile snapshot
    const current = await getProfile(index.activeProfileId)
    if (current) {
      const windows = await captureAllWindows()
      await setProfile(patchProfile(current, windows))
    }

    const target = await getProfile(profileId)
    if (!target) throw new Error(`Profile "${profileId}" not found`)

    // Steps 3–8
    await restoreProfile(target)

    // Step 10: update active profile id
    await setIndex({ ...index, activeProfileId: profileId })
  } finally {
    // Step 9
    isSwitchingRef.value = false
  }
}

async function handleCreateProfile(name: string): Promise<void> {
  const { slugify } = await import('../lib/storage/profiles')
  const id = slugify(name)
  const now = new Date().toISOString().slice(0, 10)

  const index = (await getIndex()) ?? { activeProfileId: id, profiles: [] }

  if (index.profiles.some(p => p.id === id)) {
    throw new Error(`Profile "${name}" already exists`)
  }

  const profile = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    windows: [],
    closedTabs: [],
  }

  await setProfile(profile)
  await setIndex({
    ...index,
    profiles: [...index.profiles, { id, name, createdAt: now }],
  })
}

// ─── Side panel ─────────────────────────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
