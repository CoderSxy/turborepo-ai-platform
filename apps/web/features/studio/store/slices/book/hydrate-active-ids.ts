export type HydrateBook = {
  id: string;
  archived: boolean;
  sessions: Array<{ id: string }>;
};

export function resolveHydrateActiveIds(
  books: HydrateBook[],
  activeBookId?: string,
  activeSessionId?: string,
): { activeBookId: string; activeSessionId: string } {
  const firstBook = books.find((book) => !book.archived) ?? books[0] ?? null;
  const nextActiveBook = activeBookId
    ? (books.find((book) => book.id === activeBookId) ?? firstBook)
    : firstBook;

  const nextActiveSession =
    activeSessionId &&
    nextActiveBook?.sessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : (nextActiveBook?.sessions[0]?.id ?? "");

  return {
    activeBookId: nextActiveBook?.id ?? "",
    activeSessionId: nextActiveSession,
  };
}
