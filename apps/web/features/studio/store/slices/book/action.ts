import type { StateCreator } from "zustand";
import type { StudioStore } from "../../types";
import { resolveHydrateActiveIds } from "./hydrate-active-ids";
import { initialBookState } from "./initialState";

export const createBookSlice: StateCreator<
  StudioStore,
  [],
  [],
  Pick<StudioStore, keyof typeof initialBookState | "hydrateFromSnapshot" | "setBooks" | "patchBook" | "setActiveBook" | "setActiveChapter" | "setLoading" | "setError">
> = (set) => ({
  ...initialBookState,
  hydrateFromSnapshot: ({
    books,
    messagesBySessionId,
    activeBookId,
    activeSessionId,
  }) => {
    const { activeBookId: nextActiveBookId, activeSessionId: nextActiveSessionId } =
      resolveHydrateActiveIds(books, activeBookId, activeSessionId);

    set({
      books,
      messagesBySessionId,
      activeBookId: nextActiveBookId,
      activeSessionId: nextActiveSessionId,
      isLoading: false,
      error: "",
    });
  },
  setBooks: (books) => set({ books }),
  patchBook: (bookId, patch) =>
    set((state) => ({
      books: state.books.map((book) => {
        if (book.id !== bookId) {
          return book;
        }

        return typeof patch === "function" ? patch(book) : { ...book, ...patch };
      }),
    })),
  setActiveBook: (activeBookId) => set({ activeBookId }),
  setActiveChapter: (activeChapterId) => set({ activeChapterId }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
});
