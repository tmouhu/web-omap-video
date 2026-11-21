<script lang="ts">
  import { app } from './state.svelte';
  import MapStage from './components/MapStage.svelte';
  import Inspector from './components/Inspector.svelte';
  import TimelineBar from './components/TimelineBar.svelte';
</script>

<div class="shell">
  <header class="top">
    <div class="brand">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="var(--accent)" stroke-width="2.2" /><path
          d="M12 6.5 16 15l-4-2-4 2z"
          fill="var(--accent)"
        />
      </svg>
      <span>OMap Video</span>
    </div>
    <div class="title">{app.track?.name ?? 'No track loaded'}</div>
    <div class="right muted">Local only · nothing is uploaded</div>
  </header>
  <main class="main">
    <MapStage />
    <Inspector />
  </main>
  <TimelineBar />
</div>

<style>
  .shell {
    height: 100%;
    display: grid;
    grid-template-rows: 52px 1fr auto;
    min-width: 1024px;
  }
  .top {
    display: grid;
    grid-template-columns: 240px 1fr 240px;
    align-items: center;
    padding: 0 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }
  .title {
    text-align: center;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .right {
    text-align: right;
    font-size: 12px;
  }
  .main {
    display: grid;
    grid-template-columns: 1fr 340px;
    min-height: 0;
  }
</style>
