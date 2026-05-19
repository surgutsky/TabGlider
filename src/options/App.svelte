<script lang="ts">
  import { getSettings, setSettings } from '../lib/storage'
  import { getAllProfiles, getIndex, deleteProfile, setIndex } from '../lib/storage'
  import { serializeProfile } from '../lib/md/serializer'
  import { parseProfile } from '../lib/md/parser'
  import type { Settings, Profile } from '../lib/types'

  let settings = $state<Settings>({ closedTabsLimit: 200 })
  let profiles = $state<Profile[]>([])
  let saved = $state(false)
  let error = $state('')

  $effect(() => {
    loadAll()
  })

  async function loadAll() {
    const [s, profs] = await Promise.all([getSettings(), getAllProfiles()])
    settings = s
    profiles = profs
  }

  async function saveSettings() {
    error = ''
    try {
      await setSettings(settings)
      saved = true
      setTimeout(() => (saved = false), 2000)
    } catch (e) {
      error = String(e)
    }
  }

  function exportProfile(profile: Profile) {
    const md = serializeProfile(profile)
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${profile.id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importProfile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = parseProfile(text)
      const { slugify } = await import('../lib/storage/profiles')
      const id = slugify(parsed.name)
      const now = new Date().toISOString().slice(0, 10)
      const profile: Profile = { ...parsed, id }
      const index = await getIndex()
      if (!index) throw new Error('No index found')
      const exists = index.profiles.some(p => p.id === id)
      if (!exists) {
        await setIndex({
          ...index,
          profiles: [...index.profiles, { id, name: parsed.name, createdAt: now }],
        })
      }
      const { setProfile } = await import('../lib/storage/profiles')
      await setProfile(profile)
      await loadAll()
    } catch (err) {
      error = String(err)
    }
  }

  async function removeProfile(id: string) {
    if (!confirm('Delete this profile?')) return
    const index = await getIndex()
    if (!index) return
    await deleteProfile(id)
    await setIndex({ ...index, profiles: index.profiles.filter(p => p.id !== id) })
    await loadAll()
  }
</script>

<main>
  <h1>TabGlider — Options</h1>

  <section>
    <h2>Settings</h2>
    <label>
      Closed tabs history limit
      <input type="number" min="0" max="1000" bind:value={settings.closedTabsLimit} />
    </label>
    <div class="row">
      <button onclick={saveSettings}>Save</button>
      {#if saved}<span class="ok">Saved!</span>{/if}
      {#if error}<span class="error">{error}</span>{/if}
    </div>
  </section>

  <section>
    <h2>Profiles</h2>
    {#if profiles.length === 0}
      <p class="muted">No profiles yet.</p>
    {:else}
      <table>
        <thead><tr><th>Name</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>
          {#each profiles as p}
            <tr>
              <td>{p.name}</td>
              <td>{p.createdAt}</td>
              <td class="actions">
                <button onclick={() => exportProfile(p)}>Export .md</button>
                <button class="danger" onclick={() => removeProfile(p.id)}>Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    <div class="row">
      <label class="file-label">
        Import .md
        <input type="file" accept=".md" onchange={importProfile} />
      </label>
    </div>
  </section>
</main>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) { margin: 0; font-family: system-ui, sans-serif; background: #fafafa; color: #111; }

  main { max-width: 680px; margin: 0 auto; padding: 32px 24px; }
  h1 { font-size: 22px; margin-bottom: 24px; }
  h2 { font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  section { margin-bottom: 36px; }

  label { display: flex; flex-direction: column; gap: 4px; font-size: 14px; max-width: 300px; }
  input[type="number"] { padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; width: 100px; }

  .row { display: flex; align-items: center; gap: 10px; margin-top: 12px; }

  button {
    padding: 6px 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
  }
  button:hover { background: #f0f0f0; }
  button.danger { border-color: #f99; color: #c00; }
  button.danger:hover { background: #fff0f0; }

  .ok { color: #080; font-size: 13px; }
  .error { color: #c00; font-size: 13px; }
  .muted { color: #888; font-size: 13px; }

  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee; }
  th { font-weight: 600; background: #f5f5f5; }

  .actions { display: flex; gap: 6px; }

  .file-label {
    display: inline-block;
    padding: 6px 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
  }
  .file-label input[type="file"] { display: none; }
  .file-label:hover { background: #f0f0f0; }
</style>
