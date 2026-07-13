import type { StudioTaskRuntime } from "../../store/types";

export function getStudioTaskGuard(runningTask: StudioTaskRuntime | null): {
  canStart: boolean;
  message: string;
} {
  if (!runningTask) {
    return { canStart: true, message: "" };
  }

  return {
    canStart: false,
    message: `当前正在执行「${runningTask.label}」，请等待完成或取消后再试。`,
  };
}
