import type { Profile } from '../types'

export function serializeProfile(profile: Profile): string {
  const lines: string[] = []

  lines.push(`# ${profile.name}`)
  lines.push(`created: ${profile.createdAt}, updated: ${profile.updatedAt}`)

  for (let wi = 0; wi < profile.windows.length; wi++) {
    const win = profile.windows[wi]
    lines.push('')
    lines.push(`## Window ${wi + 1}`)

    const groupMap = new Map(win.groups.map(g => [g.ref, g]))
    let lastGroupRef: string | null | undefined = undefined

    for (const tab of win.tabs) {
      if (tab.groupRef !== lastGroupRef) {
        lastGroupRef = tab.groupRef

        if (tab.groupRef === null) {
          lines.push('### ungrouped')
        } else {
          const g = groupMap.get(tab.groupRef)
          if (g) {
            const collapsed = g.collapsed ? ' [collapsed]' : ''
            lines.push(`### ${g.title} [${g.color}]${collapsed}`)
          }
        }
      }

      lines.push(`${tab.url}${tab.pinned ? ' [pinned]' : ''}${tab.title ? ` | ${tab.title}` : ''}`)
    }
  }

  if (profile.closedTabs.length > 0) {
    lines.push('')
    lines.push('# Closed Tabs')
    for (const ct of profile.closedTabs) {
      lines.push(`${ct.closedAt}, ${ct.url}${ct.title ? ` | ${ct.title}` : ''}`)
    }
  }

  return lines.join('\n') + '\n'
}
