"use client";
import { ArrowUpRight, FileText, MessageSquareText } from "lucide-react";
import { reviewRecords, reviewIssues } from "./review-records";
import type { Draft } from "./types";
import Markdown from "./markdown";
import OriginalReview from "./original-review";
import { issueTranslation, issueSourceLabel } from "./review-reference";

export function extractReplySection(text:string,section?:number){
 if(!section||!text.trim())return "";
 const headings=[...text.matchAll(/^(?:\*\*|#{1,3}\s+)(\d+)\.\s.+$/gm)];
 const at=headings.findIndex(h=>Number(h[1])===section);
 if(at<0)return "";
 return text.slice(headings[at].index,headings[at+1]?.index??text.length).trim();
}
export default function ReviewPanel({doc,mode,dirty,onReply}:{doc:Draft;mode:"original"|"check";dirty:boolean;onReply:()=>void}){
 const review=reviewRecords[doc.id],items=reviewIssues[doc.id]??[];
 if(!review)return <div className="empty-panel"><FileText size={32}/><h2>公共回复没有单独的审稿原文</h2><p>请从左侧选择审稿人，查看原始意见和逐项核对。</p></div>;
 return <section className="review-area">
  <div className="section-intro"><div><div className="eyebrow">{mode==="original"?"REVIEWER'S WORDS":"REVIEW → RESPONSE"}</div><h2>{mode==="original"?doc.id+" 的完整审稿意见":"逐项检查：原意、证据与当前回复"}</h2><p>{mode==="original"?"演示意见及对应中文译文。可切换中文全文、中英对照或英文原文。":"每项直接显示原评价中文，英文可展开。顶部编号始终可查：悬停看原话，点击跳到对应评价。"}</p></div>{review.screenshot&&<a href={review.screenshot} target="_blank" rel="noreferrer" className="button ghost">原始截图 <ArrowUpRight size={14}/></a>}</div>
  {mode==="original"?<>
   <OriginalReview id={doc.id} review={review}/>
  </>:<>
   <div className="review-check-banner"><div><strong>{items.length} 项关切已整理</strong><span>{doc.en.trim()?`当前回复 v${doc.revision}${dirty?" · 含未保存修改":""}`:"当前回复尚未起草"}</span></div><p>“有对应段落”只表示已定位到文字，不代表问题已解决或审稿人已认可。回复片段直接读取当前文稿，中文整理与证据提示供你逐项判断。</p></div>
   <nav className="review-reference-nav" aria-label="审稿意见速查"><span>W = 弱点 · Q = 问题</span><div>{items.map(item=><a key={item.id} href={"#review-"+doc.id+"-"+item.id} title={issueSourceLabel(item.id)+"\n"+issueTranslation(doc.id,item.id)}><b>{item.id}</b><span>{item.meaning.split(/[：:？]/)[0]}</span></a>)}</div></nav>
   {items.map((issue,index)=>{
    const zh=extractReplySection(doc.zh,issue.section),en=extractReplySection(doc.en,issue.section),found=!!(zh||en);
    const originalZh=issueTranslation(doc.id,issue.id);
    const related=items.filter(item=>item.section===issue.section);
    return <article className="review-check-card" id={"review-"+doc.id+"-"+issue.id} key={issue.id}>
     <header><span className="issue-id" tabIndex={0} title={issueSourceLabel(issue.id)+"\n"+originalZh}>{issue.id}</span><h3>{issue.meaning}</h3><span className={"status-pill "+(found?"draft":"partial")}>{found?"有对应段落":doc.en.trim()?"待定位回复":"待起草"}</span></header>
     <div className="review-comparison"><section className="review-quote"><span className="eyebrow">对应原评价 · 中文译文</span><small>{issueSourceLabel(issue.id)} · {issue.source}</small><blockquote className="review-quote-zh">{originalZh}</blockquote><details className="source-english"><summary>查看英文原话</summary><blockquote lang="en">{issue.original}</blockquote></details></section><section className="review-interpretation"><span className="eyebrow">中文整理 · 我的判断</span><h4>这项需要回答什么</h4><p>{issue.needed}</p><h4>现有证据</h4><p>{issue.evidence}</p><div className="review-check-note"><b>核对时留意</b><p>{issue.check}</p></div></section></div>
     {found?<details className="reply-match" open={index===0}><summary><MessageSquareText size={15}/><span>查看当前对应回复 · 第 {issue.section} 节 · 中英文</span></summary><div className="reply-source-context"><strong>这段回复对应的原评价</strong>{related.map(item=><details key={item.id}><summary title={issueTranslation(doc.id,item.id)}><b>{item.id}</b><span>{item.meaning}</span></summary><p>{issueTranslation(doc.id,item.id)}</p></details>)}</div><div className="matched-replies"><section><h4>中文回复 · 当前文字</h4>{zh?<Markdown text={zh}/>:<p>未找到中文对应段落</p>}</section><section className="en"><h4>English · Current draft</h4>{en?<Markdown text={en}/>:<p>未找到英文对应段落</p>}</section></div><button className="button ghost" onClick={onReply}>回到回复编辑 <ArrowUpRight size={14}/></button></details>:<div className="reply-missing"><FileText size={15}/><span>{doc.en.trim()?"没有定位到对应章节，请在正文中核对。":"这项尚未写入该审稿人的回复。"}</span><button className="small-button" onClick={onReply}>进入回复</button></div>}
    </article>;
   })}
   <p className="source-note">这些检查提示仅用于内部写作，不会被复制进回复正文。修改章节顺序后，请重新核对段落对应关系。</p>
  </>}
 </section>;
}
