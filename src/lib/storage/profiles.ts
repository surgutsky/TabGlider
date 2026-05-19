import type { ClosedTab, Profile, ProfilesIndex } from '../types'
import { getSettings } from './settings'

const INDEX_KEY = 'tabglider:index'
const profileKey = (id: string) => `tabglider:profile:${id}`

export async function getIndex(): Promise<ProfilesIndex | null> {
  try {
    const result = await chrome.storage.local.get(INDEX_KEY)
    return (result[INDEX_KEY] as ProfilesIndex) ?? null
  } catch (e) {
    console.error('Failed to get profiles index', e)
    return null
  }
}

export async function setIndex(index: ProfilesIndex): Promise<void> {
  try {
    await chrome.storage.local.set({ [INDEX_KEY]: index })
  } catch (e) {
    console.error('Failed to set profiles index', e)
  }
}

export async function getProfile(id: string): Promise<Profile | null> {
  try {
    const key = profileKey(id)
    const result = await chrome.storage.local.get(key)
    return (result[key] as Profile) ?? null
  } catch (e) {
    console.error(`Failed to get profile ${id}`, e)
    return null
  }
}

export async function setProfile(profile: Profile): Promise<void> {
  try {
    await chrome.storage.local.set({ [profileKey(profile.id)]: profile })
  } catch (e) {
    console.error(`Failed to set profile ${profile.id}`, e)
  }
}

export async function deleteProfile(id: string): Promise<void> {
  try {
    const index = await getIndex()
    if (!index) throw new Error('No profiles index found')
    const entry = index.profiles.find(p => p.id === id)
    if (entry?.name === 'Default') throw new Error('Cannot delete Default profile')
    if (index.profiles.length <= 1) throw new Error('Cannot delete the only profile')
    await chrome.storage.local.remove(profileKey(id))
    const remaining = index.profiles.filter(p => p.id !== id)
    const newActiveId = index.activeProfileId === id ? remaining[0].id : index.activeProfileId
    await setIndex({ ...index, profiles: remaining, activeProfileId: newActiveId })
  } catch (e) {
    console.error(`Failed to delete profile ${id}`, e)
    throw e
  }
}

export async function getAllProfiles(): Promise<Profile[]> {
  try {
    const index = await getIndex()
    if (!index) return []
    const keys = index.profiles.map(p => profileKey(p.id))
    const result = await chrome.storage.local.get(keys)
    return keys.map(k => result[k] as Profile).filter(Boolean)
  } catch (e) {
    console.error('Failed to get all profiles', e)
    return []
  }
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function patchProfile(id: string, patch: Partial<Profile>): Promise<void> {
  try {
    const current = await getProfile(id)
    if (!current) {
      console.error(`Cannot patch non-existent profile ${id}`)
      return
    }
    await setProfile({ ...current, ...patch })
  } catch (e) {
    console.error(`Failed to patch profile ${id}`, e)
  }
}

export async function addClosedTab(profileId: string, url: string): Promise<void> {
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return
  try {
    const [profile, settings] = await Promise.all([getProfile(profileId), getSettings()])
    if (!profile) return
    const closedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const entry: ClosedTab = { url, closedAt }
    const deduped = profile.closedTabs.filter(t => t.url !== url)
    const closedTabs = [entry, ...deduped]
    if (closedTabs.length > settings.closedTabsLimit) closedTabs.pop()
    await setProfile({ ...profile, closedTabs })
  } catch (e) {
    console.error(`Failed to add closed tab for profile ${profileId}`, e)
  }
}

export async function initDefaultProfile(): Promise<void> {
  try {
    const existing = await getIndex()
    if (existing) return
    const today = new Date().toISOString().slice(0, 10)
    const id = crypto.randomUUID()
    const profile: Profile = {
      id,
      name: 'Default',
      createdAt: today,
      updatedAt: today,
      windows: [],
      closedTabs: [],
    }
    const index: ProfilesIndex = {
      activeProfileId: id,
      profiles: [{ id, name: 'Default', createdAt: today }],
    }
    await setProfile(profile)
    await setIndex(index)
  } catch (e) {
    console.error('Failed to initialize default profile', e)
  }
}
