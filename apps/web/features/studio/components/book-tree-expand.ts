export function ensureExpanded(
  expanded: ReadonlySet<string>,
  bookId: string,
): Set<string> {
  if (expanded.has(bookId)) {
    return new Set(expanded);
  }
  const next = new Set(expanded);
  next.add(bookId);
  return next;
}

export function toggleExpanded(
  expanded: ReadonlySet<string>,
  bookId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(bookId)) {
    next.delete(bookId);
  } else {
    next.add(bookId);
  }
  return next;
}
