<script lang="ts">
  interface Props {
    profile: { id: string; name: string }
    isActive: boolean
    onswitch: () => void
  }

  let { profile, isActive, onswitch }: Props = $props()
</script>

<li class:active={isActive} onclick={!isActive ? onswitch : undefined}>
  <span class="check" aria-hidden="true">{isActive ? '✓' : ''}</span>
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

  li:not(.active):hover { background: ButtonFace; }

  .check {
    width: 14px;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 700;
    color: LinkText;
    text-align: center;
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
