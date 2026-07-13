"use client";

import type { InkosCoreAction, InkosNovelProject } from "@repo/inkos-adapter";
import {
  createDefaultNovelAssets,
  type NovelImportedChapter,
  type NovelProjectAssets,
} from "../../../lib/novel-store";
import styles from "../studio.module.css";
import type { AppToastState, NovelBookEntry, NovelTool } from "../state/studio-types";
import { DoctorTool } from "./tools/DoctorTool";
import { GenreTool } from "./tools/GenreTool";
import { ImportTool } from "./tools/ImportTool";
import { RadarTool } from "./tools/RadarTool";
import { StyleTool } from "./tools/StyleTool";

export function NovelToolPanel({
  tool,
  book,
  project,
  isRunningCoreAction,
  onProjectChange,
  onRunCoreAction,
  onImportChapters,
  onRunLocalDiagnostics,
  onRequestPrompt,
  onNotify,
}: {
  tool: Exclude<NovelTool, "AI创作">;
  book: NovelBookEntry | null;
  project: InkosNovelProject;
  isRunningCoreAction: boolean;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRunCoreAction: (action: InkosCoreAction) => Promise<void>;
  onImportChapters: (chapters: NovelImportedChapter[]) => Promise<void>;
  onRunLocalDiagnostics: () => void;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }) => Promise<string | null>;
  onNotify: (message: string, tone?: AppToastState["tone"]) => void;
}) {
  const assets = book?.assets ?? createDefaultNovelAssets(project);

  return (
    <section className={styles.novelToolPanel}>
      <header>
        <strong>{tool}</strong>
        <span>当前数据写入本地 IndexedDB，跟随书籍一起保存。</span>
      </header>
      {tool === "题材" ? (
        <GenreTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
          onRequestPrompt={onRequestPrompt}
          onNotify={onNotify}
        />
      ) : null}
      {tool === "文风" ? (
        <StyleTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
          onNotify={onNotify}
        />
      ) : null}
      {tool === "导入" ? (
        <ImportTool
          assets={assets}
          project={project}
          onProjectChange={onProjectChange}
          onImportChapters={onImportChapters}
          onNotify={onNotify}
        />
      ) : null}
      {tool === "市场雷达" ? (
        <RadarTool
          assets={assets}
          project={project}
          isRunningCoreAction={isRunningCoreAction}
          onRunCoreAction={onRunCoreAction}
        />
      ) : null}
      {tool === "环境诊断" ? (
        <DoctorTool
          assets={assets}
          project={project}
          isRunningCoreAction={isRunningCoreAction}
          onRunCoreAction={onRunCoreAction}
          onRunLocalDiagnostics={onRunLocalDiagnostics}
        />
      ) : null}
    </section>
  );
}
