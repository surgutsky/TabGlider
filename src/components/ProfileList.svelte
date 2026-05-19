<script lang="ts">
  import ProfileItem from './ProfileItem.svelte'

  interface Props {
    profiles: Array<{ id: string; name: string }>
    activeProfileId: string
    isSwitching: boolean
    onswitch: (profileId: string) => void
  }

  let { profiles, activeProfileId, isSwitching, onswitch }: Props = $props()
</script>

<div class="wrapper">
  {#if isSwitching}
    <div class="overlay" aria-label="Switching profile…">
      <div class="spinner"></div>
    </div>
  {/if}
  <ul class="list" class:dimmed={isSwitching} aria-busy={isSwitching}>
    {#each profiles as profile (profile.id)}
      <ProfileItem
        {profile}
        isActive={profile.id === activeProfileId}
        onswitch={() => onswitch(profile.id)}
      />
    {/each}
  </ul>
</div>

<style>
  .wrapper {
    position: relative;
    border: 1px solid ButtonBorder;
    border-radius: 8px;
    overflow: hidden;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, Canvas 85%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    backdrop-filter: blur(1px);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid ButtonBorder;
    border-top-color: LinkText;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  .list {
    list-style: none;
    padding: 4px;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: opacity 0.2s;
  }
  .list.dimmed { opacity: 0.4; pointer-events: none; }
</style>
