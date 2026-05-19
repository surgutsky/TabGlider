<script lang="ts">
  import { getIndex, setIndex, setProfile } from '../lib/storage'
  import type { Profile } from '../lib/types'

  const { onclose }: { onclose: () => void } = $props()

  let profiles = $state<Array<{ id: string; name: string; createdAt: string }>>([])
  let activeProfileId = $state('')
  let search = $state('')
  let selectedIdx = $state(0)
  let isSwitching = $state(false)
  let newProfileMode = $state(false)
  let newProfileName = $state('')

  $effect(() => {
    getIndex().then((idx) => {
      if (idx) {
        profiles = idx.profiles
        activeProfileId = idx.activeProfileId
      }
    })
  })

  const filtered = $derived(
    profiles.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
  )

  $effect(() => {
    search
    selectedIdx = 0
  })

  async function switchTo(id: string) {
    isSwitching = true
    try {
      await chrome.runtime.sendMessage({ type: 'SWITCH_PROFILE', profileId: id })
    } finally {
      onclose()
    }
  }

  async function createAndSwitch() {
    const name = newProfileName.trim()
    if (!name) return
    isSwitching = true
    try {
      const id = crypto.randomUUID()
      const today = new Date().toISOString().slice(0, 10)
      const profile: Profile = {
        id,
        name,
        createdAt: today,
        updatedAt: today,
        windows: [],
        closedTabs: [],
      }
      await setProfile(profile)
      const idx = await getIndex()
      if (idx) {
        await setIndex({ ...idx, profiles: [...idx.profiles, { id, name, createdAt: today }] })
      }
      await chrome.runtime.sendMessage({ type: 'SWITCH_PROFILE', profileId: id })
    } finally {
      onclose()
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isSwitching) return

    if (newProfileMode) {
      if (e.key === 'Escape') {
        newProfileMode = false
        newProfileName = ''
      } else if (e.key === 'Enter') {
        e.preventDefault()
        createAndSwitch()
      }
      return
    }

    if (e.key === 'Escape') {
      onclose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIdx = Math.min(selectedIdx + 1, filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIdx = Math.max(selectedIdx - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIdx < filtered.length) {
        switchTo(filtered[selectedIdx].id)
      } else {
        newProfileName = search
        newProfileMode = true
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="overlay" onclick={() => !isSwitching && onclose()} role="presentation">
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="switcher"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-label="Switch profile"
    tabindex="-1"
  >
    {#if isSwitching}
      <div class="spinner-wrap">
        <div class="spinner"></div>
        <span>Switching…</span>
      </div>
    {:else if newProfileMode}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="search-input"
        type="text"
        placeholder="New profile name…"
        bind:value={newProfileName}
        autofocus
      />
      <p class="hint">Enter to create · Esc to cancel</p>
    {:else}
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="search-input"
        type="text"
        placeholder="Switch profile…"
        bind:value={search}
        autofocus
      />
      <ul class="profiles-box" role="listbox" aria-label="Profiles">
        {#each filtered as profile, i}
          <li
            role="option"
            aria-selected={i === selectedIdx}
            class:selected={i === selectedIdx}
            class:active-profile={profile.id === activeProfileId}
          >
            <button onclick={() => switchTo(profile.id)}>
              <span class="check">{profile.id === activeProfileId ? '✓' : ''}</span>
              <span class="profile-name">{profile.name}</span>
            </button>
          </li>
        {/each}
        {#if filtered.length === 0}
          <li class="empty" role="status">No profiles match</li>
        {/if}
      </ul>
      <button
        class="new-profile-btn"
        class:selected={selectedIdx === filtered.length}
        onclick={() => { newProfileName = search; newProfileMode = true }}
      >
        <span class="new-plus">+</span>
        <span>New profile</span>
      </button>
      <p class="hint">↑↓ navigate · Enter select · Esc close</p>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .switcher {
    color-scheme: light dark;
    background: Canvas;
    color: CanvasText;
    border: 1px solid ButtonBorder;
    border-radius: 12px;
    padding: 12px;
    width: 100%;
    max-width: 480px;
    margin: 0 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.4;
    animation: appear 0.15s ease-out;
  }

  @keyframes appear {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)   scale(1);    }
  }

  .search-input {
    width: 100%;
    background: Field;
    color: FieldText;
    border: 1px solid ButtonBorder;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 14px;
    margin-bottom: 12px;
    outline: none;
    font-family: system-ui, -apple-system, sans-serif;
    box-sizing: border-box;
    display: block;
  }
  .search-input::placeholder {
    color: GrayText;
  }

  .profiles-box {
    list-style: none;
    margin: 0;
    padding: 4px;
    border: 1px solid ButtonBorder;
    border-radius: 8px;
    overflow: hidden;
    overflow-y: auto;
    max-height: 280px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  li {
    display: block;
  }

  li button {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: inherit;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    border-radius: 6px;
    transition: background 0.1s;
  }
  li button:hover {
    background: ButtonFace;
  }
  li.active-profile button {
    color: LinkText;
    font-weight: 600;
  }
  li.selected button {
    color: LinkText;
    font-weight: 600;
  }

  .check {
    width: 16px;
    flex-shrink: 0;
    color: LinkText;
    font-size: 13px;
    text-align: center;
  }

  .profile-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 10px 14px;
    color: GrayText;
    font-size: 13px;
    text-align: center;
  }

  .new-profile-btn {
    width: 100%;
    margin-top: 8px;
    border: 1.5px dashed ButtonBorder;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: LinkText;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    background: none;
    box-sizing: border-box;
    text-align: left;
    transition: background 0.15s;
  }
  .new-profile-btn:hover,
  .new-profile-btn.selected {
    background: ButtonFace;
  }

  .new-plus {
    width: 16px;
    flex-shrink: 0;
    font-size: 16px;
    font-weight: 600;
    text-align: center;
    line-height: 1;
  }

  .hint {
    font-size: 11px;
    color: GrayText;
    text-align: center;
    margin-top: 8px;
    margin-bottom: 0;
    padding: 0;
  }

  .spinner-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px 16px;
    color: GrayText;
    font-size: 14px;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid ButtonBorder;
    border-top-color: LinkText;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
