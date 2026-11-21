<script lang="ts">
  /** Camera (free mode / leg-by-leg course mode, STORY-24..27) and runner + tail style (STORY-28/29). */
  import { app, SCALE_PRESETS } from '../state.svelte';
  import { courseProblems } from '../../lib/course/course';

  const courseReady = $derived(!!app.passings && courseProblems(app.course).length === 0);
  // Derived: presets and opened projects replace these objects.
  const cam = $derived(app.courseCamera);
  let advanced = $state(false);
  const st = $derived(app.style.track);

  function scaleInput(e: Event, set: (v: number) => void) {
    const v = +(e.currentTarget as HTMLInputElement).value;
    if (Number.isFinite(v) && v >= 500 && v <= 200000) set(v);
  }
</script>

<section class="section" data-testid="camera-panel">
  <div class="sec-head">
    <h3 class="sec-title">Camera</h3>
    <span class="tag" data-testid="camera-mode">{app.courseMode ? 'Leg by leg' : 'Free'}</span>
  </div>
  {#if courseReady}
    <label class="check">
      <input type="checkbox" bind:checked={app.courseModeEnabled} disabled={app.locked} data-testid="course-mode" />
      Leg-by-leg camera: each leg turned so its target is up
    </label>
  {:else}
    <p class="small muted">Set a course and load a GPX to use the leg-by-leg camera.</p>
  {/if}

  {#if app.courseMode}
    <div class="grid2">
      <label class="field">
        <span>Zoom-in limit</span>
        <div class="scale">
          <span class="mono muted">1:</span>
          <input
            type="number"
            min="500"
            step="500"
            value={cam.zoomInLimit}
            disabled={app.locked}
            data-testid="zoom-in-limit"
            onchange={(e) => scaleInput(e, (v) => (cam.zoomInLimit = Math.min(v, cam.zoomOutLimit)))}
          />
        </div>
      </label>
      <label class="field">
        <span>Zoom-out limit</span>
        <div class="scale">
          <span class="mono muted">1:</span>
          <input
            type="number"
            min="500"
            step="500"
            value={cam.zoomOutLimit}
            disabled={app.locked}
            data-testid="zoom-out-limit"
            onchange={(e) => scaleInput(e, (v) => (cam.zoomOutLimit = Math.max(v, cam.zoomInLimit)))}
          />
        </div>
      </label>
    </div>
    <small class="muted">Legs too long for the zoom-out limit pan along with the runner.</small>
    <label class="field">
      <span>Turn duration · {cam.transitionDuration.toFixed(1)} s</span>
      <input type="range" min="0.3" max="4" step="0.1" bind:value={cam.transitionDuration} disabled={app.locked} />
    </label>
    {#if advanced}
      <label class="field">
        <span>Margin around the leg · {Math.round(cam.marginFraction * 100)} %</span>
        <input type="range" min="0" max="0.2" step="0.01" bind:value={cam.marginFraction} disabled={app.locked} />
      </label>
      <label class="field">
        <span>
          Turn starts · {cam.transitionDelay >= 0 ? '+' : ''}{cam.transitionDelay.toFixed(1)} s after the punch
        </span>
        <input type="range" min="-2" max="3" step="0.1" bind:value={cam.transitionDelay} disabled={app.locked} />
      </label>
      <div class="seg" role="group" aria-label="Easing">
        {#each [['sine', 'Smooth'], ['cubic', 'Snappy'], ['linear', 'Linear']] as [v, l] (v)}
          <button
            aria-pressed={cam.easing === v}
            disabled={app.locked}
            onclick={() => (cam.easing = v as typeof cam.easing)}
          >
            {l}
          </button>
        {/each}
      </div>
      <label class="field">
        <span>After the finish</span>
        <select bind:value={cam.afterFinish} disabled={app.locked}>
          <option value="hold">Keep the last leg</option>
          <option value="overview">Zoom out to the whole course</option>
        </select>
      </label>
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={cam.approachEnabled} disabled={app.locked} data-testid="approach" />
      Zoom in when approaching the control
    </label>
    {#if cam.approachEnabled}
      <div class="grid2">
        <label class="field">
          <span>Starts · {cam.approachSeconds} s before</span>
          <input type="range" min="3" max="40" step="1" bind:value={cam.approachSeconds} disabled={app.locked} />
        </label>
        <label class="field">
          <span>Zoom to</span>
          <div class="scale">
            <span class="mono muted">1:</span>
            <input
              type="number"
              min="500"
              step="500"
              value={cam.approachScale}
              disabled={app.locked}
              onchange={(e) => scaleInput(e, (v) => (cam.approachScale = v))}
            />
          </div>
        </label>
      </div>
    {/if}
    <button
      class="btn sm ghost more"
      onclick={() => (advanced = !advanced)}
      aria-expanded={advanced}
      data-testid="camera-advanced"
    >
      {advanced ? 'Fewer settings' : 'More settings…'}
    </button>
  {:else}
    <div class="field">
      <span>Map scale</span>
      <div class="scale3">
        <span class="mono muted">1:</span>
        <input
          type="number"
          min="500"
          max="200000"
          step="500"
          value={app.free.scale}
          disabled={app.locked}
          data-testid="scale"
          onchange={(e) => {
            const v = +(e.currentTarget as HTMLInputElement).value;
            app.free.scale = Math.min(200000, Math.max(500, Number.isFinite(v) ? v : 10000));
          }}
        />
        <select
          aria-label="Scale presets"
          disabled={app.locked}
          value=""
          onchange={(e) => {
            const v = +(e.currentTarget as HTMLSelectElement).value;
            if (v) app.free.scale = v;
            (e.currentTarget as HTMLSelectElement).value = '';
          }}
        >
          <option value="">Presets</option>
          {#each SCALE_PRESETS as s (s)}<option value={s}>1:{s.toLocaleString('en')}</option>{/each}
        </select>
      </div>
      <small class="muted">At 96 px per inch on the preview frame.</small>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={app.free.headingUp} disabled={app.locked} /> Heading up while playing
    </label>
    <label class="field">
      <span>Look-ahead · {Math.round(app.free.lookAhead * 100)} % below centre</span>
      <input type="range" min="0" max="0.4" step="0.05" bind:value={app.free.lookAhead} disabled={app.locked} />
    </label>
  {/if}
</section>

<section class="section" data-testid="runner-panel">
  <div class="sec-head"><h3 class="sec-title">Runner and tail</h3></div>
  <div class="seg" role="group" aria-label="Tail length">
    <button aria-pressed={st.tailMode === 'seconds'} onclick={() => (st.tailMode = 'seconds')}>Seconds</button>
    <button aria-pressed={st.tailMode === 'leg'} onclick={() => (st.tailMode = 'leg')} disabled={!app.courseMode}>
      Current leg
    </button>
    <button aria-pressed={st.tailMode === 'all'} onclick={() => (st.tailMode = 'all')}>Whole route</button>
  </div>
  {#if st.tailMode === 'seconds'}
    <label class="field">
      <span>Tail length · {st.tailSeconds} s</span>
      <input type="range" min="5" max="300" step="5" bind:value={st.tailSeconds} data-testid="tail-seconds" />
    </label>
  {/if}
  <div class="seg" role="group" aria-label="Tail colour">
    <button aria-pressed={st.colorMode === 'pace'} onclick={() => (st.colorMode = 'pace')} data-testid="tail-pace">
      By pace
    </button>
    <button aria-pressed={st.colorMode === 'single'} onclick={() => (st.colorMode = 'single')}>Single colour</button>
  </div>
  {#if st.colorMode === 'pace'}
    <div class="legend small">
      <span class="grad"></span><span class="muted">faster · your median pace · slower/stopped</span>
    </div>
  {:else}
    <label class="row"><span class="small">Tail colour</span><input type="color" bind:value={st.color} /></label>
  {/if}
  <label class="field">
    <span>Line width · {st.width.toFixed(1)} px</span>
    <input type="range" min="2" max="9" step="0.5" bind:value={st.width} />
  </label>
  <label class="check"><input type="checkbox" bind:checked={st.fade} /> Fade the end of the tail</label>
  <label class="check">
    <input type="checkbox" bind:checked={st.showTravelled} /> Show the route already run (faint)
  </label>
  <label class="check"><input type="checkbox" bind:checked={st.showFuture} /> Show the route still to come</label>
  <div class="grid2">
    <label class="field">
      <span>Arrow size · {st.arrowSize} px</span>
      <input type="range" min="8" max="24" step="1" bind:value={st.arrowSize} />
    </label>
    <label class="row"><span class="small">Arrow colour</span><input type="color" bind:value={st.arrowColor} /></label>
  </div>
</section>

<style>
  .more {
    justify-self: start;
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: end;
  }
  .scale {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 4px;
  }
  .scale3 {
    display: grid;
    grid-template-columns: auto 1fr 110px;
    align-items: center;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  input[type='color'] {
    width: 40px;
    height: 26px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: none;
    padding: 0;
  }
  .legend {
    display: grid;
    gap: 4px;
  }
  .grad {
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, rgb(26, 150, 65), rgb(250, 200, 30), rgb(215, 25, 28));
  }
</style>
