"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, CheckCheck, ChevronDown, Copy, Download, Edit3, FileText, History, Languages, LockKeyhole, PanelLeftClose, Plus, RotateCcw, Save, X, ArrowUpRight, Circle, Eye, Loader2 } from "lucide-react";
import seeds from "./seed.json";
import {reviewers,evidence,principles,project} from "./review-data";
import Markdown from "./markdown";
import ReviewPanel from "./review-panel";
import {reviewIssues} from "./review-records";
import type {Draft} from "./types";
const stageNames:Record<string,string>={empty:"待起草",draft:"草稿",ready:"已定稿"};
const time=(v:string)=>new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v));
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
export default function Workbench(){
 const [docs,setDocs]=useState<Draft[]>(clone(seeds)),[saved,setSaved]=useState<Draft[]>(clone(seeds));
 const [id,setId]=useState(seeds[0].id),[view,setView]=useState("reply"),[lang,setLang]=useState("both");
 const [editing,setEditing]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState("");
 const [toast,setToast]=useState(""),[showHistory,setShowHistory]=useState(false),[history,setHistory]=useState<Draft[]>([]),[historyLoading,setHistoryLoading]=useState(false),[selected,setSelected]=useState<Draft|null>(null);
 const [label,setLabel]=useState(""),[limit,setLimit]=useState(5000),[sidebar,setSidebar]=useState(false),[downloadMenu,setDownloadMenu]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const doc=docs.find(d=>d.id===id)!,previous=saved.find(d=>d.id===id)!;
 const dirty=JSON.stringify(doc)!==JSON.stringify(previous);
 const anyDirty=docs.some(d=>JSON.stringify(d)!==JSON.stringify(saved.find(s=>s.id===d.id)));
 const notify=(message:string)=>{setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(""),4000);};
 async function load(){
   setError("");
   try{const res=await fetch("/api/drafts",{cache:"no-store"}),data=await res.json() as {error?:string;documents:Draft[]};if(!res.ok)throw Error(data.error);
     setDocs(data.documents);setSaved(clone(data.documents));setReady(true);
   }catch(e){setError(e instanceof Error?e.message:"读取失败");setReady(false);}
 }
 useEffect(()=>{void load();},[]);
 useEffect(()=>{function guard(e:BeforeUnloadEvent){if(anyDirty){e.preventDefault();e.returnValue="";}}window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard);},[anyDirty]);
 useEffect(()=>{if(showHistory)dialogRef.current?.showModal();else dialogRef.current?.close();},[showHistory]);
 const update=(changes:Partial<Draft>)=>setDocs(all=>all.map(d=>d.id===id?{...d,...changes}:d));
 function changeText(language:"en"|"zh",value:string){update({[language]:value,aligned:false,stage:doc.stage==="empty"?"draft":doc.stage==="ready"?"draft":doc.stage});}
 function changeTitle(language:"en"|"zh",value:string){update({[language==="en"?"titleEn":"titleZh"]:value,aligned:false,stage:doc.stage==="ready"?"draft":doc.stage});}
 async function save(candidate=doc,customLabel=label){
   if(!ready||busy)return;
   if(candidate.stage==="ready"&&(!candidate.en.trim()||!candidate.zh.trim()||!candidate.aligned)){notify("定稿前请补齐两种语言，并确认双语已核对");return;}
   setBusy(true);setError("");
   try{
     const res=await fetch("/api/drafts",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({document:candidate,baseRevision:previous.revision,label:customLabel||"修改回复"})});
     const data=await res.json() as {error?:string;document:Draft};if(!res.ok)throw Error(data.error);
     setDocs(all=>all.map(d=>d.id===candidate.id?data.document:d));setSaved(all=>all.map(d=>d.id===candidate.id?clone(data.document):d));
     setLabel("");setEditing({});setShowHistory(false);notify("已保存到工作台 · v"+data.document.revision);
   }catch(e){setError(e instanceof Error?e.message:"保存失败");}finally{setBusy(false);}
 }
 async function openHistory(){
   setShowHistory(true);setSelected(null);setHistory([]);setHistoryLoading(true);
   try{const res=await fetch("/api/drafts?history="+encodeURIComponent(id),{cache:"no-store"});const data=await res.json() as {error?:string;versions:Draft[]};if(!res.ok)throw Error(data.error);setHistory(data.versions);}
   catch(e){notify(e instanceof Error?e.message:"读取版本失败");}finally{setHistoryLoading(false);}
 }
 async function copy(text:string,isTitle=false){try{await navigator.clipboard.writeText(text);notify(isTitle?"已复制标题 · 粘贴到 Title 栏":"已复制回复正文");}catch{notify("浏览器未允许复制，请选中文字后复制");}}
 function download(name:string,content:string,type="text/markdown;charset=utf-8"){
   const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloadMenu(false);
 }
 const exportBoth=()=>download(id+"-rebuttal-bilingual.md","# "+id+"\n\n## 中文\n\n"+(doc.titleZh?"标题："+doc.titleZh+"\n\n":"")+doc.zh+"\n\n## English\n\n"+(doc.titleEn?"Title: "+doc.titleEn+"\n\n":"")+doc.en);
 const selectDoc=(next:string)=>{if(busy)return;setId(next);setView("reply");setEditing({});setLabel("");setSidebar(false);};
 return <div className="shell">
   <aside className={"sidebar "+(sidebar?"mobile-open":"")}>
     <div className="brand"><span className="brand-icon"><BookOpen size={22}/></span><div>{project.name}<span>REBUTTAL STUDIO</span></div><button className="mobile-close icon-button" aria-label="收起导航" onClick={()=>setSidebar(false)}><X size={18}/></button></div>
     <div className="project-label">{project.venue} <span>{project.label}</span></div>
     <div className="nav-label">回复文稿 <span>{docs.filter(d=>d.id!=="General"&&d.en&&d.zh).length.toString().padStart(2,"0")} / {reviewers.filter(r=>r.id!=="General").length.toString().padStart(2,"0")}</span></div>
     <nav aria-label="回复文稿">{reviewers.map(r=><button key={r.id} className={"nav-item "+(id===r.id?"active":"")} onClick={()=>selectDoc(r.id)}><span className="nav-number">{r.number}</span><span className="nav-copy"><b>{r.name}</b><small>{r.subtitle}</small></span><span className={"nav-dot "+docs.find(d=>d.id===r.id)?.stage}/></button>)}</nav>
     <div className="sidebar-note"><span className="eyebrow">写作提醒</span><p>先把问题回答清楚。<br/>让证据说话，句子自然一些。</p><button onClick={()=>{setView("style");setSidebar(false);}}>查看写作约定 <ArrowUpRight size={13}/></button></div>
     <div className="sidebar-bottom"><LockKeyhole size={14}/><span>本地工作台</span><small>未提交 OpenReview</small></div>
   </aside>
   <main>
     <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-toggle" aria-label="打开导航" onClick={()=>setSidebar(true)}><PanelLeftClose size={18}/></button><span>审稿回复</span><span className="slash">/</span><b>{id==="General"?"公共回复":id}</b></div><div className="top-actions"><span className={"save-state "+(dirty?"unsaved":"")}>{busy?<Loader2 size={13} className="spin"/>:dirty?<Circle size={8}/>:<Check size={13}/>} {busy?"正在保存":dirty?"有未保存修改":ready?"已载入保存版本":"正在连接"}</span><button className="button ghost" onClick={openHistory}><History size={15}/><span>版本记录</span></button><button className="button primary" onClick={()=>void save()} disabled={!ready||busy||!dirty}>{busy?<Loader2 size={15} className="spin"/>:<Save size={15}/>}保存版本</button></div></header>
     <div className="workspace">
       {error&&<div className="error-banner" role="alert"><span>{error}</span><button onClick={()=>{if(!anyDirty||window.confirm("重新载入会替换未保存内容，请先导出备份。是否继续？"))void load();}}>重新载入</button></div>}
       <section className="heading"><div><div className="eyebrow">RESPONSE / {reviewers.find(r=>r.id===id)?.number}</div><h1>{id==="General"?"公共回复":id+" 的回复"}<span className={"status-pill "+doc.stage}>{stageNames[doc.stage]}</span></h1><p>{id==="General"?"在这里汇总共性回应与论文修改位置。":"中英文对照，围绕审稿意见逐点回应。"}</p></div><div className="heading-meta"><span>{doc.revision===0?"初始文稿":"v"+doc.revision+" · "+time(doc.updatedAt)}</span><label><input type="checkbox" checked={doc.aligned} disabled={busy} onChange={e=>update({aligned:e.target.checked})}/>{doc.aligned?"双语已核对":"双语待核对"}</label></div></section>
       <div className="tabs" role="tablist" aria-label="工作区视图">{[["reply","回复正文"],["original","原始审稿"],["review","逐点核对"],["evidence","证据摘要"],["style","写作约定"]].map(([value,title])=><button role="tab" aria-selected={view===value} className={view===value?"active":""} key={value} onClick={()=>setView(value)}>{title}{value==="review"&&reviewIssues[id]&&<span>{reviewIssues[id].length}</span>}</button>)}</div>
       {view==="reply"&&<>
         <div className="document-toolbar"><div className="language-switch" aria-label="阅读语言">{[["both","中英对照"],["zh","中文"],["en","English"]].map(([value,title])=><button key={value} className={lang===value?"active":""} onClick={()=>setLang(value)}>{value==="both"&&<Languages size={14}/>} {title}</button>)}</div><div className="toolbar-end"><label className="budget">英文预算 <input aria-label="英文字符预算" type="number" min={100} max={50000} value={limit} onChange={e=>setLimit(Number(e.target.value)||5000)}/> 字符</label><div className="export-wrap"><button className="button ghost" aria-expanded={downloadMenu} onClick={()=>setDownloadMenu(!downloadMenu)}><Download size={15}/>导出<ChevronDown size={12}/></button>{downloadMenu&&<div className="dropdown"><button onClick={exportBoth}>中英文文稿 · Markdown</button><button onClick={()=>download(id+"-en.md",doc.en)}>英文正文 · Markdown</button><button onClick={()=>download("rebuttal-backup.json",JSON.stringify({exportedAt:new Date().toISOString(),documents:docs},null,2),"application/json")}>全部文稿备份 · JSON</button></div>}</div></div></div>
         <div className={"document-grid "+(lang==="both"?"":"single")}>{(["zh","en"] as const).filter(l=>lang==="both"||lang===l).map(l=><article className={"document "+l} key={l}><div className="document-head"><div><span className="language-mark">{l==="zh"?"中":"EN"}</span><strong>{l==="zh"?"中文稿":"English draft"}</strong></div><div><button className="icon-button" title={l==="zh"?"复制中文":"复制英文"} aria-label={l==="zh"?"复制中文":"复制英文"} onClick={()=>void copy(doc[l])} disabled={!doc[l]}><Copy size={15}/></button><button className={"small-button "+(editing[l]?"selected":"")} disabled={busy} onClick={()=>setEditing(s=>({...s,[l]:!s[l]}))}>{editing[l]?<Eye size={14}/>:<Edit3 size={14}/>} {editing[l]?"预览":"编辑"}</button></div></div>
           <section className="reply-title"><div className="reply-title-head"><label htmlFor={"reply-title-"+l}>{l==="zh"?"中文标题":"English title"}<span>Title</span></label><button className="small-button" aria-label={l==="zh"?"复制中文标题":"复制英文标题"} disabled={!(l==="zh"?doc.titleZh:doc.titleEn)} onClick={()=>void copy((l==="zh"?doc.titleZh:doc.titleEn)??"",true)}><Copy size={13}/>复制标题</button></div><textarea id={"reply-title-"+l} aria-label={l==="zh"?"编辑中文标题":"编辑英文标题"} rows={3} maxLength={1000} value={(l==="zh"?doc.titleZh:doc.titleEn)??""} placeholder={l==="zh"?"填写中文标题，方便对照":"Add a title for the OpenReview comment"} disabled={busy||!ready} onChange={e=>changeTitle(l,e.target.value)}/><p>标题单独填写到 Title 栏，不计入正文字符数。</p></section>
           {editing[l]?<textarea aria-label={l==="zh"?"编辑中文回复":"编辑英文回复"} className="draft-editor" value={doc[l]} spellCheck={l==="en"} onChange={e=>changeText(l,e.target.value)} disabled={busy}/> :doc[l]?<div className="document-body"><Markdown text={doc[l]}/></div>:<div className="empty-state"><FileText size={34}/><h3>这份回复还没有正文</h3><p>在这里写入{l==="zh"?"中文":"英文"}，保存后会保留版本记录。</p><button className="button" onClick={()=>setEditing(s=>({...s,[l]:true}))}><Plus size={15}/>开始起草</button></div>}
           <footer className="document-footer"><span>{editing[l]?"编辑后请保存版本":"回复正文 · 可直接复制"}</span><span className={l==="en"&&doc[l].length>limit?"over-budget":""}>{doc[l].length.toLocaleString()} {l==="en"?"/ "+limit.toLocaleString():""} 字符</span></footer></article>)}</div>
         <section className="save-strip"><div><label htmlFor="version-label">这次改了什么？</label><input id="version-label" placeholder="例如：精简贡献段，调整覆盖解释（可选）" value={label} disabled={busy} maxLength={150} onChange={e=>setLabel(e.target.value)}/></div><label className="stage-select">文稿状态<select value={doc.stage} disabled={busy} onChange={e=>update({stage:e.target.value})}><option value="empty">待起草</option><option value="draft">草稿</option><option value="ready">已定稿</option></select></label></section>
         <details className="notes"><summary>内部修改备注 <span>不包含在回复导出中</span></summary><textarea aria-label="内部修改备注" placeholder="记录后续想改的地方或需要核对的事实…" value={doc.note} disabled={busy} onChange={e=>update({note:e.target.value})}/></details>
       </>}
       {(view==="original"||view==="review")&&<ReviewPanel doc={doc} mode={view==="original"?"original":"check"} dirty={dirty} onReply={()=>setView("reply")}/>}
       {view==="evidence"&&<><div className="section-intro"><div><h2>支持当前回复的证据</h2><p>检索、完整覆盖和计时分别呈现，避免混用指标。</p></div></div><div className="evidence-grid">{evidence.map(e=><section className="evidence-card" key={e.title}><span className="eyebrow">已核查</span><h3>{e.title}</h3><strong>{e.metric}</strong><p>{e.body}</p><small>{e.source}</small></section>)}</div><p className="source-note">此处展示演示证据卡片。使用自己的项目时，请在 review-data.ts 中维护来源。</p></>}
       {view==="style"&&<section className="style-area"><div className="section-intro"><div><h2>写得像作者在认真回答</h2><p>自然、具体。少一些模板化总结，多说明实验究竟回答了什么。</p></div></div>{principles.map(([title,body],i)=><div className="principle" key={title}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}</section>}
       <div className="page-foot"><span>{project.name} · {project.venue}</span><span>保存的是工作稿，定稿状态不代表已提交。</span></div>
     </div>
   </main>
   <dialog ref={dialogRef} onCancel={()=>setShowHistory(false)} className="history-dialog"><header><div><div className="eyebrow">VERSION HISTORY</div><h2>{id} · 版本记录</h2></div><button className="icon-button" aria-label="关闭版本记录" onClick={()=>setShowHistory(false)}><X size={20}/></button></header><div className="history-layout"><nav>{historyLoading?<p>正在读取版本…</p>:history.map(v=><button key={v.revision} className={selected?.revision===v.revision?"active":""} onClick={()=>setSelected(v)}><b>{v.revision===0?"初始稿":"v"+v.revision}{v.revision===doc.revision&&" · 当前"}</b><span>{v.versionLabel}</span><small>{v.revision===0?"首次润色":time(v.updatedAt)}</small></button>)}</nav><div className="history-preview">{selected?<><div className="history-tools"><p>恢复会创建新版本，保留已有记录。</p><button className="button" disabled={busy||dirty||selected.revision===doc.revision||!ready} onClick={()=>void save({...selected,titleZh:selected.titleZh??"",titleEn:selected.titleEn??"",revision:doc.revision},"恢复自 "+(selected.revision===0?"初始稿":"v"+selected.revision))}><RotateCcw size={14}/>恢复此版本</button></div>{dirty&&<p className="scope-note">请先保存或导出当前修改，再恢复历史版本。</p>}<h3>中文</h3>{selected.titleZh&&<p className="history-title">标题：{selected.titleZh}</p>}<Markdown text={selected.zh}/><hr/><h3>English</h3>{selected.titleEn&&<p className="history-title">Title: {selected.titleEn}</p>}<Markdown text={selected.en}/></>:<div className="empty-panel"><History size={30}/><p>选择一个版本，查看当时的中英文内容。</p></div>}</div></div></dialog>
   {toast&&<div role="status" className="toast"><CheckCheck size={16}/>{toast}</div>}
 </div>;
}
