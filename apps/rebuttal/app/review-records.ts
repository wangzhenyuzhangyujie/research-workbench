export type ReviewRecord = {
  screenshot:string; summary:string[]; strengths:string[]; weaknesses:string[]; questions:string[];
  presentation:string; informativeness:string; soundness:string; rating:string; confidence:string; ethics:string; ethicsDetails?:string;
};
export const reviewRecords:Record<string,ReviewRecord>={
  "R1": {
    "screenshot": "",
    "summary": [
      "This fictional paper describes a document-ranking system. This demonstration review focuses on comparison protocol."
    ],
    "strengths": [
      "The research question is clearly stated."
    ],
    "weaknesses": [
      "Please clarify the comparison protocol."
    ],
    "questions": [
      "What evidence supports your claims about comparison protocol?"
    ],
    "presentation": "Clear",
    "informativeness": "Useful",
    "soundness": "Needs clarification",
    "rating": "Demo only",
    "confidence": "Demo only",
    "ethics": "No"
  },
  "R2": {
    "screenshot": "",
    "summary": [
      "This fictional paper describes a document-ranking system. This demonstration review focuses on method contribution."
    ],
    "strengths": [
      "The research question is clearly stated."
    ],
    "weaknesses": [
      "Please clarify the method contribution."
    ],
    "questions": [
      "What evidence supports your claims about method contribution?"
    ],
    "presentation": "Clear",
    "informativeness": "Useful",
    "soundness": "Needs clarification",
    "rating": "Demo only",
    "confidence": "Demo only",
    "ethics": "No"
  },
  "R3": {
    "screenshot": "",
    "summary": [
      "This fictional paper describes a document-ranking system. This demonstration review focuses on runtime cost."
    ],
    "strengths": [
      "The research question is clearly stated."
    ],
    "weaknesses": [
      "Please clarify the runtime cost."
    ],
    "questions": [
      "What evidence supports your claims about runtime cost?"
    ],
    "presentation": "Clear",
    "informativeness": "Useful",
    "soundness": "Needs clarification",
    "rating": "Demo only",
    "confidence": "Demo only",
    "ethics": "No"
  }
};
export type ReviewIssue={id:string;source:string;original:string;meaning:string;needed:string;evidence:string;check:string;section?:number};
export const reviewIssues:Record<string,ReviewIssue[]>={
  "R1": [
    {
      "id": "W1",
      "source": "Critical Weaknesses",
      "original": "Please clarify the comparison protocol.",
      "meaning": "比较条件",
      "needed": "直接回答该问题，并给出可核查的依据。",
      "evidence": "演示：在此填写证据来源与对应结论。",
      "check": "确认回复和证据使用相同的比较条件。",
      "section": 1
    },
    {
      "id": "Q1",
      "source": "Questions for Authors",
      "original": "What evidence supports your claims about comparison protocol?",
      "meaning": "支持主张的证据",
      "needed": "解释新增分析如何回答问题。",
      "evidence": "演示：在此填写分析或结果表的路径。",
      "check": "核对数字、单位和研究范围。",
      "section": 1
    }
  ],
  "R2": [
    {
      "id": "W1",
      "source": "Critical Weaknesses",
      "original": "Please clarify the method contribution.",
      "meaning": "方法贡献",
      "needed": "直接回答该问题，并给出可核查的依据。",
      "evidence": "演示：在此填写证据来源与对应结论。",
      "check": "确认回复和证据使用相同的比较条件。",
      "section": 1
    },
    {
      "id": "Q1",
      "source": "Questions for Authors",
      "original": "What evidence supports your claims about method contribution?",
      "meaning": "支持主张的证据",
      "needed": "解释新增分析如何回答问题。",
      "evidence": "演示：在此填写分析或结果表的路径。",
      "check": "核对数字、单位和研究范围。",
      "section": 1
    }
  ],
  "R3": [
    {
      "id": "W1",
      "source": "Critical Weaknesses",
      "original": "Please clarify the runtime cost.",
      "meaning": "运行成本",
      "needed": "直接回答该问题，并给出可核查的依据。",
      "evidence": "演示：在此填写证据来源与对应结论。",
      "check": "确认回复和证据使用相同的比较条件。",
      "section": 1
    },
    {
      "id": "Q1",
      "source": "Questions for Authors",
      "original": "What evidence supports your claims about runtime cost?",
      "meaning": "支持主张的证据",
      "needed": "解释新增分析如何回答问题。",
      "evidence": "演示：在此填写分析或结果表的路径。",
      "check": "核对数字、单位和研究范围。",
      "section": 1
    }
  ]
};
