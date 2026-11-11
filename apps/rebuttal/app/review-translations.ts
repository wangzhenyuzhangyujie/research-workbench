import type {ReviewRecord} from "./review-records";
export const reviewTranslations:Record<string,Omit<ReviewRecord,"screenshot">>={
  "R1": {
    "summary": [
      "这是一篇虚构的文档排序论文，演示意见关注比较条件。"
    ],
    "strengths": [
      "研究问题表达清楚。"
    ],
    "weaknesses": [
      "请解释比较条件。"
    ],
    "questions": [
      "哪些证据支持有关比较条件的主张？"
    ],
    "presentation": "清晰",
    "informativeness": "有用",
    "soundness": "需要解释",
    "rating": "仅为演示",
    "confidence": "仅为演示",
    "ethics": "否"
  },
  "R2": {
    "summary": [
      "这是一篇虚构的文档排序论文，演示意见关注方法贡献。"
    ],
    "strengths": [
      "研究问题表达清楚。"
    ],
    "weaknesses": [
      "请解释方法贡献。"
    ],
    "questions": [
      "哪些证据支持有关方法贡献的主张？"
    ],
    "presentation": "清晰",
    "informativeness": "有用",
    "soundness": "需要解释",
    "rating": "仅为演示",
    "confidence": "仅为演示",
    "ethics": "否"
  },
  "R3": {
    "summary": [
      "这是一篇虚构的文档排序论文，演示意见关注运行成本。"
    ],
    "strengths": [
      "研究问题表达清楚。"
    ],
    "weaknesses": [
      "请解释运行成本。"
    ],
    "questions": [
      "哪些证据支持有关运行成本的主张？"
    ],
    "presentation": "清晰",
    "informativeness": "有用",
    "soundness": "需要解释",
    "rating": "仅为演示",
    "confidence": "仅为演示",
    "ethics": "否"
  }
};
