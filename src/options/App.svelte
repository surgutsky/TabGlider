<script lang="ts">
  import {
    getIndex,
    setIndex,
    getProfile,
    setProfile,
  } from "../lib/storage";
  import { serializeProfile } from "../lib/md/serializer";
  import { parseProfile } from "../lib/md/parser";
  import type { Profile, ProfilesIndex } from "../lib/types";

  let index = $state<ProfilesIndex | null>(null);
  let selectedId = $state<string | null>(null);
  let selectedProfile = $state<Profile | null>(null);
  let editorText = $state("");
  let savedText = $state("");
  let closedTabsLimit = $state(200);
  let limitDirty = $state(false);
  let flash = $state<{ ok: boolean; msg: string } | null>(null);
  let shortcut = $state("");

  let isDirty = $derived(editorText !== savedText || limitDirty);

  function markDirty() {
    limitDirty = true;
  }
  let profileName = $derived(editorText.match(/^# (.+)$/m)?.[1]?.trim() ?? "");
  let isDefaultProfile = $derived(selectedProfile?.name === 'Default');

  $effect(() => {
    void init();
  });

  async function init() {
    const [idx, commands] = await Promise.all([
      getIndex(),
      chrome.commands.getAll(),
    ]);
    index = idx;
    shortcut =
      commands.find((c) => c.name === "open-quick-switcher")?.shortcut ??
      "Not set";
    if (idx && idx.profiles.length > 0) {
      await loadProfile(idx.profiles[0].id);
    }
  }

  async function loadProfile(id: string) {
    const profile = await getProfile(id);
    selectedId = id;
    selectedProfile = profile;
    if (profile) {
      const text = serializeProfile(profile);
      editorText = text;
      savedText = text;
      closedTabsLimit = profile.closedTabsLimit ?? 200;
    }
    limitDirty = false;
    flash = null;
  }

  async function handleSelectProfile(id: string) {
    if (selectedId === id) return;
    if (isDirty && !confirm("Unsaved changes — discard?")) return;
    await loadProfile(id);
  }

  function onNameInput(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (/^# .+$/m.test(editorText)) {
      editorText = editorText.replace(/^# .+$/m, `# ${val}`);
    } else {
      editorText = `# ${val}\n${editorText}`;
    }
  }

  async function createProfile() {
    const name = window.prompt("Profile name:");
    if (!name?.trim()) return;
    const existingNames = index?.profiles.map(p => p.name) ?? [];
    const trimmed = uniqueName(name.trim(), existingNames);
    const id = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const newProfile: Profile = {
      id,
      name: trimmed,
      createdAt: today,
      updatedAt: today,
      windows: [],
      closedTabs: [],
      closedTabsLimit: 200,
    };
    await setProfile(newProfile);
    if (index) {
      const newIndex: ProfilesIndex = {
        ...index,
        profiles: [...index.profiles, { id, name: trimmed, createdAt: today }],
      };
      await setIndex(newIndex);
      index = newIndex;
    }
    await loadProfile(id);
  }

  async function handleDelete(profileId: string) {
    if (!index) return;
    const entry = index.profiles.find((p) => p.id === profileId);
    if (!confirm(`Delete profile "${entry?.name ?? profileId}"?`)) return;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "DELETE_PROFILE",
        profileId,
      });
      if (!res?.success) throw new Error(res?.error ?? "Delete failed");
      const newIndex = await getIndex();
      index = newIndex;
      if (selectedId === profileId && newIndex && newIndex.profiles.length > 0) {
        const fallback =
          newIndex.profiles.find((p) => p.name === "Default") ??
          newIndex.profiles[0];
        await loadProfile(fallback.id);
      }
      flash = { ok: true, msg: "Profile deleted" };
      setTimeout(() => { flash = null; }, 2000);
    } catch (e) {
      flash = { ok: false, msg: String(e) };
    }
  }

  function uniqueName(base: string, existing: string[]): string {
    if (!existing.includes(base)) return base;
    let i = 1;
    while (existing.includes(`${base} (${i})`)) i++;
    return `${base} (${i})`;
  }

  async function saveProfile() {
    if (!selectedProfile) return;
    flash = null;
    try {
      const parsed = parseProfile(editorText);
      if (!parsed.name.trim()) throw new Error("Profile name is required");
      if (isDefaultProfile) {
        parsed.name = 'Default';
      } else if (index) {
        const otherNames = index.profiles
          .filter(p => p.id !== selectedProfile!.id)
          .map(p => p.name);
        parsed.name = uniqueName(parsed.name, otherNames);
      }
      const today = new Date().toISOString().slice(0, 10);
      const updated: Profile = {
        ...parsed,
        id: selectedProfile.id,
        updatedAt: today,
        closedTabsLimit,
      };
      await setProfile(updated);
      if (index) {
        const newProfiles = index.profiles.map((p) =>
          p.id === updated.id ? { ...p, name: updated.name } : p,
        );
        const newIndex: ProfilesIndex = { ...index, profiles: newProfiles };
        await setIndex(newIndex);
        index = newIndex;
      }
      selectedProfile = updated;
      const text = serializeProfile(updated);
      editorText = text;
      savedText = text;
      limitDirty = false;
      flash = { ok: true, msg: "Saved!" };
      setTimeout(() => {
        flash = null;
      }, 2000);
    } catch (e) {
      flash = { ok: false, msg: String(e) };
    }
  }

  function discardChanges() {
    editorText = savedText;
    closedTabsLimit = selectedProfile?.closedTabsLimit ?? 200;
    limitDirty = false;
    flash = null;
  }

  function exportMd() {
    if (!selectedProfile) return;
    const md = serializeProfile(selectedProfile);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProfile.name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importMd(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        parseProfile(text);
        editorText = text;
        flash = { ok: true, msg: "Imported — review and Save to apply." };
      } catch (err) {
        flash = { ok: false, msg: String(err) };
      }
    };
    reader.readAsText(file);
    input.value = "";
  }

  function openShortcuts() {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }

