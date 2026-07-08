import { NextResponse } from "next/server";

import {
  buildWebDavRemoteUrl,
  type WebDavProxyAction,
} from "../../../../lib/cloud-sync-webdav";

type WebDavProxyRequest = {
  action?: WebDavProxyAction;
  url?: string;
  remotePath?: string;
  username?: string;
  password?: string;
  payload?: string;
};

function buildBasicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function resolveTargetUrl(input: WebDavProxyRequest): string | null {
  if (!input.url?.trim() || !input.remotePath?.trim()) {
    return null;
  }

  try {
    return buildWebDavRemoteUrl(input.url, input.remotePath);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WebDavProxyRequest;
    const action = body.action;

    if (!action || !["test", "upload", "download"].includes(action)) {
      return NextResponse.json(
        {
          ok: false,
          message: "缺少或无效的 WebDAV 操作类型。",
        },
        { status: 400 },
      );
    }

    const targetUrl = resolveTargetUrl(body);

    if (!targetUrl) {
      return NextResponse.json(
        {
          ok: false,
          message: "WebDAV 地址或远端路径无效。",
        },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      Authorization: buildBasicAuthHeader(
        body.username ?? "",
        body.password ?? "",
      ),
    };

    if (action === "test") {
      const response = await fetch(targetUrl, {
        method: "PROPFIND",
        headers: {
          ...headers,
          Depth: "0",
        },
        cache: "no-store",
      });

      if (response.ok || response.status === 404 || response.status === 405) {
        return NextResponse.json({
          ok: true,
          message: "WebDAV 连接成功。",
          statusCode: response.status,
        });
      }

      return NextResponse.json({
        ok: false,
        message: `连接失败：HTTP ${response.status} ${response.statusText}`.trim(),
        statusCode: response.status,
      });
    }

    if (action === "upload") {
      if (!body.payload?.trim()) {
        return NextResponse.json(
          {
            ok: false,
            message: "缺少同步包内容。",
          },
          { status: 400 },
        );
      }

      const response = await fetch(targetUrl, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: body.payload,
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json({
          ok: false,
          message: `上传失败：HTTP ${response.status} ${response.statusText}`.trim(),
          statusCode: response.status,
        });
      }

      return NextResponse.json({
        ok: true,
        message: "同步包已上传到 WebDAV。",
        statusCode: response.status,
      });
    }

    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        message: `下载失败：HTTP ${response.status} ${response.statusText}`.trim(),
        statusCode: response.status,
      });
    }

    const payload = await response.text();

    if (!payload.trim()) {
      return NextResponse.json({
        ok: false,
        message: "远端同步包为空。",
        statusCode: response.status,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "已从 WebDAV 拉取同步包。",
      payload,
      statusCode: response.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "WebDAV 代理请求失败。",
      },
      { status: 500 },
    );
  }
}
