<script lang="ts">
  import { getIndex, getProfile, setProfile, setIndex } from '../lib/storage'
  import type { Profile, ProfilesIndex, ClosedTab } from '../lib/types'
  import ProfileList from '../components/ProfileList.svelte'
  import ClosedTabsList from '../components/ClosedTabsList.svelte'

  let index = $state<ProfilesIndex | null>(null)
  let closedTabs = $state<ClosedTab[]>([])
  let isSwitching = $state(false)
  let error = $state('')

  $effect(() => {
    loadAll()
    chrome.storage.onChanged.addListener(onStorageChanged)
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged)
    }
  })

  async function loadAll() {
    try {
      const idx = await getIndex()
      index = idx
      if (idx?.activeProfileId) {
        const profile = await getProfile(idx.activeProfileId)
        closedTabs = profile?.closedTabs ?? []
      } else {
        closedTabs = []
      }
    } catch (e) {
      error = String(e)
    }
  }

  function onStorageChanged(
    changes: Record<string, chrome.storage.StorageChange>,
    area: string
  ) {
    if (area !== 'local') return
    let activeId = index?.activeProfileId
    if ('tabglider:index' in changes) {
      const newIdx = changes['tabglider:index'].newValue as ProfilesIndex | undefined
      index = newIdx ?? null
      activeId = newIdx?.activeProfileId
    }
    if (activeId) {
      const key = `tabglider:profile:${activeId}`
      if (key in changes) {
        const p = changes[key].newValue as Profile | undefined
        closedTabs = p?.closedTabs ?? []
      }
    }
  }

  async function switchProfile(profileId: string) {
    if (isSwitching) return
    isSwitching = true
    error = ''
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SWITCH_PROFILE', profileId })
      if (!res?.success) throw new Error(res?.error ?? 'Switch failed')
      await loadAll()
    } catch (e) {
      error = String(e)
    } finally {
      isSwitching = false
    }
  }

  async function createProfile() {
    const name = window.prompt('Profile name:')
    if (!name?.trim()) return
    const trimmed = name.trim()
    const id = crypto.randomUUID()
    error = ''
    const today = new Date().toISOString().slice(0, 10)
    const newProfile: Profile = {
      id,
      name: trimmed,
      createdAt: today,
      updatedAt: today,
      windows: [],
      closedTabs: [],
    }
    await setProfile(newProfile)
    if (index) {
      await setIndex({
        ...index,
        profiles: [...index.profiles, { id, name: trimmed, createdAt: today }],
      })
    }
    await loadAll()
  }

  async function reopenTab(url: string) {
    await chrome.tabs.create({ url })
  }

  function openSettings() {
    chrome.runtime.openOptionsPage()
  }
</script>

<main>
  {#if error}
    <p class="error-msg" role="alert">{error}</p>
  {/if}

  <section>
    <div class="section-header">
      <h2 class="section-title">Profiles</h2>
      <button class="btn-icon" onclick={openSettings} title="Settings">⚙</button>
    </div>
    {#if index === null}
      <p class="muted">Loading…</p>
    {:else if index.profiles.length === 0}
      <p class="muted">No profiles yet. Create one to get started.</p>
    {:else}
      <ProfileList
        profiles={index.profiles}
        activeProfileId={index.activeProfileId}
        {isSwitching}
        onswitch={switchProfile}
      />
    {/if}
    <button class="btn-new" onclick={createProfile}>+ New profile</button>
  </section>

  <section class="closed-section">
    <h2 class="section-title">Recently closed</h2>
    <ClosedTabsList {closedTabs} onreopen={reopenTab} />
  </section>
</main>

<style>
  :global(:root) {
    color-scheme: light dark;
  }

  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: Canvas;
    color: CanvasText;
    font-size: 14px;
    line-height: 1.5;
  }
  :global(button) { font-family: inherit; }

  main {
    padding: 12px 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .btn-icon {
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    color: GrayText;
    padding: 4px 6px;
    transition: background 0.15s, color 0.15s;
  }
  .btn-icon:hover { background: ButtonFace; color: CanvasText; }

  section { display: flex; flex-direction: column; gap: 6px; }

  .closed-section {
    border-top: 1px solid ButtonBorder;
    padding-top: 10px;
    margin-top: 2px;
  }

  .section-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: GrayText;
    margin: 0;
  }

  .btn-new {
    background: none;
    border: 1.5px dashed ButtonBorder;
    border-radius: 8px;
    color: LinkText;
    cursor: pointer;
    font-size: 13px;
    padding: 10px 14px;
    text-align: left;
    transition: background 0.15s;
  }
  .btn-new:hover { background: ButtonFace; }

  .error-msg {
    margin: 0;
    font-size: 12px;
    color: red;
    border-left: 2px solid red;
    padding: 3px 8px;
  }

  .muted { margin: 0; font-size: 13px; color: GrayText; }
</style>
