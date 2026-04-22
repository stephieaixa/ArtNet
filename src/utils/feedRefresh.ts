/**
 * Module-level set of job IDs deleted during this session.
 * Discover screen reads and clears this on focus to sync UI without a full re-fetch.
 */
const _deletedIds = new Set<string>();

export function markJobDeleted(id: string) {
  _deletedIds.add(id);
}

export function popDeletedIds(): Set<string> {
  const copy = new Set(_deletedIds);
  _deletedIds.clear();
  return copy;
}
