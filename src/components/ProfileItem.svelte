<script lang="ts">
  interface Props {
    profile: { id: string; name: string };
    isActive: boolean;
    onswitch: () => void;
  }

  let { profile, isActive, onswitch }: Props = $props();
</script>

<li class:active={isActive} onclick={!isActive ? onswitch : undefined}>
  <span class="dot" class:dot-active={isActive} aria-hidden="true"></span>
  <span class="name">{profile.name}</span>
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border-radius: 6px;
    transition: background 0.1s;
    cursor: default;
  }

  li:not(.active) {
    cursor: pointer;
  }

  li:not(.active):hover {
    background: var(--accent-subtle);
  }

  li.active {
    background: var(--accent-subtle);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--border);
    transition:
      background 0.12s,
      box-shadow 0.12s;
  }
  .dot.dot-active {
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-subtle);
  }

  .name {
    flex: 1;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  li.active .name {
    font-weight: 600;
    color: LinkText;
  }
</style>
