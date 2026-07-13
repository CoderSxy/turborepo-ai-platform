let activeCoreTaskId = "";
let activeCoreProgress: string[] = [];
let activeCoreAssistantMessageId = "";
let activeTaskPauseRequested = false;

export function getActiveCoreTaskId() {
  return activeCoreTaskId;
}

export function setActiveCoreTaskId(taskId: string) {
  activeCoreTaskId = taskId;
}

export function getActiveCoreProgress() {
  return activeCoreProgress;
}

export function setActiveCoreProgress(progress: string[]) {
  activeCoreProgress = progress;
}

export function appendActiveCoreProgress(message: string) {
  activeCoreProgress = [...activeCoreProgress, message];
}

export function getActiveCoreAssistantMessageId() {
  return activeCoreAssistantMessageId;
}

export function setActiveCoreAssistantMessageId(messageId: string) {
  activeCoreAssistantMessageId = messageId;
}

export function requestCoreTaskPause() {
  activeTaskPauseRequested = true;
}

export function clearCoreTaskTrackingState() {
  activeCoreTaskId = "";
  activeCoreProgress = [];
  activeCoreAssistantMessageId = "";
}

export function resetCoreTaskState() {
  clearCoreTaskTrackingState();
  activeTaskPauseRequested = false;
}

export function isCoreTaskPauseRequested() {
  return activeTaskPauseRequested;
}

export function consumeCoreTaskPauseRequest() {
  if (!activeTaskPauseRequested) {
    return false;
  }

  activeTaskPauseRequested = false;
  return true;
}

export function shouldKeepPauseFlagAfterPauseRequest() {
  return activeTaskPauseRequested;
}
