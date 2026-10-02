export const NOTE_SEQUENCE = [1, 3, 7, 6, 5, 2, 4, 8] as const;
export interface NoteState { progress: number; error: { expected: number; selected: number } | null }
export function resetNotes(): NoteState { return { progress: 0, error: null }; }
export function playNote(state: NoteState, note: number): NoteState {
  const expected = NOTE_SEQUENCE[state.progress];
  if (expected === undefined) return state;
  return note === expected ? { progress: state.progress + 1, error: null }
    : { progress: state.progress, error: { expected, selected: note } };
}
