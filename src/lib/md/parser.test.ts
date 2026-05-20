import { describe, it, expect } from 'vitest'
import { parseProfile } from './parser'

describe('parseProfile', () => {

  it('parses profile name and dates', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18`
    const profile = parseProfile(md)
    expect(profile.name).toBe('Work')
    expect(profile.createdAt).toBe('2026-01-15')
    expect(profile.updatedAt).toBe('2026-05-18')
  })

  it('parses ungrouped tabs', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### ungrouped
https://github.com
https://gmail.com [pinned]`
    const profile = parseProfile(md)
    expect(profile.windows).toHaveLength(1)
    expect(profile.windows[0].tabs).toHaveLength(2)
    expect(profile.windows[0].tabs[0].url).toBe('https://github.com')
    expect(profile.windows[0].tabs[0].pinned).toBe(false)
    expect(profile.windows[0].tabs[1].url).toBe('https://gmail.com')
    expect(profile.windows[0].tabs[1].pinned).toBe(true)
  })

  it('parses tab groups with color and collapsed', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### Research [blue]
https://docs.anthropic.com
### Jira [red] [collapsed]
https://jira.atlassian.com`
    const profile = parseProfile(md)
    const win = profile.windows[0]
    expect(win.groups).toHaveLength(2)
    expect(win.groups[0].title).toBe('Research')
    expect(win.groups[0].color).toBe('blue')
    expect(win.groups[0].collapsed).toBe(false)
    expect(win.groups[1].title).toBe('Jira')
    expect(win.groups[1].color).toBe('red')
    expect(win.groups[1].collapsed).toBe(true)
    expect(win.tabs[0].groupRef).toBe(win.groups[0].ref)
    expect(win.tabs[1].groupRef).toBe(win.groups[1].ref)
  })

  it('parses multiple windows', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### ungrouped
https://github.com

## Window 2
### ungrouped
https://notion.so`
    const profile = parseProfile(md)
    expect(profile.windows).toHaveLength(2)
    expect(profile.windows[0].tabs[0].url).toBe('https://github.com')
    expect(profile.windows[1].tabs[0].url).toBe('https://notion.so')
  })

  it('parses closed tabs', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

# Closed Tabs
2026-05-18 14:32, https://reddit.com
2026-05-17 09:15, https://youtube.com`
    const profile = parseProfile(md)
    expect(profile.closedTabs).toHaveLength(2)
    expect(profile.closedTabs[0].url).toBe('https://reddit.com')
    expect(profile.closedTabs[0].closedAt).toBe('2026-05-18 14:32')
  })

  it('handles ungrouped appearing multiple times preserving tab order', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

## Window 1
### ungrouped
https://gmail.com [pinned]
### Research [blue]
https://github.com
### ungrouped
https://notion.so`
    const profile = parseProfile(md)
    const tabs = profile.windows[0].tabs
    expect(tabs[0].url).toBe('https://gmail.com')
    expect(tabs[0].groupRef).toBeNull()
    expect(tabs[1].url).toBe('https://github.com')
    expect(tabs[1].groupRef).not.toBeNull()
    expect(tabs[2].url).toBe('https://notion.so')
    expect(tabs[2].groupRef).toBeNull()
  })

  it('creates default window if no ## Window line exists', () => {
    const md = `# Work
created: 2026-01-15, updated: 2026-05-18

### ungrouped
https://github.com`
    const profile = parseProfile(md)
    expect(profile.windows).toHaveLength(1)
    expect(profile.windows[0].tabs).toHaveLength(1)
  })

})
