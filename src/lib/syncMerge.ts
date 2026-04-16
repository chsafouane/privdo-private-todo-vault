import type { Task, TaskList, Vault } from '@/types';

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
      sortOrder: winner.sortOrder,
      priority: winner.priority,
      recurrence: winner.recurrence,
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
      orig.updatedAt !== task.updatedAt ||
      orig.sortOrder !== task.sortOrder ||
      orig.priority !== task.priority ||
      orig.recurrence !== task.recurrence
    ) return true;
  }
  return false;
}

// ─── Vault-level merge ────────────────────────────────────────

function mergeLists(local: TaskList[], remote: TaskList[]): TaskList[] {
  const localMap = new Map(local.map(l => [l.id, l]));
  const remoteMap = new Map(remote.map(l => [l.id, l]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const merged: TaskList[] = [];

  for (const id of allIds) {
    const L = localMap.get(id);
    const R = remoteMap.get(id);

    if (!L && R) { merged.push(R); continue; }
    if (L && !R) { merged.push(L); continue; }
    if (!L || !R) continue;

    const winner = L.updatedAt >= R.updatedAt ? L : R;
    merged.push({
      id,
      name: winner.name,
      sortOrder: winner.sortOrder,
      createdAt: Math.min(L.createdAt, R.createdAt),
      updatedAt: Math.max(L.updatedAt, R.updatedAt),
      deletedAt: mergeListDeletedAt(L, R),
    });
  }

  return merged;
}

function mergeListDeletedAt(L: TaskList, R: TaskList): number | undefined {
  if (!L.deletedAt && !R.deletedAt) return undefined;
  if (L.deletedAt && R.deletedAt) return Math.min(L.deletedAt, R.deletedAt);
  const deleted = L.deletedAt ? L : R;
  const alive = L.deletedAt ? R : L;
  return deleted.deletedAt! >= alive.updatedAt ? deleted.deletedAt : undefined;
}

export function mergeVaults(local: Vault, remote: Vault): Vault {
  const mergedLists = mergeLists(local.lists, remote.lists);
  const allListIds = new Set([
    ...Object.keys(local.tasks),
    ...Object.keys(remote.tasks),
  ]);
  const mergedTasks: Record<string, Task[]> = {};
  for (const listId of allListIds) {
    mergedTasks[listId] = mergeTasks(
      local.tasks[listId] || [],
      remote.tasks[listId] || []
    );
  }
  return { lists: mergedLists, tasks: mergedTasks };
}

export function hasVaultChanges(local: Vault, merged: Vault): boolean {
  if (local.lists.length !== merged.lists.length) return true;
  const localListMap = new Map(local.lists.map(l => [l.id, l]));
  for (const list of merged.lists) {
    const orig = localListMap.get(list.id);
    if (!orig) return true;
    if (orig.name !== list.name || orig.sortOrder !== list.sortOrder ||
        orig.deletedAt !== list.deletedAt || orig.updatedAt !== list.updatedAt) return true;
  }
  const allListIds = new Set([...Object.keys(local.tasks), ...Object.keys(merged.tasks)]);
  for (const listId of allListIds) {
    if (hasChanges(local.tasks[listId] || [], merged.tasks[listId] || [])) return true;
  }
  return false;
}
