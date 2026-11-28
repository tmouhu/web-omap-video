<script lang="ts">
  import { dist, secs, t } from '../i18n.svelte';
  /** Camera (free mode / leg-by-leg course mode, STORY-24..27) and runner + tail style (STORY-28/29). */
  import { app, SCALE_PRESETS } from '../state.svelte';
  import { courseProblems } from '../../lib/course/course';

  const courseReady = $derived(!!app.passings && courseProblems(app.course).length === 0);
  // Derived: presets and opened projects replace these objects.
  const cam = $derived(app.courseCamera);
  let advanced = $state(false);
  const st = $derived(app.style.track);
  const tb = $derived(app.timeBase);
  /** Slider ranges: real seconds at a high speed need a longer range (values are converted when switching). */
  const k = $derived(tb === 'real' ? Math.max(1, app.speed) : 1);

  function scaleInput(e: Event, set: (v: number) => void) {
    const v = +(e.currentTarget as HTMLInputElement).value;
    if (Number.isFinite(v) && v >= 500 && v <= 200000) set(v);
  }
</script>

<section class="section" data-testid="time-base-panel">
  <div class="sec-head"><h3 class="sec-title">{t('time.title')}</h3></div>
  <div class="seg" role="group" aria-label={t('time.title')}>
    <button
      aria-pressed={tb !== 'real'}
      disabled={app.locked}
      onclick={() => app.setTimeBase('video')}
      data-testid="time-base-video"
    >
      {t('time.video')}
    </button>
    <button
      aria-pressed={tb === 'real'}
      disabled={app.locked}
      onclick={() => app.setTimeBase('real')}
      data-testid="time-base-real"
    >
      {t('time.real')}
    </button>
  </div>
  <small class="muted">{t('time.help')}</small>
</section>

