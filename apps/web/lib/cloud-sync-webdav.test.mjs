import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWebDavRemoteUrl,
  validateWebDavSettings,
} from "./cloud-sync-webdav.ts";

test("buildWebDavRemoteUrl joins base and path", () => {
  assert.equal(
    buildWebDavRemoteUrl("https://dav.example.com/dav/", "/sync/data.json"),
    "https://dav.example.com/dav/sync/data.json",
  );
  assert.equal(
    buildWebDavRemoteUrl("https://dav.example.com", "sxy-cloud-sync.json"),
    "https://dav.example.com/sxy-cloud-sync.json",
  );
});

test("validateWebDavSettings rejects empty url", () => {
  assert.match(
    validateWebDavSettings({
      url: "",
      remotePath: "sync.json",
      username: "",
      password: "",
    }) ?? "",
    /服务地址/,
  );
});
