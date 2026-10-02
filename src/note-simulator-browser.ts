import { NOTE_SEQUENCE, playNote, resetNotes } from './note-sequence.ts';
import { ready } from './dom.ts';
ready(() => document.querySelectorAll<HTMLElement>('[data-note-tool]').forEach((root) => {
  let state = resetNotes();
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-note]');
  const progress = root.querySelector<HTMLElement>('[data-note-progress]')!, status = root.querySelector<HTMLElement>('[data-note-status]')!;
  function render(): void {
    progress.textContent = state.progress ? NOTE_SEQUENCE.slice(0, state.progress).map((note) => `${note} ✓`).join(' → ') : 'No notes played yet.';
    status.textContent = state.error ? `Incorrect note. Expected: ${state.error.expected}. You selected: ${state.error.selected}. Your progress is kept; try the current note again.`
      : state.progress === NOTE_SEQUENCE.length ? `Sequence complete ✓ ${NOTE_SEQUENCE.join(' → ')}`
      : `${state.progress} of 8 correct. Next note: ${NOTE_SEQUENCE[state.progress]}.`;
    buttons.forEach((button) => { button.dataset.played = String(NOTE_SEQUENCE.slice(0, state.progress).includes(Number(button.dataset.note) as typeof NOTE_SEQUENCE[number])); button.disabled = state.progress === NOTE_SEQUENCE.length; });
  }
  buttons.forEach((button) => button.addEventListener('click', () => { state = playNote(state, Number(button.dataset.note)); render(); }));
  root.querySelector<HTMLButtonElement>('[data-note-reset]')!.addEventListener('click', () => { state = resetNotes(); render(); });
  const copy = root.querySelector<HTMLButtonElement>('[data-note-copy]')!, copyStatus = root.querySelector<HTMLElement>('[data-note-copy-status]')!, fallback = root.querySelector<HTMLElement>('[data-note-fallback]')!;
  copy.addEventListener('click', async () => {
    copy.disabled = true; copyStatus.textContent = ''; fallback.hidden = true;
    try { await navigator.clipboard.writeText(NOTE_SEQUENCE.join(' → ')); copyStatus.textContent = 'Sequence copied.'; }
    catch { fallback.hidden = false; const field = fallback.querySelector<HTMLTextAreaElement>('textarea')!; field.focus(); field.select(); copyStatus.textContent = 'Clipboard access is unavailable. Select and copy the sequence manually.'; }
    finally { copy.disabled = false; }
  });
  root.querySelector<HTMLElement>('[data-tool-controls]')!.hidden = false;
}));