<section class="section" data-testid="camera-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('cam.title')}</h3>
    <span class="tag" data-testid="camera-mode">{app.courseMode ? t('cam.legByLeg') : t('cam.free')}</span>
  </div>
  {#if courseReady}
    <label class="check">
      <input type="checkbox" bind:checked={app.courseModeEnabled} disabled={app.locked} data-testid="course-mode" />
      {t('cam.courseMode')}
    </label>
  {:else}
    <p class="small muted">{t('cam.needCourse')}</p>
  {/if}

  {#if app.courseMode}
    <div class="grid2">
      <label class="field">
        <span>{t('cam.zoomIn')}</span>
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
        <span>{t('cam.zoomOut')}</span>
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
    <small class="muted">{t('cam.panHelp')}</small>
    <div class="field">
      <span>{t('cam.legChange')}</span>
      <div class="seg" role="group" aria-label={t('cam.legChange')}>
        <button
          aria-pressed={cam.legChange !== 'instant'}
          disabled={app.locked}
          onclick={() => (cam.legChange = 'animated')}
          data-testid="leg-change-animated"
        >
          {t('cam.legChangeAnimated')}
        </button>
        <button
          aria-pressed={cam.legChange === 'instant'}
          disabled={app.locked}
          onclick={() => (cam.legChange = 'instant')}
          data-testid="leg-change-instant"
        >
          {t('cam.legChangeInstant')}
        </button>
      </div>
    </div>
    {#if cam.legChange === 'instant'}
      <small class="muted">{t('cam.legChangeHelp')}</small>
    {:else}
      <label class="field">
        <span>{t('cam.turnDuration', { s: secs(cam.transitionDuration, tb) })}</span>
        <input
          type="range"
          min={0.3 * k}
          max={4 * k}
          step={0.1 * k}
          bind:value={cam.transitionDuration}
          disabled={app.locked}
        />
      </label>
    {/if}
    {#if advanced}
      <label class="field">
        <span>{t('cam.margin', { pct: Math.round(cam.marginFraction * 100) })}</span>
        <input type="range" min="0" max="0.2" step="0.01" bind:value={cam.marginFraction} disabled={app.locked} />
      </label>
      <label class="field">
        <span>
          {t(cam.legChange === 'instant' ? 'cam.cutAt' : 'cam.turnStarts', { s: secs(cam.transitionDelay, tb, true) })}
        </span>
        <input
          type="range"
          min={-2 * k}
          max={3 * k}
          step={0.1 * k}
          bind:value={cam.transitionDelay}
          disabled={app.locked}
        />
      </label>
      {#if cam.legChange !== 'instant'}
        <div class="seg" role="group" aria-label={t('cam.easing')}>
          {#each ['sine', 'cubic', 'linear'] as const as v (v)}
            <button aria-pressed={cam.easing === v} disabled={app.locked} onclick={() => (cam.easing = v)}>
              {t(`ease.${v}`)}
            </button>
          {/each}
        </div>
      {/if}
      <label class="field">
        <span>{t('cam.afterFinish')}</span>
        <select bind:value={cam.afterFinish} disabled={app.locked}>
          <option value="hold">{t('cam.hold')}</option>
          <option value="overview">{t('cam.overview')}</option>
        </select>
      </label>
    {/if}
    <div class="field">
      <span>{t('cam.legZoom')}</span>
      <div class="seg" role="group" aria-label={t('cam.legZoom')}>
        <button
          aria-pressed={cam.legZoom !== 'target'}
          disabled={app.locked}
          onclick={() => (cam.legZoom = 'whole')}
          data-testid="leg-zoom-whole"
        >
          {t('cam.legZoomWhole')}
        </button>
        <button
          aria-pressed={cam.legZoom === 'target'}
          disabled={app.locked}
          onclick={() => (cam.legZoom = 'target')}
          data-testid="leg-zoom-target"
        >
          {t('cam.legZoomTarget')}
        </button>
      </div>
    </div>
    {#if cam.legZoom === 'target'}
      <small class="muted">{t('cam.legZoomHelp')}</small>
      <div class="grid2">
        <label class="field">
          <span>{t('cam.legZoomStop')}</span>
          <div class="scale">
            <span class="mono muted">1:</span>
            <input
              type="number"
              min="500"
              step="500"
              value={cam.legZoomStopScale}
              disabled={app.locked}
              data-testid="leg-zoom-stop"
              onchange={(e) => scaleInput(e, (v) => (cam.legZoomStopScale = v))}
            />
          </div>
        </label>
        <label class="field">
          <span>
            {t('cam.legZoomStart', {
              value:
                cam.legZoomStartDistance > 0
                  ? t('cam.legZoomLast', { dist: dist(cam.legZoomStartDistance) })
                  : t('cam.legZoomFromStart'),
            })}
          </span>
          <input
            type="range"
            min="0"
            max="1500"
            step="50"
            bind:value={cam.legZoomStartDistance}
            disabled={app.locked}
          />
        </label>
      </div>
    {:else}
      <label class="check">
        <input type="checkbox" bind:checked={cam.approachEnabled} disabled={app.locked} data-testid="approach" />
        {t('cam.approach')}
      </label>
    {/if}
    {#if cam.approachEnabled && cam.legZoom !== 'target'}
      <div class="grid2">
        <label class="field">
          <span>{t('cam.approachStarts', { s: secs(cam.approachSeconds, tb) })}</span>
          <input
            type="range"
            min={0.5}
            max={40 * k}
            step={0.5}
            bind:value={cam.approachSeconds}
            disabled={app.locked}
          />
        </label>
        <label class="field">
          <span>{t('cam.zoomTo')}</span>
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
      {advanced ? t('cam.fewer') : t('cam.more')}
    </button>
  {:else}
    <div class="field">
      <span>{t('cam.scale')}</span>
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
          aria-label={t('cam.presets')}
          disabled={app.locked}
          value=""
          onchange={(e) => {
            const v = +(e.currentTarget as HTMLSelectElement).value;
            if (v) app.free.scale = v;
            (e.currentTarget as HTMLSelectElement).value = '';
          }}
        >
          <option value="">{t('cam.presetsOption')}</option>
          {#each SCALE_PRESETS as s (s)}<option value={s}>1:{s.toLocaleString('en')}</option>{/each}
        </select>
      </div>
      <small class="muted">{t('cam.dpiHelp')}</small>
    </div>
    <label class="check">
      <input type="checkbox" bind:checked={app.free.headingUp} disabled={app.locked} />
      {t('cam.headingUp')}
    </label>
    {#if app.free.headingUp}
      <label class="field">
        <span>{t('cam.rotationDeadband', { deg: app.free.rotationDeadband })}</span>
        <input
          type="range"
          min="0"
          max="45"
          step="1"
          bind:value={app.free.rotationDeadband}
          disabled={app.locked}
          data-testid="rotation-deadband"
        />
      </label>
      <label class="field">
        <span>{t('cam.rotationSmoothing', { s: secs(app.free.rotationSmoothing, tb) })}</span>
        <input
          type="range"
          min="0"
          max={5 * k}
          step={0.1 * k}
          bind:value={app.free.rotationSmoothing}
          disabled={app.locked}
          data-testid="rotation-smoothing"
        />
      </label>
      <small class="muted">{t('cam.rotationHelp')}</small>
    {/if}
    <label class="field">
      <span>{t('cam.lookAhead', { pct: Math.round(app.free.lookAhead * 100) })}</span>
      <input type="range" min="0" max="0.4" step="0.05" bind:value={app.free.lookAhead} disabled={app.locked} />
    </label>
  {/if}
</section>

<section class="section" data-testid="runner-panel">
  <div class="sec-head"><h3 class="sec-title">{t('run.title')}</h3></div>
  <div class="seg" role="group" aria-label={t('run.tailLength')}>
    <button aria-pressed={st.tailMode === 'seconds'} onclick={() => (st.tailMode = 'seconds')}>
      {t('run.seconds')}
    </button>
    <button aria-pressed={st.tailMode === 'leg'} onclick={() => (st.tailMode = 'leg')} disabled={!app.courseMode}>
      {t('run.leg')}
    </button>
    <button aria-pressed={st.tailMode === 'all'} onclick={() => (st.tailMode = 'all')}>{t('run.all')}</button>
  </div>
  {#if st.tailMode === 'seconds'}
    <label class="field">
      <span>{t('run.tailSeconds', { s: secs(st.tailSeconds, tb) })}</span>
      <input type="range" min="1" max={300 * k} step="1" bind:value={st.tailSeconds} data-testid="tail-seconds" />
    </label>
  {/if}
  <div class="seg" role="group" aria-label={t('run.tailColour')}>
    <button aria-pressed={st.colorMode === 'pace'} onclick={() => (st.colorMode = 'pace')} data-testid="tail-pace">
      {t('run.byPace')}
    </button>
    <button aria-pressed={st.colorMode === 'single'} onclick={() => (st.colorMode = 'single')}>
      {t('run.single')}
    </button>
  </div>
  {#if st.colorMode === 'pace'}
    <div class="legend small">
      <span class="grad"></span><span class="muted">{t('run.legend')}</span>
    </div>
  {:else}
    <label class="row">
      <span class="small">{t('run.tailColour')}</span><input type="color" bind:value={st.color} />
    </label>
  {/if}
  <label class="field">
    <span>{t('run.width', { px: st.width.toFixed(1) })}</span>
    <input type="range" min="2" max="9" step="0.5" bind:value={st.width} />
  </label>
  <label class="check"><input type="checkbox" bind:checked={st.fade} /> {t('run.fade')}</label>
  <label class="check">
    <input type="checkbox" bind:checked={st.showTravelled} />
    {t('run.travelled')}
  </label>
  <label class="check"><input type="checkbox" bind:checked={st.showFuture} /> {t('run.future')}</label>
  <div class="field">
    <span>{t('run.marker')}</span>
    <div class="seg" role="group" aria-label={t('run.marker')}>
      <button aria-pressed={st.marker !== 'circle'} onclick={() => (st.marker = 'arrow')} data-testid="marker-arrow">
        {t('run.markerArrow')}
      </button>
      <button aria-pressed={st.marker === 'circle'} onclick={() => (st.marker = 'circle')} data-testid="marker-circle">
        {t('run.markerCircle')}
      </button>
    </div>
  </div>
  {#if st.marker === 'circle'}
    <label class="check">
      <input type="checkbox" bind:checked={st.markerRing} data-testid="marker-ring" />
      {t('run.markerRing')}
    </label>
  {/if}
  <div class="grid2">
    <label class="field">
      <span>{t('run.arrowSize', { px: st.arrowSize })}</span>
      <input type="range" min="8" max="24" step="1" bind:value={st.arrowSize} />
    </label>
    <label class="row">
      <span class="small">{t('run.arrowColour')}</span><input type="color" bind:value={st.arrowColor} />
    </label>
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
