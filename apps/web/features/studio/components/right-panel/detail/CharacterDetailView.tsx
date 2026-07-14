"use client";

import type { InkosNovelProject } from "@repo/inkos-adapter";
import type { NovelProjectAssets } from "../../../../../lib/novel-store";
import styles from "../../../studio.module.css";
import {
  buildCharacterStateCards,
  type ParsedCharacter,
} from "../right-panel-summaries";

function findCharacterProfile(
  assets: NovelProjectAssets,
  characterName: string,
  project: Pick<InkosNovelProject, "protagonist">,
): {
  profile: ParsedCharacter | null;
  assetContent: string | null;
  assetTags: string[];
} {
  const profile =
    buildCharacterStateCards(assets, project, null, 24).find(
      (character) =>
        character.name === characterName ||
        character.name.includes(characterName) ||
        characterName.includes(character.name),
    ) ?? null;

  const asset = assets.knowledgeAssets.find(
    (item) =>
      item.category === "character" &&
      (item.title === characterName ||
        item.title.includes(characterName) ||
        characterName.includes(item.title) ||
        (item.title === "主角" &&
          (profile?.name === characterName || item.content.includes(characterName)))),
  );

  return {
    profile,
    assetContent: asset?.content ?? profile?.current ?? null,
    assetTags: asset?.tags ?? (profile?.tags ? profile.tags.split("、") : []),
  };
}

export function CharacterDetailView({
  characterName,
  assets,
  project,
  onOpenCharacterMatrix,
}: {
  characterName: string;
  assets: NovelProjectAssets;
  project?: Pick<InkosNovelProject, "protagonist">;
  onOpenCharacterMatrix?: () => void;
}) {
  const { profile, assetContent, assetTags } = findCharacterProfile(
    assets,
    characterName,
    project ?? { protagonist: "" },
  );

  return (
    <div className={styles.characterDetailView}>
      {profile ? (
        <dl className={styles.characterDetailFields}>
          {profile.role ? (
            <>
              <dt>定位</dt>
              <dd>{profile.role}</dd>
            </>
          ) : null}
          {profile.tags ? (
            <>
              <dt>标签</dt>
              <dd>{profile.tags}</dd>
            </>
          ) : null}
          {profile.pending ? (
            <>
              <dt>状态</dt>
              <dd>待确认</dd>
            </>
          ) : null}
          {profile.current ? (
            <>
              <dt>当前状态</dt>
              <dd>{profile.current}</dd>
            </>
          ) : null}
          {profile.chapterNumber ? (
            <>
              <dt>来源章节</dt>
              <dd>
                第 {profile.chapterNumber} 章
                {profile.chapterTitle ? `《${profile.chapterTitle}》` : ""}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {assetContent && assetContent !== profile?.current ? (
        <section className={styles.characterDetailSection}>
          <h3>资产记录</h3>
          <p>{assetContent}</p>
          {assetTags.length > 0 ? (
            <em>{assetTags.map((tag) => `#${tag}`).join(" ")}</em>
          ) : null}
        </section>
      ) : null}
      {!profile && !assetContent ? (
        <p className={styles.emptyMiniState}>
          未找到「{characterName}」的详细资料，可在角色矩阵或资产库中补充。
        </p>
      ) : null}
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
