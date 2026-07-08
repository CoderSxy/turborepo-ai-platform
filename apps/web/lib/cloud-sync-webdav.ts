import type { NovelCloudSyncWebDavSettings } from "./novel-store";

export type WebDavProxyAction = "test" | "upload" | "download";

export type WebDavProxyResult = {
  ok: boolean;
  message: string;
  payload?: string;
  statusCode?: number;
};

export function buildWebDavRemoteUrl(
  url: string,
  remotePath: string,
): string {
  const base = url.trim().replace(/\/+$/, "");
  const path = remotePath.trim().replace(/^\/+/, "");

  if (!base) {
    return "";
  }

  if (!path) {
    return base;
  }

  return `${base}/${path}`;
}

export function validateWebDavSettings(
  settings: NovelCloudSyncWebDavSettings,
): string | null {
  if (!settings.url.trim()) {
    return "请填写 WebDAV 服务地址。";
  }

  if (!settings.remotePath.trim()) {
    return "请填写远端文件路径。";
  }

  try {
    const target = buildWebDavRemoteUrl(settings.url, settings.remotePath);
    new URL(target);
  } catch {
    return "WebDAV 地址格式不正确。";
  }

  return null;
}

async function callWebDavProxy(input: {
  action: WebDavProxyAction;
  settings: NovelCloudSyncWebDavSettings;
  payload?: string;
}): Promise<WebDavProxyResult> {
  const validationError = validateWebDavSettings(input.settings);

  if (validationError) {
    return {
      ok: false,
      message: validationError,
    };
  }

  const response = await fetch("/api/cloud-sync/webdav", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: input.action,
      url: input.settings.url.trim(),
      remotePath: input.settings.remotePath.trim(),
      username: input.settings.username,
      password: input.settings.password,
      payload: input.payload,
    }),
  });

  const result = (await response.json()) as WebDavProxyResult;

  if (!response.ok && result.message) {
    return {
      ok: false,
      message: result.message,
      statusCode: response.status,
    };
  }

  return result;
}

export async function testNovelCloudSyncWebDav(
  settings: NovelCloudSyncWebDavSettings,
): Promise<WebDavProxyResult> {
  return callWebDavProxy({
    action: "test",
    settings,
  });
}

export async function uploadNovelCloudSyncWebDav(
  settings: NovelCloudSyncWebDavSettings,
  payload: string,
): Promise<WebDavProxyResult> {
  return callWebDavProxy({
    action: "upload",
    settings,
    payload,
  });
}

export async function downloadNovelCloudSyncWebDav(
  settings: NovelCloudSyncWebDavSettings,
): Promise<WebDavProxyResult> {
  return callWebDavProxy({
    action: "download",
    settings,
  });
}
