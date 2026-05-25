<script lang="ts">
  import {
    getIndex,
    getProfile,
    setProfile,
    setIndex,
    patchProfile,
  } from "../lib/storage";
  import type { Profile, ProfilesIndex, ClosedTab } from "../lib/types";
  import ProfileList from "../components/ProfileList.svelte";
  import ClosedTabsList from "../components/ClosedTabsList.svelte";

  function sendMessageWithTimeout(
    message: unknown,
    timeoutMs = 10000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Switch timed out"));
      }, timeoutMs);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  let index = $state<ProfilesIndex | null>(null);
  let activeProfile = $state<Profile | null>(null);
  let closedTabs = $state<ClosedTab[]>([]);
  let isSwitching = $state(false);
  let error = $state("");

  const hasMultipleWindows = $derived((activeProfile?.windows.length ?? 0) > 1);

  $effect(() => {
    loadAll();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  });

  async function loadAll() {
    try {
      const idx = await getIndex();
      index = idx;
      if (idx?.activeProfileId) {
        const profile = await getProfile(idx.activeProfileId);
        activeProfile = profile ?? null;
        closedTabs = profile?.closedTabs ?? [];
      } else {
        activeProfile = null;
        closedTabs = [];
      }
    } catch (e) {
      error = String(e);
    }
  }

  function onStorageChanged(
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) {
    if (area !== "local") return;
    let activeId = index?.activeProfileId;
    if ("tabglider:index" in changes) {
      const newIdx = changes["tabglider:index"].newValue as
        | ProfilesIndex
        | undefined;
      index = newIdx ?? null;
      activeId = newIdx?.activeProfileId;
    }
    if (activeId) {
      const key = `tabglider:profile:${activeId}`;
      if (key in changes) {
        const p = changes[key].newValue as Profile | undefined;
        activeProfile = p ?? null;
        closedTabs = p?.closedTabs ?? [];
      }
    }
  }

  async function switchProfile(profileId: string) {
    if (isSwitching) return;
    isSwitching = true;
    error = "";
    try {
      const response = await sendMessageWithTimeout({
        type: "SWITCH_PROFILE",
        profileId,
      });
      if (!response?.ok) {
        error = response?.error ?? "Failed to switch profile";
        return;
      }
      await loadAll();
    } catch (e) {
      error = String(e);
    } finally {
      isSwitching = false;
    }
  }

  async function createProfile() {
    const name = window.prompt("Profile name:");
    if (!name?.trim()) return;
    const trimmed = name.trim();
    const id = crypto.randomUUID();
    error = "";
    const today = new Date().toISOString().slice(0, 10);
    const newProfile: Profile = {
      id,
      name: trimmed,
      createdAt: today,
      updatedAt: today,
      windows: [],
      closedTabs: [],
    };
    await setProfile(newProfile);
    if (index) {
      await setIndex({
        ...index,
        profiles: [...index.profiles, { id, name: trimmed, createdAt: today }],
      });
    }
    await loadAll();
  }

  async function reopenTab(url: string): Promise<void> {
    const profile = await getProfile(index!.activeProfileId);
    if (profile) {
      const updated = profile.closedTabs.filter((t) => t.url !== url);
      await patchProfile(index!.activeProfileId, { closedTabs: updated });
      closedTabs = updated;
    }
    await chrome.tabs.create({ url });
  }

  async function clearClosedTabs(): Promise<void> {
    if (!window.confirm("Clear all recently closed tabs?")) return;
    if (!index?.activeProfileId) return;
    const profile = await getProfile(index.activeProfileId);
    if (!profile) return;
    await setProfile({ ...profile, closedTabs: [] });
    closedTabs = [];
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }
</script>

<main>
  {#if error}
    <div class="error-banner" role="alert">
      ⚠ {error}
      <button onclick={() => (error = "")}>✕</button>
    </div>
  {/if}

  <section>
    <div class="section-header">
      <h2 class="section-title">Profiles (select to switch)</h2>
      <button class="btn-icon" onclick={openSettings} title="Settings"
        >⚙</button
      >
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
    <ClosedTabsList
      {closedTabs}
      onreopen={reopenTab}
      onclear={clearClosedTabs}
    />
  </section>

  {#if hasMultipleWindows}
    <div class="hint-section">
      <div class="hint">
        💡 To restart Chrome without losing your windows, use "Close all
        windows" from the taskbar context menu.
      </div>
    </div>
  {/if}
</main>

<style>
  :root {
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
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --border: rgba(255, 255, 255, 0.07);
      --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.35),
        0 0 0 1px rgba(255, 255, 255, 0.05);
    }
  }

  :global(:root) {
    color-scheme: light dark;
  }

  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: Canvas;
    color: CanvasText;
    font-size: 14px;
    line-height: 1.5;
  }
  :global(button) {
    font-family: inherit;
  }

  main {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100vh;
    box-sizing: border-box;
    overflow: hidden;
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
    transition:
      background 0.15s,
      color 0.15s;
  }
  .btn-icon:hover {
    background: var(--accent-subtle);
    color: CanvasText;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .closed-section {
    border-top: 1px solid var(--border);
    padding-top: 10px;
    margin-top: 2px;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .section-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: GrayText;
    margin: 0;
  }

  .btn-new {
    background: none;
    border: 1.5px dashed color-mix(in srgb, LinkText 35%, Canvas);
    border-radius: var(--radius-md);
    color: LinkText;
    cursor: pointer;
    font-size: 13px;
    padding: 10px 14px;
    text-align: left;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  .btn-new:hover {
    background: var(--accent-subtle);
    border-color: LinkText;
  }

  .error-banner {
    background: color-mix(in srgb, red 10%, Canvas);
    border: 1px solid color-mix(in srgb, red 30%, Canvas);
    color: CanvasText;
    border-radius: var(--radius-md);
    padding: 10px 14px;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .error-banner button {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    font-size: 14px;
    padding: 0 0 0 8px;
    line-height: 1;
  }

  .muted {
    margin: 0;
    font-size: 13px;
    color: GrayText;
  }

  .hint-section {
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .hint {
    font-size: 11px;
    color: GrayText;
    background: color-mix(in srgb, LinkText 6%, Canvas);
    border: 1px solid color-mix(in srgb, LinkText 15%, Canvas);
    border-radius: var(--radius-md);
    padding: 8px 10px;
    line-height: 1.5;
  }
</style>
