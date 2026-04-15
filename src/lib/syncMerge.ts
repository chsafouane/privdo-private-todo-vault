import type { Task } from '@/types';

/**
 * Merge two task arrays using field-level last-write-wins.
 * Tombstone-aware: handles delete vs edit conflicts correctly.
 */
export function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const localMap = new Map(local.map(t => [t.id, t]));
  const remoteMap = new Map(remote.map(t => [t.id, t]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged: Task[] = [];

  for (const id of allIds) {
    const L = localMap.get(id);
    const R = remoteMap.get(id);

    if (!L && R) { merged.push(R); continue; }
    if (L && !R) { merged.push(L); continue; }
    if (!L || !R) continue; // impossible, but satisfies TS

    const localNewer = L.updatedAt >= R.updatedAt;
    const winner = localNewer ? L : R;

    merged.push({
      id,
      text: winner.text,
      completed: winner.completed,
      deadline: winner.deadline,
      createdAt: Math.min(L.createdAt, R.createdAt),
      updatedAt: Math.max(L.updatedAt, R.updatedAt),
      deletedAt: mergeDeletedAt(L, R),
    });
  }

  return merged;
}

function mergeDeletedAt(L: Task, R: Task): number | undefined {
  if (!L.deletedAt && !R.deletedAt) return undefined;
  if (L.deletedAt && R.deletedAt) return Math.min(L.deletedAt, R.deletedAt);

  // One deleted, one alive — most recent action wins
  const deleted = L.deletedAt ? L : R;
  const alive = L.deletedAt ? R : L;
  return deleted.deletedAt! >= alive.updatedAt ? deleted.deletedAt : undefined;
}

/**
 * Check whether a merge produced any changes compared to the local state.
 */
export function hasChanges(local: Task[], merged: Task[]): boolean {
  if (local.length !== merged.length) return true;
  const localMap = new Map(local.map(t => [t.id, t]));
  for (const task of merged) {
    const orig = localMap.get(task.id);
    if (!orig) return true;
    if (
      orig.text !== task.text ||
      orig.completed !== task.completed ||
      orig.deadline !== task.deadline ||
      orig.deletedAt !== task.deletedAt ||
      orig.updatedAt !== task.updatedAt
    ) return true;
  }
  return false;
}
