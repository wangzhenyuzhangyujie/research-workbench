import React from "react";
function inline(text:string):React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part,i)=>
    part.startsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong> :
    part.startsWith("`") ? <code key={i}>{part.slice(1,-1)}</code> : part);
}
const cells=(line:string)=>line.trim().replace(/^\|/,"").replace(/\|$/,"").split("|").map(s=>s.trim());
export default function Markdown({text}:{text:string}){
  const lines=text.split("\n"), nodes:React.ReactNode[]=[];
  for(let i=0;i<lines.length;){
    const line=lines[i].trim();
    if(!line){i++;continue;}
    if(line.startsWith("|") && i+1<lines.length && /^\|?[\s:|-]+$/.test(lines[i+1])){
      const head=cells(line),rows:string[][]=[];i+=2;
      while(i<lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      nodes.push(<div className="table-scroll" key={i}><table><thead><tr>{head.map((c,j)=><th key={j}>{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}>{inline(c)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    if(/^\*\*\d/.test(line) && line.endsWith("**")){nodes.push(<h3 key={i}>{line.slice(2,-2)}</h3>);i++;continue;}
    if(/^#{1,3}\s/.test(line)){nodes.push(<h3 key={i}>{line.replace(/^#+\s/,"")}</h3>);i++;continue;}
    if(/^[-*]\s/.test(line)){const items=[];while(i<lines.length&&/^[-*]\s/.test(lines[i].trim()))items.push(lines[i++].trim().slice(2));nodes.push(<ul key={i}>{items.map((v,j)=><li key={j}>{inline(v)}</li>)}</ul>);continue;}
    const para=[line];i++;
    while(i<lines.length&&lines[i].trim()&&!/^(\||#|\*\*\d|[-*]\s)/.test(lines[i].trim()))para.push(lines[i++].trim());
    nodes.push(<p key={i}>{inline(para.join(" "))}</p>);
  }
  return <div className="prose">{nodes}</div>;
}
