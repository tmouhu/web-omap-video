<script lang="ts">
  /** Bottom transport bar (STORY-3): play/pause, reset, scrubber, time, speed. */
  import { app, SPEED_PRESETS } from '../state.svelte';
  import { formatClock, formatDuration } from '../../lib/format';

  const duration = $derived(app.track?.duration ?? 0);
  const progress = $derived(duration > 0 ? (app.time / duration) * 100 : 0);

  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement;
    if (el.closest('input, select, textarea') && !(el instanceof HTMLInputElement && el.type === 'range')) return;
    if (!app.track || app.exporting) return;
    const big = e.shiftKey ? 10 : 1;
    if (e.code === 'Space') {
      e.preventDefault();
      app.togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      app.seek(app.time + big);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      app.seek(app.time - big);
    } else if (e.key === '.') app.seek(app.time + app.speed / app.exportFps);
    else if (e.key === ',') app.seek(app.time - app.speed / app.exportFps);
    else if (e.key === 'Home') app.seek(0);
  }
</script>

<svelte:window onkeydown={onKey} />

<footer class="bar" aria-label="Playback">
  <div class="transport">
    <button
      class="btn icon ghost"
      title="Back to start (Home)"
      aria-label="Back to start"
      disabled={!app.track || app.exporting}
      onclick={() => {
        app.playing = false;
        app.seek(0);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>
    </button>
    <button
      class="play"
      title={app.playing ? 'Pause (Space)' : 'Play (Space)'}
      aria-label={app.playing ? 'Pause' : 'Play'}
      data-testid="play"
      disabled={!app.track || app.exporting}
      onclick={() => app.togglePlay()}
    >
      {#if app.playing}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
      {/if}
    </button>
  </div>

  <div class="time mono" data-testid="time">
    {formatDuration(app.time)} <span class="muted">/ {formatDuration(duration)}</span>
  </div>

  <div class="scrub" style:--p="{progress}%">
    <input
      type="range"
      min="0"
      max={duration || 1}
      step="0.1"
      value={app.time}
      disabled={!app.track || app.exporting}
      aria-label="Timeline"
      data-testid="timeline"
      oninput={(e) => app.seek(+(e.currentTarget as HTMLInputElement).value)}
    />
  </div>

  <div class="clock mono muted" title="Clock time of the GPX at the playhead">
    {app.track?.startTime ? formatClock(app.track.startTime + app.time * 1000) : '--:--:--'}
  </div>

  <div class="seg" role="group" aria-label="Playback speed">
    {#each SPEED_PRESETS as s (s)}
      <button aria-pressed={app.speed === s} disabled={app.exporting} onclick={() => (app.speed = s)}>{s}×</button>
    {/each}
  </div>
</footer>

<style>
  .bar {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: center;
    gap: 16px;
    padding: 10px 18px;
    border-top: 1px solid var(--border);
    background: var(--bg-elev);
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .play {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    color: #1a0d05;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 14px rgba(255, 106, 43, 0.35);
  }
  .play:hover:not(:disabled) {
    background: var(--accent-strong);
  }
  .time {
    font-size: 13px;
    min-width: 128px;
  }
  .clock {
    font-size: 12px;
  }
  .scrub input {
    height: 22px;
  }
</style>
