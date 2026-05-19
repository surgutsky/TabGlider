<script lang="ts">
  import { getIndex, setIndex, setProfile } from "../lib/storage";
  import type { Profile } from "../lib/types";

  const { onclose }: { onclose: () => void } = $props();

  let profiles = $state<Array<{ id: string; name: string; createdAt: string }>>(
    [],
  );
  let activeProfileId = $state("");
  let search = $state("");
  let selectedIdx = $state(0);
  let isSwitching = $state(false);
  let newProfileMode = $state(false);
  let newProfileName = $state("");

  $effect(() => {
    getIndex().then((idx) => {
      if (idx) {
        profiles = idx.profiles;
        activeProfileId = idx.activeProfileId;
      }
    });
  });

  const filtered = $derived(
    profiles.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
  );

  $effect.pre(() => {
    search;
    selectedIdx = 0;
  });

  async function switchTo(id: string) {
    isSwitching = true;
    chrome.runtime.sendMessage({ type: "SWITCH_PROFILE", profileId: id });
    onclose();
  }

  async function createAndSwitch() {
    const name = newProfileName.trim();
    if (!name) return;
    isSwitching = true;
    const id = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const profile: Profile = {
      id,
      name,
      createdAt: today,
      updatedAt: today,
      windows: [],
      closedTabs: [],
    };
    await setProfile(profile);
    const idx = await getIndex();
    if (idx) {
      await setIndex({
        ...idx,
        profiles: [...idx.profiles, { id, name, createdAt: today }],
      });
    }
    chrome.runtime.sendMessage({ type: "SWITCH_PROFILE", profileId: id });
    onclose();
  }

  function autofocusAction(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isSwitching) return;

    if (newProfileMode) {
      if (e.key === "Escape") {
        newProfileMode = false;
        newProfileName = "";
      } else if (e.key === "Enter") {
        e.preventDefault();
        createAndSwitch();
      }
      return;
    }

    if (e.key === "Escape") {
      onclose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx < filtered.length) {
        switchTo(filtered[selectedIdx].id);
      } else {
        newProfileName = search;
        newProfileMode = true;
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="overlay"
  onclick={() => !isSwitching && onclose()}
  role="presentation"
>
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="switcher"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-label="Switch profile"
    tabindex="-1"
  >
    <div class="qs-header">
      <img
        src={chrome.runtime.getURL("icons/icon16.png")}
        width="16"
        height="16"
        alt=""
      />
      <span>TabGlider</span>
    </div>
    {#if isSwitching}
      <div class="spinner-wrap">
        <div class="spinner"></div>
        <span>Switching…</span>
      </div>
    {:else if newProfileMode}
      <input
        class="search-input"
        type="text"
        placeholder="New profile name…"
        bind:value={newProfileName}
        use:autofocusAction
      />
      <p class="hint">Enter to create · Esc to cancel</p>
    {:else}
      <input
        class="search-input"
        type="text"
        placeholder="Switch profile…"
        bind:value={search}
        use:autofocusAction
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
              <span
                class="dot"
                class:dot-active={profile.id === activeProfileId}
              ></span>
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
        onclick={() => {
          newProfileName = search;
          newProfileMode = true;
        }}
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
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
  }

  .switcher {
    --accent: LinkText;
    --accent-hover: color-mix(in srgb, LinkText 85%, CanvasText);
    --accent-subtle: color-mix(in srgb, LinkText 10%, Canvas);
    --accent-subtle-hover: color-mix(in srgb, LinkText 18%, Canvas);
    --border: rgba(0, 0, 0, 0.08);
    --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    color-scheme: light dark;
    background: Canvas;
    color: CanvasText;
    border-radius: var(--radius-lg);
    padding: 12px;
    width: 100%;
    max-width: 480px;
    margin: 0 16px;
    box-shadow: var(--shadow-md);
    box-sizing: border-box;
    font-size: 14px;
    line-height: 1.4;
    animation: appear 0.15s ease-out;
  }

  @media (prefers-color-scheme: dark) {
    .switcher {
      --border: rgba(255, 255, 255, 0.07);
      --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.35),
        0 0 0 1px rgba(255, 255, 255, 0.05);
    }
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(-8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .qs-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 10px;
    border-bottom: 1px solid var(--border);
    margin: -12px -12px 12px;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .qs-header img {
    border-radius: 4px;
  }

  .qs-header span {
    font-size: 14px;
    font-weight: 600;
    color: CanvasText;
  }

  .search-input {
    display: block;
    width: calc(100% + 24px);
    margin: -12px -12px 12px;
    background: transparent;
    color: CanvasText;
    border: none;
    border-bottom: 1px solid var(--border);
    padding: 14px 16px;
    font-size: 15px;
    outline: none;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    box-sizing: border-box;
  }
  .search-input::placeholder {
    color: GrayText;
  }

  .profiles-box {
    list-style: none;
    margin: 0;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
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
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    border-radius: 6px;
    transition: background 0.1s;
  }
  li button:hover {
    background: var(--accent-subtle);
  }
  li.active-profile button {
    color: LinkText;
    font-weight: 600;
  }
  li.selected button {
    background: var(--accent-subtle);
    color: LinkText;
    font-weight: 600;
  }
  li.selected .dot {
    background: LinkText;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--border);
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .dot.dot-active {
    background: LinkText;
    box-shadow: 0 0 0 2px var(--accent-subtle);
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
    border: 1.5px dashed color-mix(in srgb, LinkText 35%, Canvas);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: LinkText;
    font-size: 14px;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    background: none;
    box-sizing: border-box;
    text-align: left;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .new-profile-btn:hover,
  .new-profile-btn.selected {
    background: var(--accent-subtle);
    border-color: LinkText;
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
    border: 3px solid var(--border);
    border-top-color: LinkText;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
