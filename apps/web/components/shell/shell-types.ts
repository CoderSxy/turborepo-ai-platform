export type AppPage = "home" | "novel" | "models";

export const APP_NAV_ITEMS: Array<{
  page: AppPage;
  label: string;
  description: string;
}> = [
  {
    page: "home",
    label: "首页",
    description: "平台总览",
  },
  {
    page: "novel",
    label: "AI小说创作",
    description: "InkOS 工作台",
  },
  {
    page: "models",
    label: "模型配置",
    description: "服务商与 Key",
  },
];
