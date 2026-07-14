"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  buildNovelPublicationTimeline,
  deriveNovelChapterProgress,
  mergeNovelChapterPlan,
  type NovelChapterWriteTarget,
  type NovelProjectAssets,
  type StoredNovelChapter,
  type StoredNovelChapterVersion,
  type StoredNovelTask,
} from "../../../lib/novel-store";
import { useNovelBookWorkspace } from "../hooks/useNovelBookWorkspace";
import { AssetConflictDialog } from "./dialogs/AssetConflictDialog";
import { KnowledgeAssetLibraryDialog } from "./dialogs/KnowledgeAssetLibraryDialog";
import { OutlineEditorDialog } from "./dialogs/OutlineEditorDialog";
import { BookContextPanel } from "./right-panel/BookContextPanel";
import { CharacterDetailView } from "./right-panel/detail/CharacterDetailView";
import { ChapterDetailView } from "./right-panel/detail/ChapterDetailView";
import { CoreFileDetailView } from "./right-panel/detail/CoreFileDetailView";
import { OutlineDetailView } from "./right-panel/detail/OutlineDetailView";
import { WorkspaceMoreSections } from "./WorkspaceMoreSections";

export function NovelBookPanel({
  project,
  assets,
  chapters,
  chapterVersions,
  tasks,
  activeChapterId,
  stats,
  promptPreview,
  onChapterSelect,
  onChapterDraftSave,
  onChapterStatusChange,
  onChapterPublicationStatusChange,
  onChapterDelete,
  onChapterVersionRestore,
  onGenerateChapter,
  onReviseChapter,
  onRetryTask,
  onProjectChange,
  onRequestPrompt,
  onRequestConfirm,
  onShowToast,
}: {
  project: InkosNovelProject;
  assets: NovelProjectAssets;
  chapters: StoredNovelChapter[];
  chapterVersions: StoredNovelChapterVersion[];
  tasks: StoredNovelTask[];
  activeChapterId: string;
  stats: ReturnType<typeof deriveNovelChapterProgress>;
  promptPreview: string;
  onChapterSelect: (chapterId: string) => void;
  onChapterDraftSave: (
    chapter: StoredNovelChapter,
    updates: Pick<StoredNovelChapter, "content" | "summary">,
  ) => Promise<void>;
  onChapterStatusChange: (
    chapter: StoredNovelChapter,
    status: StoredNovelChapter["status"],
  ) => Promise<void>;
  onChapterPublicationStatusChange: (
    chapter: StoredNovelChapter,
    status: NonNullable<StoredNovelChapter["publicationStatus"]>,
  ) => Promise<void>;
  onChapterDelete: (chapter: StoredNovelChapter) => Promise<void>;
  onChapterVersionRestore: (
    version: StoredNovelChapterVersion,
  ) => Promise<void>;
  onGenerateChapter: (target: NovelChapterWriteTarget) => Promise<void>;
  onReviseChapter: (selectedIssueIds?: string[]) => Promise<void>;
  onRetryTask: (task: StoredNovelTask) => void;
  onProjectChange: (
    updates: Partial<InkosNovelProject>,
    assets?: NovelProjectAssets,
  ) => Promise<void>;
  onRequestPrompt: (options: {
    title: string;
    message?: string;
    initialValue?: string;
    multiline?: boolean;
    confirmLabel?: string;
  }) => Promise<string | null>;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
  onShowToast: (
    message: string,
    tone?: "success" | "warning" | "error",
  ) => void;
}) {
  const chapterRows = mergeNovelChapterPlan(project, chapters);
  const publicationTimeline = buildNovelPublicationTimeline(assets, chapters);
  const workspace = useNovelBookWorkspace({
    project,
    assets,
    chapters,
    onProjectChange,
    onRequestPrompt,
    onRequestConfirm,
    onShowToast,
  });

  return (
    <>
      <BookContextPanel
        project={project}
        assets={assets}
        chapterRows={chapterRows}
        activeChapterId={activeChapterId}
        stats={stats}
        tasks={tasks}
        onChapterSelect={onChapterSelect}
        renderChapterDetail={(chapterId) => (
          <ChapterDetailView
            chapterId={chapterId}
            chapterRows={chapterRows}
            chapterVersions={chapterVersions}
            project={project}
            onChapterSelect={onChapterSelect}
            onChapterDraftSave={onChapterDraftSave}
            onChapterStatusChange={onChapterStatusChange}
            onChapterPublicationStatusChange={onChapterPublicationStatusChange}
            onChapterDelete={onChapterDelete}
            onChapterVersionRestore={onChapterVersionRestore}
            onGenerateChapter={onGenerateChapter}
            onReviseChapter={onReviseChapter}
          />
        )}
        renderCoreFileDetail={(fileKey) => (
          <CoreFileDetailView
            fileKey={fileKey}
            assets={assets}
            project={project}
            onProjectChange={onProjectChange}
          />
        )}
        renderCharacterDetail={(characterName, openCharacterMatrix) => (
          <CharacterDetailView
            characterName={characterName}
            assets={assets}
            project={project}
            onOpenCharacterMatrix={openCharacterMatrix}
          />
        )}
        renderOutlineDetail={() => (
          <OutlineDetailView
            assets={assets}
            project={project}
            onProjectChange={onProjectChange}
            onOpenOutlineEditor={workspace.openOutlineEditor}
          />
        )}
        workspaceSections={
          <WorkspaceMoreSections
            stats={stats}
            assets={assets}
            tasks={tasks}
            promptPreview={promptPreview}
            assetConflictPreview={workspace.assetConflictPreview}
            publicationTimeline={publicationTimeline}
            onOpenOutlineEditor={workspace.openOutlineEditor}
            onAddOutlineNode={() => void workspace.addOutlineNode()}
            onSyncOutlineToProject={() => void workspace.syncOutlineToProject()}
            onEditOutlineNode={(node, field) =>
              void workspace.editOutlineNode(node, field)
            }
            onDeleteOutlineNode={(node) => void workspace.deleteOutlineNode(node)}
            onOpenKnowledgeLibrary={() => workspace.setIsKnowledgeLibraryOpen(true)}
            onOpenAssetConflictReport={workspace.openAssetConflictReport}
            onCreateKnowledgeAsset={() => void workspace.createKnowledgeAsset()}
            onEditKnowledgeAsset={(item, field) =>
              void workspace.editKnowledgeAsset(item, field)
            }
            onDeleteKnowledgeAsset={(item) =>
              void workspace.deleteKnowledgeAsset(item)
            }
            onRetryTask={onRetryTask}
          />
        }
      />
      {workspace.isOutlineEditorOpen ? (
        <OutlineEditorDialog
          nodes={workspace.outlineEditorDraft}
          outlineText={assets.outline}
          project={project}
          onChange={workspace.setOutlineEditorDraft}
          onClose={() => workspace.setIsOutlineEditorOpen(false)}
          onSave={workspace.saveOutlineEditorDraft}
          onImportFromOutlineText={() => void workspace.importOutlineFromText()}
          onImportFromProject={workspace.importOutlineFromProject}
          onReverseSyncFromChapters={workspace.reverseSyncOutlineFromChapters}
          onSyncToProject={workspace.syncOutlineToProject}
          onRequestPrompt={onRequestPrompt}
          onRequestConfirm={onRequestConfirm}
        />
      ) : null}
      {workspace.isKnowledgeLibraryOpen ? (
        <KnowledgeAssetLibraryDialog
          assets={assets}
          project={project}
          onClose={() => workspace.setIsKnowledgeLibraryOpen(false)}
          onEditAsset={workspace.editKnowledgeAsset}
          onDeleteAsset={workspace.deleteKnowledgeAsset}
          onCreateAsset={workspace.createKnowledgeAsset}
          onRunConflictCheck={workspace.openAssetConflictReport}
        />
      ) : null}
      {workspace.assetConflictReport ? (
        <AssetConflictDialog
          report={workspace.assetConflictReport}
          isApplying={workspace.isApplyingConflictFixes}
          onClose={() => workspace.setAssetConflictReport(null)}
          onApplyFixes={() => void workspace.applyAssetConflictFixes()}
        />
      ) : null}
    </>
  );
}