</script>

<main>
  <header>
    <img
      src="/icons/icon16.png"
      width="20"
      height="20"
      alt=""
      class="header-icon"
    />
    <span class="header-title">TabGlider</span>
  </header>

  <div class="content">
    <aside class="sidebar">
      <div class="section-label">Profiles</div>

      <ul class="profile-list" role="listbox" aria-label="Profiles">
        {#if index === null}
          <li class="muted-item">Loading…</li>
        {:else}
          {#each index.profiles as p (p.id)}
            {@const isActive = p.id === index.activeProfileId}
            {@const isSelected = p.id === selectedId}
            {@const canDelete = p.name !== 'Default' && index.profiles.length > 1}
            <li
              class="profile-item"
              class:selected={isSelected}
              class:is-active={isActive}
              role="option"
              aria-selected={isSelected}
            >
              <button
                class="profile-btn"
                onclick={() => handleSelectProfile(p.id)}
              >
                <span
                  class="active-dot"
                  class:dot-active={isActive}
                  aria-label={isActive ? "active" : ""}
                ></span>
                <span class="profile-name-text">{p.name}</span>
              </button>
              <button
                class="delete-btn"
                title={p.name === 'Default'
                  ? 'Cannot delete Default profile'
                  : index.profiles.length <= 1
                    ? 'Cannot delete the only profile'
                    : 'Delete profile'}
                aria-label="Delete {p.name}"
                disabled={!canDelete}
                onclick={() => handleDelete(p.id)}>✕</button
              >
            </li>
          {/each}
        {/if}
      </ul>

      <button class="btn-new" onclick={createProfile}>
        <span>+</span>
        <span>New profile</span>
      </button>

      <div class="divider"></div>

      <div class="section-label">Settings</div>
      <div class="setting-row">
        <span class="setting-label">Quick Switcher</span>
        <div class="shortcut-row">
          <kbd>{shortcut}</kbd>
          <button onclick={openShortcuts}>Change</button>
        </div>
      </div>
    </aside>

    <section class="editor-panel">
      {#if selectedProfile !== null}
        <input
          class="name-input"
          type="text"
          value={profileName}
          oninput={onNameInput}
          placeholder="Profile name"
          readonly={isDefaultProfile}
          title={isDefaultProfile ? 'Default profile name cannot be changed' : undefined}
        />

        <div class="profile-meta">
          <label>
            <span>Recently closed limit</span>
            <input
              type="number"
              min="10"
              max="500"
              bind:value={closedTabsLimit}
              onchange={markDirty}
            />
          </label>
        </div>

        <div class="editor-card">
          <div class="card-toolbar">
            <span class="md-label">Markdown</span>
            {#if isDirty}
              <span class="unsaved-dot">● Unsaved changes</span>
            {/if}
          </div>
          <textarea class="md-editor" spellcheck="false" bind:value={editorText}
          ></textarea>
        </div>

        <div class="action-bar">
          <label class="btn btn-secondary file-btn">
            Import MD
            <input type="file" accept=".md" onchange={importMd} />
          </label>
          <button class="btn btn-secondary" onclick={exportMd}>Export MD</button
          >
          <div class="action-spacer"></div>
          {#if flash}
            <span class={flash.ok ? "flash-ok" : "flash-err"}>{flash.msg}</span>
          {/if}
          <button
            class="btn btn-secondary"
            onclick={discardChanges}
            disabled={!isDirty}>Discard</button
          >
          <button class="btn btn-primary" onclick={saveProfile}>Save</button>
        </div>
      {:else}
        <p class="muted-text">Select a profile to edit.</p>
      {/if}
    </section>
  </div>
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
    --sidebar-bg: #f5f7fa;
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
      --sidebar-bg: #13131f;
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
    height: 100vh;
    overflow: hidden;
  }
  :global(button) {
    font-family: inherit;
  }

  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* ── Header ── */

  header {
    height: 52px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid var(--border);
    background: Canvas;
    flex-shrink: 0;
  }

  .header-icon {
    flex-shrink: 0;
    display: block;
  }

  .header-title {
    font-size: 15px;
    font-weight: 600;
    color: CanvasText;
  }

  /* ── Content layout ── */

  .content {
    display: flex;
    height: calc(100vh - 52px);
  }

  /* ── Sidebar ── */

  .sidebar {
    width: 220px;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--border);
    padding: 16px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: GrayText;
    padding: 0 8px;
    margin: 14px 0 4px;
    text-transform: uppercase;
  }
  .section-label:first-child {
    margin-top: 0;
  }

  .profile-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .profile-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 14px;
    background: transparent;
    transition: background 0.12s;
  }
  .profile-item:hover {
    background: var(--accent-subtle);
  }
  .profile-item.selected {
    background: var(--accent-subtle);
  }
  .profile-item.is-active .profile-name-text {
    color: LinkText;
    font-weight: 600;
  }

  .profile-btn {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
    font-size: 14px;
    color: inherit;
  }

  .active-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--border);
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .active-dot.dot-active {
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-subtle);
  }

  .profile-name-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .delete-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 4px;
    font-size: 14px;
    line-height: 1;
    color: GrayText;
    opacity: 0;
    transition:
      opacity 0.12s,
      color 0.12s,
      background 0.12s;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .profile-item:hover .delete-btn:not(:disabled) {
    opacity: 1;
  }
  .profile-item:hover .delete-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .delete-btn:not(:disabled):hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .muted-item {
    font-size: 13px;
    color: GrayText;
    padding: 8px 10px;
  }

  .btn-new {
    margin-top: 6px;
    padding: 8px 10px;
    border: 1.5px dashed color-mix(in srgb, LinkText 35%, Canvas);
    border-radius: var(--radius-md);
    background: transparent;
    color: LinkText;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    transition:
      background 0.12s,
      border-color 0.12s;
  }
  .btn-new:hover {
    background: var(--accent-subtle);
    border-color: LinkText;
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 10px 0;
  }

  .settings-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 2px;
  }

  .settings-label {
    font-size: 13px;
    color: CanvasText;
  }

  .number-input {
    width: 70px;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: Canvas;
    color: CanvasText;
    font-size: 13px;
    text-align: center;
    box-shadow: var(--shadow-sm);
  }

  .settings-save {
    width: 100%;
    margin-top: 6px;
    padding: 6px 12px;
    background: var(--accent-subtle);
    border: none;
    border-radius: var(--radius-sm);
    color: LinkText;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s;
  }
  .settings-save:hover:not(:disabled) {
    background: var(--accent-subtle-hover);
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 12px;
    padding: 0 2px;
  }

  .setting-label {
    font-size: 13px;
    color: CanvasText;
  }

  .shortcut-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  kbd {
    font-family: monospace;
    font-size: 12px;
    padding: 3px 8px;
    background: var(--accent-subtle);
    color: LinkText;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }

  .shortcut-row button {
    font-size: 12px;
    color: LinkText;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }
  .shortcut-row button:hover {
    color: var(--accent-hover);
  }

  /* ── Editor panel ── */

  .editor-panel {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 24px 28px;
    gap: 16px;
    background: Canvas;
    overflow: hidden;
  }

  .name-input {
    font-size: 21px;
    font-weight: 700;
    border: none;
    outline: none;
    background: transparent;
    color: CanvasText;
    width: 100%;
    border-bottom: 2px solid transparent;
    padding: 2px 0;
    transition: border-color 0.15s;
    flex-shrink: 0;
  }
  .name-input:focus {
    border-bottom-color: LinkText;
  }
  .name-input:read-only {
    opacity: 0.55;
    cursor: default;
  }

  .profile-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
    color: GrayText;
    flex-shrink: 0;
  }

  .profile-meta label {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .profile-meta input {
    width: 64px;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: Field;
    color: FieldText;
    font-size: 13px;
    text-align: center;
  }

  .editor-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
    overflow: hidden;
    min-height: 0;
  }

  .card-toolbar {
    padding: 10px 16px;
    background: var(--sidebar-bg);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: GrayText;
    flex-shrink: 0;
  }

  .md-label {
    font-size: 12px;
    color: GrayText;
  }

  .unsaved-dot {
    font-size: 12px;
    color: LinkText;
  }

  .md-editor {
    flex: 1;
    min-height: 380px;
    padding: 18px 20px;
    font-family: "Menlo", "Consolas", "Courier New", monospace;
    font-size: 13px;
    line-height: 1.75;
    border: none;
    outline: none;
    resize: none;
    background: Canvas;
    color: CanvasText;
    width: 100%;
  }

  /* ── Action bar ── */

  .action-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 4px;
    flex-shrink: 0;
  }

  .action-spacer {
    flex: 1;
  }

  /* ── Buttons ── */

  .btn {
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background 0.12s,
      border-color 0.12s,
      color 0.12s,
      opacity 0.12s;
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btn-secondary {
    background: transparent;
    color: CanvasText;
    border: 1px solid var(--border);
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--accent-subtle);
    border-color: LinkText;
    color: LinkText;
  }

  .btn-primary {
    background: LinkText;
    color: white;
    border: none;
    padding: 8px 24px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(41, 182, 246, 0.3);
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .btn-primary:disabled {
    box-shadow: none;
  }

  .file-btn {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }
  .file-btn input[type="file"] {
    display: none;
  }

  /* ── Flash messages ── */

  .flash-ok {
    color: #22c55e;
    font-size: 13px;
  }
  .flash-err {
    color: #ef4444;
    font-size: 13px;
  }

  .muted-text {
    color: GrayText;
    font-size: 13px;
    margin: 0;
  }
</style>
