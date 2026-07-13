import type { BookSliceState } from "../../types";

export const initialBookState: BookSliceState = {
  books: [],
  activeBookId: "",
  activeChapterId: "",
  isLoading: true,
  error: "",
};
