"use client";
import { useState } from "react";
import { Languages } from "lucide-react";
import type { ReviewRecord } from "./review-records";
import { reviewTranslations } from "./review-translations";

type Language="both"|"zh"|"en";
function Pair({zh,en,language}:{zh:string;en:string;language:Language}){
 return <div className={"review-language-pair "+(language==="both"?"":"single")}>
  {language!=="en"&&<p className="review-zh" lang="zh-CN">{zh}</p>}
  {language!=="zh"&&<p className="review-en" lang="en">{en}</p>}
 </div>;
}
export default function OriginalReview({id,review}:{id:string;review:ReviewRecord}){
 const [language,setLanguage]=useState<Language>("both");
 const translated=reviewTranslations[id];
 const label=(zh:string,en:string)=>language==="en"?en:language==="zh"?zh:zh+" · "+en;
 const pair=(zh:string,en:string)=><Pair zh={zh} en={en} language={language}/>;
 const points=(name:"strengths"|"weaknesses"|"questions",prefix:string)=>review[name].map((text,i)=><div className="original-bilingual-point" key={i}>{text!=="N/A"&&<span className="original-point-id">{prefix}{i+1}</span>}{pair(translated[name][i],text)}</div>);
 return <>
  <div className="original-language-toolbar"><div className="language-switch" role="group" aria-label="原始审稿阅读语言">{([["zh","中文全文"],["both","中英对照"],["en","English"]] as const).map(([value,title])=><button key={value} aria-pressed={language===value} className={language===value?"active":""} onClick={()=>setLanguage(value)}>{value==="both"&&<Languages size={14}/>} {title}</button>)}</div><p>中文为完整译文，保留审稿人的原意；回应分析请看“逐点核对”。</p></div>
  <div className="review-ratings">{([["rating","评分","Rating"],["confidence","信心","Confidence"],["soundness","可靠性","Soundness"]] as const).map(([key,zh,en])=><div key={key}><span>{label(zh,en)}</span><strong>{language==="en"?review[key]:translated[key]}</strong>{language==="both"&&<small>{review[key]}</small>}</div>)}</div>
  <article className={"original-review bilingual-original "+language} aria-label={id+" 审稿全文"}>
   <div className={"original-column-labels "+(language==="both"?"":"single")}>
    {language!=="en"&&<span>中文译文 · 审稿人意见</span>}{language!=="zh"&&<span>English · Original review</span>}
   </div>
   <section><h3>{label("论文总结","Paper Summary")}</h3>{review.summary.map((text,i)=><Pair key={i} zh={translated.summary[i]} en={text} language={language}/>)}</section>
   <div className="translated-metadata">{([["presentation","表达质量","Presentation"],["informativeness","信息价值","Informativeness"],["soundness","可靠性","Soundness"]] as const).map(([key,zh,en])=><section key={key}><h4>{label(zh,en)}</h4>{pair(translated[key],review[key])}</section>)}</div>
   <section><h3>{label("主要优点","Critical Strengths")}</h3>{points("strengths","S")}</section>
   <section><h3>{label("主要弱点","Critical Weaknesses")}</h3>{points("weaknesses","W")}</section>
   <section><h3>{label("向作者提出的问题","Questions for Authors")}</h3>{points("questions","Q")}</section>
   <div className="translated-metadata"><section><h4>{label("是否需要伦理审查","Flag For Ethics Review")}</h4>{pair(translated.ethics,review.ethics)}</section>{review.ethicsDetails&&<section><h4>{label("伦理问题详情","Details Of Ethics Concerns")}</h4>{pair(translated.ethicsDetails??"",review.ethicsDetails)}</section>}<section><h4>{label("评分","Rating")}</h4>{pair(translated.rating,review.rating)}</section><section><h4>{label("信心","Confidence")}</h4>{pair(translated.confidence,review.confidence)}</section></div>
  </article>
  {review.screenshot&&<details className="original-image"><summary>展开原始截图核对</summary><a href={review.screenshot} target="_blank" rel="noreferrer"><img src={review.screenshot} alt={id+" 审稿原图"}/></a></details>}
  <p className="source-note">这里展示的是审稿人的评价及其中文译文，不是作者的回应。S / W / Q 是便于对照的编号；请自行维护原文与译文。</p>
 </>;
}
