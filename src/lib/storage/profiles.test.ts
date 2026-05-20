import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { addClosedTab } from './profiles'
import type { Profile } from '../types'

// storageMock holds plain objects just like real chrome.storage.local does
const storageMock: Record<string, unknown> = {}

beforeAll(() => {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        // chrome.storage.local.get accepts a string, string[], or object
        get: vi.fn(async (keys: string | string[]) => {
          const result: Record<string, unknown> = {}
          const keyArr = Array.isArray(keys) ? keys : [keys]
          for (const key of keyArr) result[key] = storageMock[key]
          return result
        }),
        set: vi.fn(async (obj: Record<string, unknown>) => {
          Object.assign(storageMock, obj)
        }),
        remove: vi.fn(async (key: string) => {
          delete storageMock[key]
        }),
      },
    },
  })
})

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-id',
    name: 'Test',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    windows: [],
    closedTabs: [],
    closedTabsLimit: 5,
    ...overrides,
  }
}

describe('addClosedTab', () => {

  beforeEach(() => {
    Object.keys(storageMock).forEach(k => delete storageMock[k])
  })

  it('adds a closed tab', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile()
    await addClosedTab('test-id', 'https://example.com')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs[0].url).toBe('https://example.com')
  })

  it('prepends new tab (most recent first)', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile({
      closedTabs: [{ url: 'https://old.com', closedAt: '2026-01-01 10:00' }],
    })
    await addClosedTab('test-id', 'https://new.com')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs[0].url).toBe('https://new.com')
    expect(profile.closedTabs[1].url).toBe('https://old.com')
  })

  it('removes duplicate and re-adds at top (LRU)', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile({
      closedTabs: [
        { url: 'https://a.com', closedAt: '2026-01-01 10:00' },
        { url: 'https://b.com', closedAt: '2026-01-01 09:00' },
      ],
    })
    await addClosedTab('test-id', 'https://b.com')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs).toHaveLength(2)
    expect(profile.closedTabs[0].url).toBe('https://b.com')
    expect(profile.closedTabs[1].url).toBe('https://a.com')
  })

  it('enforces closedTabsLimit (FIFO eviction)', async () => {
    const closedTabs = Array.from({ length: 5 }, (_, i) => ({
      url: `https://site${i}.com`,
      closedAt: '2026-01-01 10:00',
    }))
    storageMock['tabglider:profile:test-id'] = makeProfile({ closedTabs })
    await addClosedTab('test-id', 'https://new.com')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs).toHaveLength(5)
    expect(profile.closedTabs[0].url).toBe('https://new.com')
    expect(profile.closedTabs[4].url).toBe('https://site3.com')
  })

  it('skips chrome:// URLs', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile()
    await addClosedTab('test-id', 'chrome://newtab')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs).toHaveLength(0)
  })

  it('skips about: URLs', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile()
    await addClosedTab('test-id', 'about:blank')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs).toHaveLength(0)
  })

  it('skips empty URLs', async () => {
    storageMock['tabglider:profile:test-id'] = makeProfile()
    await addClosedTab('test-id', '')
    const profile = storageMock['tabglider:profile:test-id'] as Profile
    expect(profile.closedTabs).toHaveLength(0)
  })

})
