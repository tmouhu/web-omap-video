<script lang="ts">
  import { t } from '../i18n.svelte';
  /** Keyboard shortcut cheat sheet (STORY-37), opened with "?". */
  import { app } from '../state.svelte';

  let dialog: HTMLDialogElement;
  $effect(() => {
    if (app.showShortcuts) dialog.showModal();
    else if (dialog.open) dialog.close();
  });
  const groups: [string, [string, string][]][] = $derived([
    [
      t('sc.playback'),
      [
        [t('sc.space'), t('sc.playPause')],
        ['← / →', t('sc.seek')],
        [', / .', t('sc.frame')],
        ['[ / ]', t('sc.control')],
        ['Home', t('sc.home')],
      ],
    ],
    [
      t('sc.range'),
      [
        ['I', t('sc.rangeIn')],
        ['O', t('sc.rangeOut')],
      ],
    ],
    [
      t('sc.editing'),
      [
        ['⌘/Ctrl Z', t('app.undo')],
        ['⇧⌘/Ctrl Z', t('app.redo')],
        ['Delete', t('sc.delete')],
        ['Enter', t('sc.enter')],
        ['Esc', t('sc.esc')],
      ],
    ],
    [
      t('sc.map'),
      [
        [t('sc.drag'), t('sc.pan')],
        [t('sc.wheel'), t('sc.zoom')],
        [t('sc.rotateKey'), t('sc.rotate')],
        [t('sc.corner'), t('sc.resize')],
      ],
    ],
  ]);
</script>

<dialog
  bind:this={dialog}
  onclose={() => (app.showShortcuts = false)}
  aria-labelledby="sc-title"
  data-testid="shortcuts-dialog"
>
  <header>
    <h2 id="sc-title">{t('sc.title')}</h2>
    <button class="btn ghost icon" aria-label={t('common.close')} onclick={() => (app.showShortcuts = false)}>✕</button>
  </header>
  <div class="cols">
    {#each groups as [title, rows] (title)}
      <section>
        <h3>{title}</h3>
        <dl>
          {#each rows as [k, v] (k)}<dt><kbd>{k}</kbd></dt>
            <dd>{v}</dd>{/each}
        </dl>
      </section>
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: min(720px, calc(100vw - 32px));
    border: 1px solid var(--border-strong);
    border-radius: 16px;
    background: var(--bg-elev);
    color: var(--text);
    padding: 20px 22px;
  }
  dialog::backdrop {
    background: rgba(5, 7, 10, 0.6);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 18px;
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 28px;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin: 14px 0 6px;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 5px 12px;
    margin: 0;
    font-size: 13px;
  }
  dd {
    margin: 0;
  }
  kbd {
    font-family: var(--mono);
    font-size: 11.5px;
    padding: 1px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 5px;
    background: var(--bg-input);
    white-space: nowrap;
  }
</style>
