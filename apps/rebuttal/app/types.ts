export type Draft = {
  id: string; zh: string; en: string; note: string;
  titleZh?: string; titleEn?: string;
  stage: string; aligned: boolean; revision: number;
  updatedAt: string; versionLabel: string;
};
