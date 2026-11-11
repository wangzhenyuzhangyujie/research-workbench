"""Small balanced LaTeX tabular reader for the two editable manuscripts."""
import re,html
from functools import lru_cache
ZH={'Method':'方法','Score':'得分','Baseline':'基线','Proposed':'本文方法'}

def arg(s,pos):
 while pos<len(s) and s[pos].isspace():pos+=1
 if pos>=len(s) or s[pos]!='{':return '',pos
 start=pos+1;depth=1;pos+=1
 while pos<len(s) and depth:
  if s[pos]=='{' and s[pos-1]!='\\':depth+=1
  if s[pos]=='}' and s[pos-1]!='\\':depth-=1
  pos+=1
 return s[start:pos-1],pos

def split(s,delim):
 out=[];start=0;depth=0;i=0
 while i<len(s):
  c=s[i]
  if depth==0 and s.startswith(delim,i):out.append(s[start:i]);i+=len(delim);start=i;continue
  if c=='\\' and i+1<len(s) and s[i+1] in '{}&%':i+=2;continue
  if c=='{':depth+=1
  if c=='}':depth-=1
  i+=1
 out.append(s[start:]);return out

def clean_cell(s):
 s=s.replace(r'\\',' ');s=s.strip();s=re.sub(r'\\(?:textbf|textit|underline|emph|texttt|textsc|makecell|shortstack)(?:\[[^]]*\])?\{',r'{',s)
 s=s.replace(r'\textsubscript{original}',' original').replace(r'\ ',' ').replace(r'\_','_').replace(r'\&','&').replace(r'\%','%')
 s=re.sub(r'\\color\{[^}]*\}','',s);s=s.replace('$','').replace(r'\uparrow','↑').replace(r'\downarrow','↓')
 s=re.sub(r'\\(?:ttfamily|small|footnotesize)','',s);s=s.replace('{','').replace('}','').replace('~',' ').replace('^','')
 s=re.sub(r'\s+',' ',s).strip();return ZH.get(s,s)

def render(tex):
 m=re.search(r'\\begin\{(tabular\*|tabularx?)\}',tex)
 if not m:raise ValueError('Table without tabular environment')
 name=m[1];pos=m.end()
 if name in ('tabularx','tabular*'):_,pos=arg(tex,pos)
 _,pos=arg(tex,pos);s=tex[pos:tex.index('\\end{'+name+'}',pos)]
 s=re.sub(r'(?<!\\)%[^\n]*','',s)
 s=re.sub(r'\\(?:toprule|midrule|bottomrule|hline|addlinespace)(?:\[[^]]*\])?','',s)
 s=re.sub(r'\\cmidrule(?:\([^)]*\))?\{[^}]*\}','',s)
 s=re.sub(r'\\rowcolor(?:\[[^]]*\])?\{[^}]*\}','',s)
 rows=[]
 for row in split(s,r'\\'):
  row=re.sub(r'^\s*\[[^]]+\]','',row).strip()
  if not row:continue
  cells=[]
  for raw in split(row,'&'):
   cell=raw.strip();col=1;rowspan=1;bold='\\textbf' in cell;underlined='\\underline' in cell
   if cell.startswith(r'\multicolumn'):
    n,p=arg(cell,len(r'\multicolumn'));_,p=arg(cell,p);cell,p=arg(cell,p);col=int(n)
   if cell.startswith(r'\multirow'):
    n,p=arg(cell,len(r'\multirow'));_,p=arg(cell,p);cell,p=arg(cell,p);rowspan=int(n)
   value=html.escape(clean_cell(cell));value='<strong>'+value+'</strong>' if bold else value
   if underlined:value='<u>'+value+'</u>'
   attrs=(f' colspan="{col}"' if col>1 else '')+(f' rowspan="{rowspan}"' if rowspan>1 else '')
   cells.append('<td'+attrs+'>'+value+'</td>')
  rows.append('<tr>'+''.join(cells)+'</tr>')
 return '<div class="table-scroll"><table><tbody>'+''.join(rows)+'</tbody></table></div>'
