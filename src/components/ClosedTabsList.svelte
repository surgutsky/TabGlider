<script lang="ts">
  import type { ClosedTab } from '../lib/types'

  interface Props {
    closedTabs: ClosedTab[]
    onreopen: (url: string) => void
  }

  let { closedTabs, onreopen }: Props = $props()

  let recent = $derived(closedTabs.slice(0, 10))

  function domain(url: string): string {
    try { return new URL(url).hostname } catch { return url }
  }

  function faviconSrc(url: string): string {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain(url))}&sz=16`
  }

  function hideBrokenFavicon(e: Event) {
    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
  }
</script>

{#if recent.length === 0}
  <p class="empty">No recently closed tabs</p>
{:else}
  <ul class="list">
    {#each recent as tab (tab.closedAt + tab.url)}
      <li>
        <button class="tab-btn" onclick={() => onreopen(tab.url)} title={tab.url}>
          <img
            class="favicon"
            src={faviconSrc(tab.url)}
            alt=""
            width="16"
            height="16"
            onerror={hideBrokenFavicon}
          />
          <span class="url">{tab.url}</span>
          <span class="time">{tab.closedAt.slice(11)}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty {
    margin: 0;
    font-size: 13px;
    color: GrayText;
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
    background: none;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 5px 4px;
    text-align: left;
    color: CanvasText;
    transition: background 0.1s;
  }
  .tab-btn:hover { background: ButtonFace; }

  .favicon {
    flex-shrink: 0;
    border-radius: 2px;
  }

  .url {
    flex: 1;
    font-size: 12px;
    color: GrayText;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 0.1s;
  }
  .tab-btn:hover .url { color: CanvasText; }

  .time {
    flex-shrink: 0;
    font-size: 11px;
    color: GrayText;
    opacity: 0.7;
  }
</style>
