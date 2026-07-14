"use client";

import { useEffect, useMemo, useState } from "react";
import type { InkosNovelProject } from "@repo/inkos-adapter";
import {
  applyManualCharacterProfileEdit,
  deriveCharactersMarkdownFromProfiles,
} from "#lib/novel-character-profiles";
import type { NovelProjectAssets } from "../../../../../lib/novel-store";
import styles from "../../../studio.module.css";
import { buildCharacterDetailViewModel } from "../right-panel-summaries";

type CharacterEditDraft = {
  narrativeRole: string;
  coreTraits: string;
  motivations: string;
  goals: string;
  relationships: string;
  currentStateSummary: string;
};

function draftFromProfile(
  profile: NonNullable<ReturnType<typeof buildCharacterDetailViewModel>>["profile"],
): CharacterEditDraft {
  return {
    narrativeRole: profile.narrativeRole,
    coreTraits: profile.coreTraits.join("、"),
    motivations: profile.motivations.join("、"),
    goals: profile.goals.join("、"),
    relationships: profile.relationships
      .map((item) => `${item.targetName}（${item.label}）：${item.state}`)
      .join("\n"),
    currentStateSummary: profile.currentState.summary,
  };
}

function splitListInput(value: string): string[] {
  return value
    .split(/[、，,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseRelationshipsInput(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const match = line.match(/^(.+?)（(.+?)）：(.+)$/);
      if (!match) {
        return [];
      }
      return [
        {
          targetName: match[1]!.trim(),
          label: match[2]!.trim(),
          state: match[3]!.trim(),
        },
      ];
    });
}

export function CharacterDetailView({
  characterName,
  assets,
  onProjectChange,
  project,
  onOpenCharacterMatrix,
}: {
  characterName: string;
  assets: NovelProjectAssets;
  project: InkosNovelProject;
  onProjectChange?: (
    updates: Partial<InkosNovelProject>,
    nextAssets?: NovelProjectAssets,
  ) => Promise<void>;
  onOpenCharacterMatrix?: () => void;
}) {
  const detail = useMemo(
    () => buildCharacterDetailViewModel(assets, characterName),
    [assets, characterName],
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CharacterEditDraft>(() =>
    detail ? draftFromProfile(detail.profile) : {
      narrativeRole: "",
      coreTraits: "",
      motivations: "",
      goals: "",
      relationships: "",
      currentStateSummary: "",
    },
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (detail) {
      setDraft(draftFromProfile(detail.profile));
      setEditing(false);
    }
  }, [detail]);

  async function handleSave() {
    if (!detail || !onProjectChange) {
      return;
    }

    setSaving(true);
    try {
      const nextProfiles = applyManualCharacterProfileEdit(
        assets.characterProfiles ?? [],
        detail.profile.id,
        {
          narrativeRole: draft.narrativeRole.trim(),
          coreTraits: splitListInput(draft.coreTraits),
          motivations: splitListInput(draft.motivations),
          goals: splitListInput(draft.goals),
          relationships: parseRelationshipsInput(draft.relationships),
          currentStateSummary: draft.currentStateSummary.trim(),
        },
        new Date().toISOString(),
      );

      await onProjectChange(project, {
        ...assets,
        characterProfiles: nextProfiles,
        characters: deriveCharactersMarkdownFromProfiles(nextProfiles),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!detail) {
    return (
      <div className={styles.characterDetailView}>
        <p className={styles.emptyMiniState}>
          未找到「{characterName}」的详细资料，可在角色矩阵或资产库中补充。
        </p>
        {onOpenCharacterMatrix ? (
          <button
            type="button"
            className={styles.worldSummaryViewAll}
            onClick={onOpenCharacterMatrix}
          >
            打开角色矩阵
          </button>
        ) : null}
      </div>
    );
  }

  const { profile, sourceLabel, stateHistory, diagnostics } = detail;

  return (
    <div className={styles.characterDetailView}>
      {onProjectChange ? (
        <div className={styles.coreFileDetailActions}>
          {editing ? (
            <>
              <button type="button" onClick={() => setEditing(false)}>
                取消
              </button>
              <button
                type="button"
                className={styles.chapterEditorSaveButton}
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "保存中" : "保存档案"}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)}>
              编辑角色档案
            </button>
          )}
        </div>
      ) : null}

      {editing ? (
        <div className={styles.characterDetailEditor}>
          <label>
            定位
            <input
              value={draft.narrativeRole}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  narrativeRole: event.target.value,
                }))
              }
            />
          </label>
          <label>
            性格标签（顿号分隔）
            <input
              value={draft.coreTraits}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  coreTraits: event.target.value,
                }))
              }
            />
          </label>
          <label>
            动机（顿号分隔）
            <input
              value={draft.motivations}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  motivations: event.target.value,
                }))
              }
            />
          </label>
          <label>
            目标（顿号分隔）
            <input
              value={draft.goals}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  goals: event.target.value,
                }))
              }
            />
          </label>
          <label>
            关系（每行：姓名（关系）：状态）
            <textarea
              value={draft.relationships}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  relationships: event.target.value,
                }))
              }
            />
          </label>
          <label>
            当前状态
            <textarea
              value={draft.currentStateSummary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  currentStateSummary: event.target.value,
                }))
              }
            />
          </label>
        </div>
      ) : (
        <>
          <dl className={styles.characterDetailFields}>
            {profile.narrativeRole ? (
              <>
                <dt>定位</dt>
                <dd>{profile.narrativeRole}</dd>
              </>
            ) : null}
            {profile.coreTraits.length > 0 ? (
              <>
                <dt>性格</dt>
                <dd>{profile.coreTraits.join("、")}</dd>
              </>
            ) : null}
            {profile.motivations.length > 0 ? (
              <>
                <dt>动机</dt>
                <dd>{profile.motivations.join("、")}</dd>
              </>
            ) : null}
            {profile.goals.length > 0 ? (
              <>
                <dt>目标</dt>
                <dd>{profile.goals.join("、")}</dd>
              </>
            ) : null}
            {profile.relationships.length > 0 ? (
              <>
                <dt>关系</dt>
                <dd>
                  <ul className={styles.characterDetailRelationshipList}>
                    {profile.relationships.map((relationship) => (
                      <li key={`${relationship.targetName}-${relationship.label}`}>
                        {relationship.targetName}（{relationship.label}）：
                        {relationship.state}
                      </li>
                    ))}
                  </ul>
                </dd>
              </>
            ) : null}
            {profile.currentState.summary ? (
              <>
                <dt>当前状态</dt>
                <dd>{profile.currentState.summary}</dd>
              </>
            ) : null}
            <dt>同步来源</dt>
            <dd>{sourceLabel}</dd>
            {profile.currentState.chapterNumber !== undefined ? (
              <>
                <dt>最后同步章节</dt>
                <dd>第 {profile.currentState.chapterNumber} 章</dd>
              </>
            ) : null}
          </dl>

          {stateHistory.length > 0 ? (
            <section className={styles.characterDetailSection}>
              <h3>状态时间线</h3>
              <ol className={styles.characterDetailHistory}>
                {stateHistory.map((entry) => (
                  <li key={`${entry.chapterNumber}-${entry.createdAt}`}>
                    <strong>第 {entry.chapterNumber} 章</strong>
                    <p>{entry.summary}</p>
                    {entry.changes.length > 0 ? (
                      <em>{entry.changes.join("；")}</em>
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {diagnostics.length > 0 ? (
            <section className={styles.characterDetailSection}>
              <h3>同步诊断</h3>
              <ul className={styles.characterDetailDiagnostics}>
                {diagnostics.map((item) => (
                  <li key={item.id} data-ok={item.ok}>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {onOpenCharacterMatrix ? (
        <button
          type="button"
          className={styles.worldSummaryViewAll}
          onClick={onOpenCharacterMatrix}
        >
          打开角色矩阵
        </button>
      ) : null}
    </div>
  );
}
