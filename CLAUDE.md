# TabGlider

Chrome extension (MV3) that lets users create named tab profiles. Each profile stores the current open tabs and Chrome tab groups. Switching profiles closes all current tabs and restores the target profile's tabs and groups.

## Stack

- Manifest V3
- Svelte 5 (runes only — `$state`, `$derived`, `$effect`)
- TypeScript strict
- Vite + @crxjs/vite-plugin
- No UI component libraries

## Type Definitions

```typescript
interface SavedTab {
  url: string
  groupRef: string | null   // UUID ref to SavedGroup; null = ungrouped
  pinned: boolean
}

interface SavedGroup {
  ref: string               // UUID (not Chrome's numeric group id)
  title: string
  color: chrome.tabGroups.ColorEnum
  collapsed: boolean
}

interface SavedWindow {
  ref: string               // UUID
  left: number
  top: number
  width: number
  height: number
  state: 'normal' | 'maximized' | 'minimized' | 'fullscreen'
  tabs: SavedTab[]          // flat ordered array for this window
  groups: SavedGroup[]
}

interface ClosedTab {
  url: string
  closedAt: string          // "YYYY-MM-DD HH:mm"
}

interface Profile {
  id: string                // slugified name e.g. "work"
  name: string
  createdAt: string         // "YYYY-MM-DD"
  updatedAt: string         // "YYYY-MM-DD"
  windows: SavedWindow[]
  closedTabs: ClosedTab[]   // max 200 entries, FIFO
}

interface ProfilesIndex {
  activeProfileId: string
  profiles: Array<{ id: string; name: string; createdAt: string }>
}

interface Settings {
  closedTabsLimit: number   // default 200
}
```

## Storage Keys (`chrome.storage.local`)

| Key | Value |
|-----|-------|
| `tabglider:index` | `ProfilesIndex` JSON |
| `tabglider:profile:{id}` | `Profile` JSON |
| `tabglider:settings` | `Settings` JSON |

All access goes through `src/lib/storage/`. Never call `chrome.storage` directly from UI or background without going through the lib.

## Profile Switching Algorithm

Implemented in `src/lib/tabs/restore.ts` (steps 3–8) and `src/background/index.ts` (`handleSwitchProfile`, steps 1–2, 9–10).

1. Set `isSwitchingRef.value = true` (suppresses autosave)
2. Save current profile snapshot via `captureAllWindows` + `patchProfile` + `setProfile`
3. Open switching page (`switching/index.html`) in the first normal window — acts as visual anchor
4. Close all tabs in all normal windows except the switching tab (empty windows close automatically)
5. For each `SavedWindow` in profile: first window reuses the existing window; subsequent windows are created via `chrome.windows.create`
6. Within each window: open tabs in order (pinned first, then unpinned)
7. Recreate groups: for each `SavedGroup`, call `chrome.tabs.group({ tabIds })` → get Chrome numeric id, then `chrome.tabGroups.update(id, { title, color })`
8. Restore collapsed state: `chrome.tabGroups.update(id, { collapsed: true })` if `SavedGroup.collapsed`
9. Close the switching page tab
10. Set `isSwitchingRef.value = false`
11. Update `activeProfileId` in the index

`isSwitchingRef.value` suppresses autosave during steps 1–9 (finally block resets it).
Debounce 500ms. See `src/lib/tabs/events.ts`.

## UI Layers

| Layer | Entry | Purpose |
|-------|-------|---------|
| Side Panel | `src/sidepanel/` | Main UI — profile list, quick actions |
| Quick Switcher | `src/quickswitcher/` | Keyboard-triggered overlay (content script) |
| Options Page | `src/options/` | Settings, export/import, profile management |
| Switching Page | `src/switching/` | Spinner shown during profile switch |

## MD Format (Import / Export)

```markdown
# ProfileName
created: YYYY-MM-DD, updated: YYYY-MM-DD

## Window 1
### Research [blue]
https://github.com/user/repo
https://example.com [pinned]

### ungrouped
https://gmail.com [pinned]

## Window 2
### ungrouped
https://notion.so

# Closed Tabs
YYYY-MM-DD HH:mm, https://example.com
```

Rules:
- `#` at top level: profile name (or `Closed Tabs` section)
- `## Window N`: window separator — N is sequential number (1-based)
- `###`: group header — color is required in `[brackets]`, `[collapsed]` is optional
- `### ungrouped`: tabs with no group; ordering reflects real browser tab order
- Bare URL lines: tabs in the current group context
- `[pinned]` at end of URL line
- Valid colors: `grey blue red yellow green pink purple cyan orange`

## Notes

- The switching page URL (`switching/index.html`) must match the crxjs build output path. Verify on first build — it may need adjustment if crxjs nests the path differently.
- Pinned tabs cannot be assigned to groups; they are always ungrouped.
- `chrome://` and `about:` URLs are skipped during capture — they cannot be programmatically opened.
- `closedTabs` is capped at `settings.closedTabsLimit` (default 200) using FIFO eviction.
