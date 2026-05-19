import { mount, unmount } from 'svelte'
import QuickSwitcher from './QuickSwitcher.svelte'

type SvelteApp = ReturnType<typeof mount>

let app: SvelteApp | null = null
let host: HTMLElement | null = null

chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'OPEN_QUICK_SWITCHER') {
    openSwitcher()
  }
})

function openSwitcher(): void {
  if (app) {
    closeSwitcher()
    return
  }

  host = document.createElement('div')
  host.id = 'tabglider-quick-switcher-root'
  document.body.appendChild(host)

  app = mount(QuickSwitcher, {
    target: host,
    props: { onclose: closeSwitcher },
  })
}

function closeSwitcher(): void {
  if (app) {
    unmount(app)
    app = null
  }
  host?.remove()
  host = null
}
