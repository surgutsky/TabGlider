import { describe, it, expect } from 'vitest'
import { parseProfile } from './parser'
import { serializeProfile } from './serializer'
import type { Profile } from '../types'

// parseProfile returns PartialProfile (no id/closedTabsLimit); serializer needs Profile
function toProfile(partial: Omit<Profile, 'id' | 'closedTabsLimit'>): Profile {
  return { ...partial, id: 'test', closedTabsLimit: 200 }
}

describe('serializeProfile', () => {

  it('round-trips a profile with groups and pinned tabs', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### Research [blue]
https://docs.anthropic.com
https://github.com [pinned]
### ungrouped
https://gmail.com [pinned]

# Closed Tabs
2026-05-18 14:32, https://reddit.com`

    const parsed = toProfile(parseProfile(md))
    const serialized = serializeProfile(parsed)
    const reparsed = parseProfile(serialized)

    expect(reparsed.name).toBe(parsed.name)
    expect(reparsed.windows[0].tabs.length).toBe(parsed.windows[0].tabs.length)
    expect(reparsed.windows[0].groups.length).toBe(parsed.windows[0].groups.length)
    expect(reparsed.closedTabs.length).toBe(parsed.closedTabs.length)

    reparsed.windows[0].tabs.forEach((tab, i) => {
      expect(tab.url).toBe(parsed.windows[0].tabs[i].url)
      expect(tab.pinned).toBe(parsed.windows[0].tabs[i].pinned)
    })
  })

  it('round-trips multiple windows', () => {
    const md = `# Personal
created: 2026-03-01, updated: 2026-05-18

## Window 1
### ungrouped
https://github.com

## Window 2
### ungrouped
https://notion.so
https://figma.com`

    const parsed = toProfile(parseProfile(md))
    const reparsed = parseProfile(serializeProfile(parsed))
    expect(reparsed.windows).toHaveLength(2)
    expect(reparsed.windows[1].tabs).toHaveLength(2)
  })

  it('serializes collapsed groups correctly', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### Jira [red] [collapsed]
https://jira.atlassian.com`

    const reparsed = parseProfile(serializeProfile(toProfile(parseProfile(md))))
    expect(reparsed.windows[0].groups[0].collapsed).toBe(true)
  })

})
