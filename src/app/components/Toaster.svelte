<script lang="ts">
  import { t } from '../i18n.svelte';
  /** Non-blocking notifications (STORY-37). */
  import { app } from '../state.svelte';
</script>

<div class="toasts" role="status" aria-live="polite" data-testid="toasts">
  {#each app.toasts as toast (toast.id)}
    <div class="toast {toast.kind}">
      <span>{toast.text}</span>
      <button
        class="btn ghost icon sm"
        aria-label={t('common.dismiss')}
        onclick={() => (app.toasts = app.toasts.filter((x) => x.id !== toast.id))}
      >
        ✕
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    right: 18px;
    bottom: 82px;
    display: grid;
    gap: 8px;
    z-index: 50;
    max-width: 380px;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 10px 14px;
    border-radius: 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border-strong);
    box-shadow: var(--shadow);
    font-size: 13px;
    animation: in 0.18s ease-out;
  }
  .toast.ok {
    border-left: 3px solid var(--ok);
  }
  .toast.error {
    border-left: 3px solid var(--danger);
  }
  @keyframes in {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
