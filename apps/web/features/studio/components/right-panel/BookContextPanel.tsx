"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildNovelAssetConflictReport,
  deriveNovelChapterProgress,
  type NovelChapterListItem,
  type NovelProjectAssets,
  type StoredNovelTask,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";
import { BookSummaryHeader } from "./BookSummaryHeader";
import { ChaptersSection } from "./ChaptersSection";
import { CharactersSection } from "./CharactersSection";
import { CharacterSummarySection } from "./CharacterSummarySection";
import { CoreFilesSection } from "./CoreFilesSection";
import { WorldSummarySection } from "./WorldSummarySection";
import { WorkspaceMoreSheet } from "./WorkspaceMoreSheet";
import { BookContextDetailView } from "./detail/BookContextDetailView";
import type { CoreFileKey } from "./core-file-keys";
import { getCoreFileDefinition } from "./core-file-keys";
import type { DetailTarget } from "./detail/types";
import { buildAssetAlertCounts } from "./right-panel-summaries";

export type BookContextPanelProps = {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapterRows: NovelChapterListItem[];
  activeChapterId: string;
  stats: ReturnType<typeof deriveNovelChapterProgress>;
  tasks: StoredNovelTask[];
  onChapterSelect: (chapterId: string) => void;
  onOpenBookStats?: () => void;
  workspaceSections: ReactNode;
  renderChapterDetail: (chapterId: string) => ReactNode;
  renderCoreFileDetail: (fileKey: CoreFileKey) => ReactNode;
  renderCharacterDetail: (
    characterName: string,
    openCharacterMatrix: () => void,
  ) => ReactNode;
  renderOutlineDetail: () => ReactNode;
};

export function BookContextPanel({
  project,
  assets,
  chapterRows,
  activeChapterId,
  stats,
  tasks,
  onChapterSelect,
  onOpenBookStats,
  workspaceSections,
  renderChapterDetail,
  renderCoreFileDetail,
  renderCharacterDetail,
  renderOutlineDetail,
}: BookContextPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [panelView, setPanelView] = useState<"main" | "detail">("main");
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);
  const mainPanelRef = useRef<HTMLElement>(null);
  const savedScrollTopRef = useRef(0);

  const activeRow =
    chapterRows.find((chapter) => chapter.key === activeChapterId) ?? null;
  const assetConflictPreview = useMemo(
    () => buildNovelAssetConflictReport({ project, assets }),
    [project, assets],
  );
  const assetAlerts = useMemo(
    () =>
      buildAssetAlertCounts(
        assets,
        assetConflictPreview.errorCount,
        assetConflictPreview.warningCount,
      ),
    [assets, assetConflictPreview.errorCount, assetConflictPreview.warningCount],
  );

  const openMoreSheet = useCallback(() => {
    setMoreOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setPanelView("main");
    setDetailTarget(null);
    requestAnimationFrame(() => {
      if (mainPanelRef.current) {
        mainPanelRef.current.scrollTop = savedScrollTopRef.current;
      }
    });
  }, []);

  function openDetail(target: DetailTarget) {
    if (mainPanelRef.current) {
      savedScrollTopRef.current = mainPanelRef.current.scrollTop;
    }
    setDetailTarget(target);
    setPanelView("detail");
  }

  function openChapterDetail(chapterId: string) {
    onChapterSelect(chapterId);
    openDetail({ type: "chapter", chapterId });
  }

  function openCoreFile(fileKey: CoreFileKey) {
    if (fileKey === "outline") {
      openDetail({ type: "outline" });
      return;
    }
    openDetail({ type: "core-file", fileKey });
  }

  function openCharacterDetail(characterName: string) {
    openDetail({ type: "character", characterName });
  }

  useEffect(() => {
    if (panelView !== "detail") {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeDetail();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelView, closeDetail]);

  if (panelView === "detail" && detailTarget) {
    return (
      <aside className={styles.bookContextPanel}>
        <BookContextDetailView
          detailTarget={detailTarget}
          onBack={closeDetail}
          getCoreFileLabel={(fileKey) => getCoreFileDefinition(fileKey).label}
          chapterContent={
            detailTarget.type === "chapter"
              ? renderChapterDetail(detailTarget.chapterId)
              : null
          }
          coreFileContent={
            detailTarget.type === "core-file"
              ? renderCoreFileDetail(detailTarget.fileKey)
              : null
          }
          characterContent={
            detailTarget.type === "character"
              ? renderCharacterDetail(detailTarget.characterName, () =>
                  openCoreFile("characters"),
                )
              : null
          }
          outlineContent={
            detailTarget.type === "outline" ? renderOutlineDetail() : null
          }
        />
      </aside>
    );
  }

  return (
    <>
      <aside ref={mainPanelRef} className={styles.bookContextPanel}>
        <BookSummaryHeader
          project={project}
          generatedChapters={stats.generatedChapters}
          totalChapters={stats.totalChapters}
          tasks={tasks}
          onOpenBookStats={() => {
            openMoreSheet();
            onOpenBookStats?.();
          }}
        />
        <ChaptersSection
          chapterRows={chapterRows}
          activeChapterId={activeChapterId}
          onChapterSelect={onChapterSelect}
          onOpenChapterDetail={openChapterDetail}
        />
        <CharactersSection
          assets={assets}
          project={project}
          activeChapterNumber={activeRow?.number ?? null}
          alerts={assetAlerts}
          onOpenCharacter={openCharacterDetail}
          onOpenCharacterMatrix={() => openCoreFile("characters")}
          onOpenAlerts={openMoreSheet}
        />
        <CoreFilesSection
          assets={assets}
          alerts={assetAlerts}
          onOpenCoreFile={openCoreFile}
          onOpenAlerts={openMoreSheet}
        />
        <WorldSummarySection
          project={project}
          assets={assets}
          alerts={assetAlerts}
          onOpenCoreFile={openCoreFile}
          onOpenAlerts={openMoreSheet}
        />
        <CharacterSummarySection
          project={project}
          assets={assets}
          onOpenCoreFile={openCoreFile}
        />
        <footer className={styles.workspaceMoreFooter}>
          <button type="button" onClick={() => setMoreOpen(true)}>
            更多工作区 ···
          </button>
        </footer>
      </aside>
      <WorkspaceMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        {workspaceSections}
      </WorkspaceMoreSheet>
    </>
  );
}
