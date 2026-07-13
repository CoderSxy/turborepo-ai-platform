import { create } from "zustand";
import type { StudioStore } from "./types";
import { createBookSlice } from "./slices/book/action";
import { createSessionSlice } from "./slices/session/action";
import { createMessageSlice } from "./slices/message/action";
import { createTaskSlice } from "./slices/task/action";

export const useStudioStore = create<StudioStore>()((...args) => ({
  ...createBookSlice(...args),
  ...createSessionSlice(...args),
  ...createMessageSlice(...args),
  ...createTaskSlice(...args),
}));
