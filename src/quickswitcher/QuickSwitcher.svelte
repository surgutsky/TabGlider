<script lang="ts">
  import { getIndex } from "../lib/storage";

  const { onclose }: { onclose: () => void } = $props();

  function sendMessageWithTimeout(
    message: unknown,
    timeoutMs = 10000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Switch timed out'))
      }, timeoutMs)

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response)
        }
      })
    })
  }

  let profiles = $state<Array<{ id: string; name: string; createdAt: string }>>(
    [],
  );
  let activeProfileId = $state("");
  let search = $state("");
  let selectedIdx = $state(0);
  let isSwitching = $state(false);
  let error = $state("");

  $effect(() => {
    getIndex().then((idx) => {
      if (idx) {
        profiles = idx.profiles;
        activeProfileId = idx.activeProfileId;
        const i = idx.profiles.findIndex((p) => p.id === idx.activeProfileId);
        selectedIdx = i >= 0 ? i : 0;
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
    error = '';
    try {
      const response = await sendMessageWithTimeout({ type: 'SWITCH_PROFILE', profileId: id });
      if (!response?.ok) {
        isSwitching = false;
        error = response?.error ?? 'Failed to switch profile';
        return;
      }
    } catch {
      // channel closed = tab was closed during switch (success)
      return;
    }
    onclose();
  }

  function autofocusAction(node: HTMLInputElement) {
    setTimeout(() => node.focus(), 0);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (isSwitching) return;

    if (e.key === "Escape") {
      onclose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx < filtered.length) {
        switchTo(filtered[selectedIdx].id);
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
      {#if error}
        <p class="qs-error">⚠ {error}</p>
      {/if}
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
    --accent-muted: color-mix(in srgb, LinkText 70%, Canvas);
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
    width: calc(100% + 20px);
    margin: -10px -12px 12px;
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
    background: var(--accent-subtle);
    color: LinkText;
    font-weight: 600;
  }
  li.selected:not(.active-profile) button {
    background: var(--accent-subtle);
    color: var(--accent-muted);
    font-weight: 400;
  }
  li.selected:not(.active-profile) .dot {
    background: var(--accent-muted);
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

  .qs-error {
    color: red;
    font-size: 12px;
    padding: 8px 16px;
    margin: 0;
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
