<script lang="ts">
  /** Bottom transport bar (STORY-3): play/pause, reset, scrubber, time, speed. */
  import { app, SPEED_PRESETS } from '../state.svelte';
  import { formatClock, formatDuration } from '../../lib/format';
  import { pointLabel } from '../../lib/course/course';

  let scrubEl: HTMLDivElement;
  /** Marker being dragged: point id and its tentative time. */
  let dragging = $state<{ id: string; t: number } | null>(null);
  const THUMB = 8; // half the range thumb width: the track runs from THUMB to width − THUMB

  const pos = (t: number) => `calc(${THUMB}px + (100% - ${2 * THUMB}px) * ${duration > 0 ? t / duration : 0})`;

  function timeAt(clientX: number): number {
    const r = scrubEl.getBoundingClientRect();
    const f = (clientX - r.left - THUMB) / Math.max(1, r.width - 2 * THUMB);
    return Math.min(duration, Math.max(0, f * duration));
  }

  function markerDown(e: PointerEvent, id: string, t: number) {
    if (app.exporting) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = { id, t };
  }
  function markerMove(e: PointerEvent) {
    if (!dragging) return;
    dragging = { ...dragging, t: timeAt(e.clientX) };
    app.seek(dragging.t);
  }
  function markerUp() {
    if (!dragging) return;
    app.courseError = app.setPassing(dragging.id, dragging.t) ?? '';
    dragging = null;
  }

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
    else if ((e.key === '[' || e.key === ']') && app.passings) {
      const ts = app.passings.map((p) => p.t);
      const t =
        e.key === ']' ? ts.find((x) => x > app.time + 0.05) : [...ts].reverse().find((x) => x < app.time - 0.05);
      if (t !== undefined) app.seek(t);
    }
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

  <div class="scrub" style:--p="{progress}%" bind:this={scrubEl}>
    {#if app.editRange[0] !== null && app.editRange[1] !== null}
      {@const a = Math.min(app.editRange[0], app.editRange[1])}
      {@const b = Math.max(app.editRange[0], app.editRange[1])}
      <div
        class="range"
        style:left={pos(a)}
        style:width="calc((100% - {2 * THUMB}px) * {duration ? (b - a) / duration : 0})"
      ></div>
    {/if}
    {#if app.passings && app.course}
      <div class="marks" data-testid="timeline-marks">
        {#each app.passings as p, i (p.pointId)}
          {@const t = dragging?.id === p.pointId ? dragging.t : p.t}
          <button
            class="mark {p.status}"
            class:drag={dragging?.id === p.pointId}
            style:left={pos(t)}
            title="{pointLabel(app.course, i)} · {formatDuration(t)} – drag to adjust"
            data-testid="mark-{i}"
            onpointerdown={(e) => markerDown(e, p.pointId, p.t)}
            onpointermove={markerMove}
            onpointerup={markerUp}
            onpointercancel={() => (dragging = null)}
          >
            {pointLabel(app.course, i)}
          </button>
        {/each}
      </div>
    {/if}
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

  <button
    class="btn sm vv"
    class:on={app.followFrame}
    aria-pressed={app.followFrame}
    title="Video view: when paused, show exactly the video frame at the playhead (off: free north-up map)"
    data-testid="video-view"
    onclick={() => (app.followFrame = !app.followFrame)}
  >
    🎥 Video view
  </button>
  <div class="seg" role="group" aria-label="Playback speed">
    {#each SPEED_PRESETS as s (s)}
      <button aria-pressed={app.speed === s} disabled={app.exporting} onclick={() => (app.speed = s)}>{s}×</button>
    {/each}
  </div>
</footer>

<style>
  .bar {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto auto;
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
  .vv.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .scrub {
    position: relative;
    padding-top: 16px;
  }
  .scrub input {
    height: 22px;
  }
  .marks {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 16px;
  }
  .mark {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    min-width: 16px;
    height: 15px;
    padding: 0 3px;
    border-radius: 4px;
    border: 1px solid #bb29bb;
    background: var(--bg-elev);
    color: #e07ae0;
    font: 700 9.5px/13px var(--font);
    cursor: ew-resize;
    touch-action: none;
  }
  .mark.manual {
    border-color: var(--warn);
    color: var(--warn);
  }
  .mark.not-found,
  .mark.start-of-track,
  .mark.end-of-track {
    border-style: dashed;
    opacity: 0.75;
  }
  .mark.drag {
    background: var(--accent);
    color: #1a0d05;
  }
  .range {
    position: absolute;
    top: 20px;
    height: 14px;
    border-radius: 4px;
    background: rgba(47, 128, 255, 0.35);
    pointer-events: none;
  }
</style>
