import { sendMessage } from "./send-message";
import { runCoreAction } from "./run-core-action";
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
      void runCoreAction(ctx, "write-chapter");
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
