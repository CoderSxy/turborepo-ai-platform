export type InkosCreationStageKey =
  | "foundation"
  | "outline"
  | "chapter-plan"
  | "draft"
  | "review"
  | "polish";

export type InkosChapterStatus =
  | "planned"
  | "drafting"
  | "ready-for-review"
  | "approved";

export type InkosCreationStage = {
  key: InkosCreationStageKey;
  label: string;
  description: string;
  coreRole: string;
};

export type InkosChapter = {
  number: number;
  title: string;
  status: InkosChapterStatus;
  targetWords: number;
  focus: string;
};

export type InkosNovelProject = {
  title: string;
  genre: string;
  platform: string;
  language: "zh" | "en";
  targetChapters: number;
  chapterWordCount: number;
  premise: string;
  protagonist: string;
  world: string;
  currentStage: InkosCreationStageKey;
  chapters: InkosChapter[];
};

export type InkosProjectStats = {
  approvedChapters: number;
  readyForReviewChapters: number;
  draftedChapters: number;
  plannedChapters: number;
  progressPercent: number;
  targetWords: number;
};

export const INKOS_CREATION_STAGES: InkosCreationStage[] = [
  {
    key: "foundation",
    label: "基础设定",
    description: "沉淀书名、类型、世界观、主角动机和第一卷核心冲突。",
    coreRole: "BookConfig / Foundation",
  },
  {
    key: "outline",
    label: "全书大纲",
    description: "拆出卷纲、关键转折、长线伏笔和章节节奏。",
    coreRole: "PlannerAgent",
  },
  {
    key: "chapter-plan",
    label: "章节计划",
    description: "生成当前章节的意图、上下文包、规则栈和写作约束。",
    coreRole: "PlanChapterInput",
  },
  {
    key: "draft",
    label: "正文生成",
    description: "基于章节计划生成正文草稿，并保留可审稿的上下文痕迹。",
    coreRole: "ComposerAgent",
  },
  {
    key: "review",
    label: "审稿校验",
    description: "检查连续性、设定一致性、节奏、AI 味和章节目标完成度。",
    coreRole: "StateValidator",
  },
  {
    key: "polish",
    label: "润色定稿",
    description: "按风格目标做局部修订、去模板化、同步状态并归档章节。",
    coreRole: "Reviser / Polisher",
  },
];

export const INKOS_STATUS_LABELS: Record<InkosChapterStatus, string> = {
  planned: "计划中",
  drafting: "生成中",
  "ready-for-review": "待审稿",
  approved: "已定稿",
};

export function createDemoInkosProject(): InkosNovelProject {
  return {
    title: "裂缝中的阳光",
    genre: "都市悬疑 / 现实异能",
    platform: "平台通用",
    language: "zh",
    targetChapters: 120,
    chapterWordCount: 3000,
    premise:
      "一座总在雨后出现异常裂缝的城市里，旧案记录员发现每道裂缝都会泄露一个被篡改的人生。",
    protagonist:
      "林照，档案修复师，习惯把真相藏进备份，却被迫追查自己缺失的三年。",
    world:
      "近未来南方城市，公共记忆系统被商业公司托管，裂缝会让被删除的记忆短暂具象化。",
    currentStage: "chapter-plan",
    chapters: [
      {
        number: 1,
        title: "雨后裂缝",
        status: "approved",
        targetWords: 3200,
        focus: "建立城市异常、主角职业和第一枚被删除的记忆证据。",
      },
      {
        number: 2,
        title: "缺页档案",
        status: "ready-for-review",
        targetWords: 3000,
        focus: "主角发现自己的档案存在空白，旧同事试图阻止他调取备份。",
      },
      {
        number: 3,
        title: "备份人",
        status: "drafting",
        targetWords: 3000,
        focus: "引入能在裂缝中保持清醒的关键证人，并埋下公司监控线。",
      },
      {
        number: 4,
        title: "旧城蓝光",
        status: "planned",
        targetWords: 3000,
        focus: "追踪第一卷核心地点，揭示裂缝和公共记忆系统的关系。",
      },
    ],
  };
}

export function getCurrentStage(project: InkosNovelProject): InkosCreationStage {
  return (
    INKOS_CREATION_STAGES.find((stage) => stage.key === project.currentStage) ??
    INKOS_CREATION_STAGES[0]!
  );
}

export function deriveInkosProjectStats(
  project: InkosNovelProject,
): InkosProjectStats {
  const approvedChapters = project.chapters.filter(
    (chapter) => chapter.status === "approved",
  ).length;
  const readyForReviewChapters = project.chapters.filter(
    (chapter) => chapter.status === "ready-for-review",
  ).length;
  const draftedChapters = project.chapters.filter(
    (chapter) => chapter.status === "drafting",
  ).length;
  const plannedChapters = Math.max(project.targetChapters - approvedChapters, 0);
  const progressPercent = Math.round(
    (approvedChapters / Math.max(project.targetChapters, 1)) * 100,
  );

  return {
    approvedChapters,
    readyForReviewChapters,
    draftedChapters,
    plannedChapters,
    progressPercent,
    targetWords: project.targetChapters * project.chapterWordCount,
  };
}

export function buildInkosPromptPreview(project: InkosNovelProject): string {
  const stage = getCurrentStage(project);

  return [
    `# ${stage.label}`,
    `书名：${project.title}`,
    `题材：${project.genre}`,
    `世界观：${project.world}`,
    `主角：${project.protagonist}`,
    `核心设定：${project.premise}`,
    `目标：按 ${project.chapterWordCount} 字/章推进，当前由 ${stage.coreRole} 接管。`,
  ].join("\n");
}
