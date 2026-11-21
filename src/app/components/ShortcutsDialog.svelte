<script lang="ts">
  /** Keyboard shortcut cheat sheet (STORY-37), opened with "?". */
  import { app } from '../state.svelte';

  let dialog: HTMLDialogElement;
  $effect(() => {
    if (app.showShortcuts) dialog.showModal();
    else if (dialog.open) dialog.close();
  });
  const groups: [string, [string, string][]][] = [
    [
      'Playback',
      [
        ['Space', 'Play / pause'],
        ['← / →', '1 s back / forward (Shift: 10 s)'],
        [', / .', 'One frame back / forward'],
        ['[ / ]', 'Previous / next control'],
        ['Home', 'Back to the start'],
      ],
    ],
    [
      'Export range',
      [
        ['I', 'Range starts at the playhead'],
        ['O', 'Range ends at the playhead'],
      ],
    ],
    [
      'Editing',
      [
        ['⌘/Ctrl Z', 'Undo'],
        ['⇧⌘/Ctrl Z', 'Redo'],
        ['Delete', 'Remove the selected control / track point'],
        ['Enter', 'Finish the course, route or redraw'],
        ['Esc', 'Cancel / leave the tool'],
      ],
    ],
    [
      'Map',
      [
        ['Drag', 'Pan'],
        ['Wheel', 'Zoom'],
        ['Alt+Shift drag', 'Rotate'],
        ['Frame corner', 'Resize the frame (Shift keeps the ratio)'],
      ],
    ],
  ];
</script>

<dialog
  bind:this={dialog}
  onclose={() => (app.showShortcuts = false)}
  aria-labelledby="sc-title"
  data-testid="shortcuts-dialog"
>
  <header>
    <h2 id="sc-title">Keyboard shortcuts</h2>
    <button class="btn ghost icon" aria-label="Close" onclick={() => (app.showShortcuts = false)}>✕</button>
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
