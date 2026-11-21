<script lang="ts">
  import { errorText, t } from '../i18n.svelte';
  import type { MsgKey } from '../../lib/i18n/core';
  /** Style presets (STORY-39): apply built-in or own presets, save the current look, export/import. */
  import { app } from '../state.svelte';
  import {
    BUILTIN_PRESETS,
    loadUserPresets,
    parsePresetsJson,
    presetFromSettings,
    saveUserPresets,
    type Preset,
  } from '../../lib/project/presets';
  import { defaultSettings } from '../../lib/project/project';

  let user = $state<Preset[]>(loadUserPresets());
  // Built-in presets are translated by id; own presets keep the user's name.
  const label = (p: Preset) => (p.builtin ? t(`preset.${p.id}` as MsgKey) : p.name);
  const desc = (p: Preset) => (p.builtin ? t(`preset.${p.id}.desc` as MsgKey) : (p.description ?? ''));
  let name = $state('');

  function apply(p: Preset) {
    app.applySettings(p.settings);
    app.toast(t('preset.applied', { name: label(p) }), 'ok');
  }

  function saveCurrent() {
    const n = name.trim() || t('preset.defaultName', { n: user.length + 1 });
    user = [...user, presetFromSettings(n, app.settings())];
    saveUserPresets(user);
    name = '';
    app.toast(t('preset.saved', { name: n }), 'ok');
  }

  function remove(p: Preset) {
    user = user.filter((x) => x.id !== p.id);
    saveUserPresets(user);
  }

  function exportAll() {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'omap-video-presets.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    try {
      const added = parsePresetsJson(await f.text());
      user = [...user, ...added];
      saveUserPresets(user);
      app.toast(t('preset.imported', { n: added.length }), 'ok');
    } catch (err) {
      app.toast(t('preset.importFailed', { msg: errorText(err) }), 'error');
    }
  }

  function resetAll() {
    const d = defaultSettings();
    app.applySettings({
      free: d.free,
      style: d.style,
      courseStyle: d.courseStyle,
      courseCamera: d.courseCamera,
      routeDisplay: d.routeDisplay,
    });
    app.toast(t('preset.wasReset'));
  }
</script>

<section class="section" data-testid="presets-panel">
  <div class="sec-head">
    <h3 class="sec-title">{t('preset.title')}</h3>
    <button class="btn sm ghost" onclick={resetAll} disabled={app.locked} title={t('preset.resetTitle')}>
      {t('preset.reset')}
    </button>
  </div>
  <div class="grid">
    {#each [...BUILTIN_PRESETS, ...user] as p (p.id)}
      <div class="preset">
        <button
          class="apply"
          onclick={() => apply(p)}
          disabled={app.locked}
          title={desc(p)}
          data-testid="preset-{p.id}"
        >
          <strong>{label(p)}</strong>
          {#if desc(p)}<span class="muted small">{desc(p)}</span>{/if}
        </button>
        {#if !p.builtin}
          <button
            class="btn ghost icon sm del"
            aria-label={t('preset.delete', { name: p.name })}
            onclick={() => remove(p)}
          >
            ✕
          </button>
        {/if}
      </div>
    {/each}
  </div>
  <form
    class="row"
    onsubmit={(e) => {
      e.preventDefault();
      saveCurrent();
    }}
  >
    <input
      type="text"
      placeholder={t('preset.namePlaceholder')}
      bind:value={name}
      aria-label={t('preset.name')}
      data-testid="preset-name"
    />
    <button class="btn sm" type="submit" data-testid="preset-save">{t('preset.save')}</button>
  </form>
  <div class="row2">
    <button class="btn sm ghost" disabled={!user.length} onclick={exportAll}>{t('preset.export')}</button>
    <label class="btn sm ghost">
      {t('preset.import')}
      <input type="file" accept=".json,application/json" hidden onchange={importFile} />
    </label>
  </div>
</section>

<style>
  .grid {
    display: grid;
    gap: 6px;
  }
  .preset {
    position: relative;
  }
  .apply {
    width: 100%;
    text-align: left;
    display: grid;
    gap: 1px;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-input);
  }
  .apply:hover:not(:disabled) {
    border-color: var(--accent);
  }
  .del {
    position: absolute;
    right: 4px;
    top: 6px;
  }
  .row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 6px;
  }
  .row2 {
    display: flex;
    gap: 6px;
  }
</style>
