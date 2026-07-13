"use client";

import {
  formatNovelRelativeAge,
  type NovelCloudSyncState,
  type NovelCloudSyncWebDavSettings,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function CloudSyncPanel({
  state,
  webDavSettings,
  webDavBusy,
  onDeviceLabelChange,
  onExport,
  onImportClick,
  onWebDavSettingsChange,
  onWebDavTest,
  onWebDavUpload,
  onWebDavDownload,
  onWebDavReset,
}: {
  state: NovelCloudSyncState;
  webDavSettings: NovelCloudSyncWebDavSettings;
  webDavBusy: "test" | "upload" | "download" | null;
  onDeviceLabelChange: (label: string) => void;
  onExport: () => void;
  onImportClick: () => void;
  onWebDavSettingsChange: (patch: Partial<NovelCloudSyncWebDavSettings>) => void;
  onWebDavTest: () => void;
  onWebDavUpload: () => void;
  onWebDavDownload: () => void;
  onWebDavReset: () => void;
}) {
  return (
    <div className={styles.cloudSyncPanel}>
      <div className={styles.cloudSyncHeader}>
        <strong>云端同步 v2</strong>
        <span>本地文件导出 / WebDAV 自动同步</span>
      </div>
      <label className={styles.cloudSyncField}>
        <span>本设备名称</span>
        <input
          value={state.deviceLabel}
          onChange={(event) => onDeviceLabelChange(event.target.value)}
          placeholder='例如：MacBook / 办公室电脑'
        />
      </label>
      <div className={styles.cloudSyncMeta}>
        {state.lastExportedAt ? (
          <span>上次导出：{formatNovelRelativeAge(state.lastExportedAt)}</span>
        ) : (
          <span>尚未导出同步包</span>
        )}
        {state.lastMergeAt ? (
          <span>上次合并：{formatNovelRelativeAge(state.lastMergeAt)}</span>
        ) : null}
        {state.lastWebDavUploadAt ? (
          <span>
            WebDAV 上传：{formatNovelRelativeAge(state.lastWebDavUploadAt)}
          </span>
        ) : null}
        {state.lastWebDavDownloadAt ? (
          <span>
            WebDAV 拉取：{formatNovelRelativeAge(state.lastWebDavDownloadAt)}
          </span>
        ) : null}
      </div>
      <div className={styles.cloudSyncActions}>
        <button onClick={onExport}>导出同步包</button>
        <button onClick={onImportClick}>导入并合并</button>
      </div>

      <div className={styles.cloudSyncDivider} />

      <div className={styles.cloudSyncHeader}>
        <strong>WebDAV</strong>
        <span>坚果云 / Nextcloud 等，经服务端代理避免 CORS</span>
      </div>
      <label className={styles.cloudSyncField}>
        <span>服务地址</span>
        <input
          value={webDavSettings.url}
          onChange={(event) =>
            onWebDavSettingsChange({ url: event.target.value })
          }
          placeholder='https://dav.example.com/remote.php/dav/files/user'
        />
      </label>
      <label className={styles.cloudSyncField}>
        <span>远端文件路径</span>
        <input
          value={webDavSettings.remotePath}
          onChange={(event) =>
            onWebDavSettingsChange({ remotePath: event.target.value })
          }
          placeholder='sxy-cloud-sync.json'
        />
      </label>
      <label className={styles.cloudSyncField}>
        <span>用户名</span>
        <input
          value={webDavSettings.username}
          onChange={(event) =>
            onWebDavSettingsChange({ username: event.target.value })
          }
          autoComplete='username'
        />
      </label>
      <label className={styles.cloudSyncField}>
        <span>密码 / 应用专用密码</span>
        <input
          type='password'
          value={webDavSettings.password}
          onChange={(event) =>
            onWebDavSettingsChange({ password: event.target.value })
          }
          autoComplete='current-password'
        />
      </label>
      <div className={styles.cloudSyncActions}>
        <button
          disabled={webDavBusy !== null}
          onClick={onWebDavTest}
        >
          {webDavBusy === "test" ? "测试中…" : "测试连接"}
        </button>
        <button
          disabled={webDavBusy !== null}
          onClick={onWebDavUpload}
        >
          {webDavBusy === "upload" ? "上传中…" : "上传到 WebDAV"}
        </button>
        <button
          disabled={webDavBusy !== null}
          onClick={onWebDavDownload}
        >
          {webDavBusy === "download" ? "拉取中…" : "从 WebDAV 拉取合并"}
        </button>
        <button disabled={webDavBusy !== null} onClick={onWebDavReset}>
          重置配置
        </button>
      </div>
    </div>
  );
}
