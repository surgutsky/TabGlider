import { describe, it, expect, vi, beforeEach } from 'vitest'
import { debounce } from './events'

describe('debounce', () => {

  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('calls function after delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 500)
    debounced()
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('resets timer on repeated calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 500)
    debounced()
    debounced()
    debounced()
    vi.advanceTimersByTime(499)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('calls function multiple times with sufficient gap', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 500)
    debounced()
    vi.advanceTimersByTime(500)
    debounced()
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(2)
  })

})
