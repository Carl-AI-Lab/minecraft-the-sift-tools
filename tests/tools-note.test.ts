import test from 'node:test';
import assert from 'node:assert/strict';
import { playNote, resetNotes } from '../src/note-sequence.ts';
test('an incorrect note reports the expected note and preserves earlier progress', () => {
  let state = resetNotes();
  for (const note of [1, 3, 7]) state = playNote(state, note);
  const wrong = playNote(state, 4);
  assert.equal(wrong.progress, 3);
  assert.deepEqual(wrong.error, { expected: 6, selected: 4 });
  assert.equal(state.error, null);
  assert.deepEqual(playNote(wrong, 6), { progress: 4, error: null });
});
test('the author sequence completes once and reset starts a new rehearsal', () => {
  let state = resetNotes();
  for (const note of [1, 3, 7, 6, 5, 2, 4, 8]) state = playNote(state, note);
  assert.equal(state.progress, 8);
  assert.deepEqual(playNote(state, 1), state);
  assert.deepEqual(resetNotes(), { progress: 0, error: null });
});
