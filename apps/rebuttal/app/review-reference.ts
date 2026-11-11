import { reviewTranslations } from "./review-translations";
export function issueSourceLabel(id:string){
 const match=id.match(/^([WQ])(\d+)([a-z]?)$/);
 if(!match)return id;
 return `原审稿 · ${match[1]==="W"?"主要弱点":"向作者提问"}第 ${match[2]} 条${match[3]?"（拆分摘录 "+match[3]+"）":""}`;
}
export function issueTranslation(reviewer:string,id:string){
 const match=id.match(/^([WQ])(\d+)$/);
 if(!match)return "";
 return reviewTranslations[reviewer]?.[match[1]==="W"?"weaknesses":"questions"]?.[Number(match[2])-1]??"";
}
