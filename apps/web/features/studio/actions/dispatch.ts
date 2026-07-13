import { sendMessage } from "./send-message";
import { runCoreAction } from "./run-core-action";
import { executeWriteChapter } from "./write-chapter";
import type { StudioAction, StudioActionContext } from "./types";

export function dispatchStudioAction(
  ctx: StudioActionContext,
  action: StudioAction,
): void {
  switch (action.type) {
    case "send-message":
      void sendMessage(ctx, action.text);
      break;
    case "write-chapter":
      void executeWriteChapter(ctx, {
        source: action.source ?? "quick-action",
        target: action.target,
        contextSelection: action.contextSelection,
      });
      break;
    case "review":
      void runCoreAction(ctx, "review");
      break;
    case "revise-chapter":
      void runCoreAction(ctx, "revise-chapter", {
        selectedIssueIds: action.selectedIssueIds,
      });
      break;
    case "abort-task":
      ctx.getState().abortTask();
      break;
  }
}
