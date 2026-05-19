import type { Settings } from '../types'

const SETTINGS_KEY = 'tabglider:settings'

const DEFAULT_SETTINGS: Settings = {
  closedTabsLimit: 200,
}

export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_KEY)
    return { ...DEFAULT_SETTINGS, ...(result[SETTINGS_KEY] as Partial<Settings> ?? {}) }
  } catch (e) {
    console.error('Failed to get settings', e)
    return { ...DEFAULT_SETTINGS }
  }
}

export async function setSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
  } catch (e) {
    console.error('Failed to set settings', e)
  }
}
