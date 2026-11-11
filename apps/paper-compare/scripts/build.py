"""English TeX is authoritative. Cache reviewed Chinese by exact source hash.
Changed blocks are translated locally; the server then rebuilds HTML and PDF.
"""
from pathlib import Path
import sys,re,json,hashlib,subprocess,html,time,shutil,os
APP=Path(__file__).resolve().parents[1]
R=Path(os.environ.get('PAPER_WORKSPACE', str(APP/'workspace'))).resolve()
from bs4 import BeautifulSoup
PANDOC=os.environ.get('PANDOC', 'pandoc')
PAT=re.compile(r'^%WB ([^|\n]+)\|([^|\n]+)\|([^\n]*)\n(.*?)^%WBEND\s*$',re.M|re.S)
translator=None;sp=None
REFS={}

def parse(paper):
 text=(R/paper/'content.tex').read_text();out=[dict(id=m[1],kind=m[2],align=m[3],tex=m[4].strip()) for m in PAT.finditer(text)]
 assert out and len({b['id'] for b in out})==len(out),'Invalid or duplicate block IDs'
 return out

def group(s,cmd):
 m=re.search(r'\\'+cmd+r'(?:\[[^\]]*\])?\{',s)
 if not m:return ''
 a=m.end();depth=1;i=a
 while depth and i<len(s):
  if s[i]=='{' and (i==0 or s[i-1]!='\\'):depth+=1
  elif s[i]=='}' and (i==0 or s[i-1]!='\\'):depth-=1
  i+=1
 return s[a:i-1]

def pandoc(s):
 s=re.sub(r'\\cite[pt]?\{([^}]+)\}',lambda m:' ['+', '.join(m[1].split(','))+']',s)
 s=re.sub(r'\\ref\{([^}]+)\}',lambda m:REFS.get(m[1],m[1]),s)
 # only pass tabular itself; strip unsupported color commands from author table source
 s=re.sub(r'\\rowcolor(?:\[[^]]+\])?\{[^}]+\}','',s);s=re.sub(r'\\color\{[^}]+\}','',s)
 s=re.sub(r'\\(?:label|bibliographystyle)\{[^}]*\}','',s)
 p=subprocess.run([PANDOC,'-f','latex','-t','html','--mathjax','--wrap=none'],input=s,text=True,capture_output=True)
 if p.returncode:raise RuntimeError(p.stderr[:600])
 return p.stdout.strip()

def en_html(b):
 t=b['tex'];kind=b['kind']
 if kind=='title':return '<h1>'+pandoc(group(t,'title'))+'</h1>'
 if kind=='abstract':return '<h2>Abstract</h2>'+pandoc(re.sub(r'\\(?:begin|end)\{abstract\}','',t))
 if kind in ['table','figure']:return pandoc(group(t,'caption'))
 return pandoc(t)

GLOSSARY={'BM25':'BM25'}

def translate_text(texts):
 global translator,sp
 if not texts:return []
 if translator is None:
  import ctranslate2,sentencepiece
  model=Path(os.environ['TRANSLATION_MODEL'])
  translator=ctranslate2.Translator(str(model/'model'),device='cpu',compute_type='int8',inter_threads=1,intra_threads=2)
  sp=sentencepiece.SentencePieceProcessor(model_file=str(model/'sentencepiece.model'))
 # sentence chunking avoids source clipping; table identifiers are kept separately
 chunks=[];owners=[]
 for n,t in enumerate(texts):
  ss=re.split(r'(?<=[.!?;])\s+(?=[A-Z0-9(])',t)
  for s in ss:
   words=s.split();buf=[]
   for w in words:
    buf.append(w)
    if len(' '.join(buf))>550:chunks.append(' '.join(buf));owners.append(n);buf=[]
   if buf:chunks.append(' '.join(buf));owners.append(n)
 result=['']*len(texts)
 for start in range(0,len(chunks),12):
  batch=chunks[start:start+12]
  encoded=[sp.encode(s,out_type=str) for s in batch]
  outputs=translator.translate_batch(encoded,beam_size=2,max_decoding_length=600,max_input_length=0)
  for j,o in enumerate(outputs):result[owners[start+j]]+=sp.decode(o.hypotheses[0]).replace('▁','')
 return result

def auto_html(h):
 soup=BeautifulSoup(h,'html.parser');nodes=[];txt=[]
 for node in soup.find_all(string=True):
  if any(p.name in ['code','pre'] or 'math' in p.get('class',[]) for p in node.parents):continue
  t=str(node)
  if not re.search('[A-Za-z]{3}',t):continue
  if t.strip() in GLOSSARY or re.fullmatch(r'[\w.\-]+(?:@\d+)?',t.strip()) and any(c.isdigit() for c in t):continue
  nodes.append(node);txt.append(t)
 for node,z in zip(nodes,translate_text(txt)):node.replace_with(z)
 return str(soup)

def render_table(b):
 from table_html import render
 return render(b['tex'])

def build(compile_pdf=False):
 global REFS
 for directory in ['translations','sources','qa','web']:(R/directory).mkdir(parents=True,exist_ok=True)
 shutil.copytree(APP/'web/assets',R/'web/assets',dirs_exist_ok=True)
 allpapers={};stats={};start=time.time()
 for paper in ['reference','draft']:
  blocks=parse(paper);cp=R/'translations'/f'{paper}.zh.json';cache=json.loads(cp.read_text()) if cp.exists() else {}
  # Derive cross-reference numbers from the current source, including removed figures.
  REFS={};numbers={'figure':0,'table':0,'equation':0}
  ref_appendix=False;ref_section=0;ref_subsection=0
  for block in blocks:
   if block['kind'] in ('figure','table'):
    kind=block['kind'];numbers[kind]+=1
    for label in re.findall(r'\\label\{([^}]+)\}',block['tex']):REFS[label]=str(numbers[kind])
   for equation in re.findall(r'\\begin\{equation\}(.*?)\\end\{equation\}',block['tex'],re.S):
    numbers['equation']+=1
    for label in re.findall(r'\\label\{([^}]+)\}',equation):REFS[label]=str(numbers['equation'])
   if block['kind'] in ('section','subsection'):
    if '\\appendix' in block['tex']:ref_appendix=True;ref_section=0
    if block['kind']=='section':ref_section+=1;ref_subsection=0
    else:ref_subsection+=1
    section_label=chr(64+ref_section) if ref_appendix else str(ref_section)
    reference_label=section_label+(f'.{ref_subsection}' if block['kind']=='subsection' else '')
    for label in re.findall(r'\\label\{([^}]+)\}',block['tex']):REFS[label]=reference_label
  provenance_path=R/paper/'provenance.json'
  provenance=json.loads(provenance_path.read_text()) if provenance_path.exists() else {}
  parts=[];body=[];count=0;section_no=0;subsection_no=0;figure_no=0;table_no=0;appendix_mode=False
  placement_path=R/'sources/figure_table_placement.json'
  placements=json.loads(placement_path.read_text()) if paper=='draft' and placement_path.exists() else {}
  group_ends={entry['artifact'] for entry in placements.values()}
  for b in blocks:
   i=b['id'];t=b['tex'];sha=hashlib.sha256(t.encode()).hexdigest();c=cache.get(i)
   if not c or c.get('sha256')!=sha:
    if b['kind']=='reference':h=en_html(b)
    elif b['kind']=='equation':h=en_html(b)
    else:h=auto_html(en_html(b)) if os.environ.get('TRANSLATION_MODEL') else en_html(b)
    c={'sha256':sha,'zh_html':h,'status':'automatic' if os.environ.get('TRANSLATION_MODEL') else 'needs_translation','source':'local model' if os.environ.get('TRANSLATION_MODEL') else 'English fallback'};cache[i]=c;count+=1
    if count%10==0:print(paper,'translated',count,flush=True)
    cp.write_text(json.dumps(cache,ensure_ascii=False,indent=2))
   if 'zh_html' in c:h=c['zh_html']
   else:
    zh=c['zh'];h=pandoc(zh)
    if b['kind']=='title':h='<h1>'+pandoc(group(zh,'title') or zh)+'</h1>'
    elif b['kind']=='section':h='<h2>'+h+'</h2>'
    elif b['kind']=='subsection':h='<h3>'+h+'</h3>'
    elif b['kind']=='abstract':h='<h2>摘要</h2>'+h
   if paper=='draft' and b['kind'] in ['section','subsection']:
    label=BeautifulSoup(h,'html.parser').get_text(' ',strip=True)
    if b['kind']=='section':
     if '\\appendix' in t:appendix_mode=True;section_no=0
     section_no+=1;subsection_no=0
     section_label=chr(64+section_no) if appendix_mode else str(section_no)
     h=f'<h2>{section_label} {html.escape(label)}</h2>'
    else:
     subsection_no+=1
     section_label=chr(64+section_no) if appendix_mode else str(section_no)
     h=f'<h3>{section_label}.{subsection_no} {html.escape(label)}</h3>'
   if b['kind']=='figure':
    figure_no+=1
    if paper=='draft':h='<strong>图 '+str(figure_no)+'</strong> '+h
    figs=re.findall(r'\\includegraphics(?:\[[^]]*\])?\{([^}]+)\}',t);imgs=[]
    for f in figs:
     p=(R/paper/f).resolve()
     if p.suffix=='.pdf':
      # Keep figure lettering in English in both Chinese reading panes.
      vector=p.with_suffix('.svg');p=vector if vector.exists() else p.with_suffix('.png')
     assert p.exists(),p
     url='../'+str(p.relative_to(R));imgs.append(f'<img loading="lazy" src="{url}" alt="论文插图，点击放大" tabindex="0">')
    h='<figure><div class="figure-images">'+''.join(imgs)+'</div><figcaption>'+h+'</figcaption></figure>'
   if b['kind']=='table':
    table_no+=1
    if paper=='draft':h='<strong>表 '+str(table_no)+'</strong> '+h
    h=render_table(b)+'<div class="caption">'+h+'</div>'
   if b['kind']=='bibliography':h='<h2>参考文献</h2>'+render_bibliography(paper)
   pg=provenance.get(i,{}).get('published_page');link=f'<a class="source-page" href="../reference/main.pdf#page={pg}" target="_blank">原文 p.{pg}</a>' if pg else ''
   status='原文标识保留' if c.get('status')=='preserved' else '校订译文' if c.get('status')=='reviewed' else '本地自动译文，专业术语请结合原文核对'
   if c.get('status') in ['automatic','needs_translation'] and b['kind'] not in ['reference','equation']:
    label='自动译文 · 待校订' if c.get('status')=='automatic' else '译文待更新 · 暂显示英文'
    h='<span class="translation-status">'+label+'</span>'+h
   parts.append(f'<section class="block {b["kind"]}" id="{i}" data-align="{b["align"]}" data-source-hash="{sha}" title="{status}"><div class="block-meta"><button class="pair" data-id="{i}" aria-label="定位对应段落">↔</button>{link}</div>{h}</section>')
   if b['kind']=='title':(R/paper/'title.tex').write_text(t)
   else:
    # Keep each complete description and artifact together at its actual height.
    # Preserve the template paragraph spacing inside the indivisible group.
    group_start='\\par\\noindent\\begin{minipage}{\\linewidth}\\setlength{\\parskip}{\\WBparskip}\n' if i in placements else ''
    group_end='\n\\end{minipage}\\par' if i in group_ends else ''
    body.append(group_start+t+group_end)
  (R/paper/'body.tex').write_text('\n\n'.join(body));cp.write_text(json.dumps(cache,ensure_ascii=False,indent=2));allpapers[paper]='\n'.join(parts)
  stats[paper]={'blocks':len(blocks),'translated':count,'reviewed':sum(cache[b['id']].get('status')=='reviewed' for b in blocks)}
 mapping=make_mapping()
 template=(APP/'web/template.html').read_text();template=template.replace('<!--REFERENCE-->',allpapers['reference']).replace('<!--DRAFT-->',allpapers['draft']).replace('/*MAPPING*/',json.dumps(mapping,ensure_ascii=False)).replace('{{BUILD}}',time.strftime('%m-%d %H:%M:%S'))
 digest=hashlib.sha256(template.encode()).hexdigest()[:16];template=template.replace('{{VERSION}}',digest)
 # atomic write so a browser never reads half a rebuild
 p=R/'web/index.html.tmp';p.write_text(template);p.replace(R/'web/index.html')
 (R/'web/version.json').write_text(json.dumps({'version':digest,'updated':time.time(),'stats':stats},ensure_ascii=False))
 if compile_pdf:
  for paper in ['draft','reference']:
   r=subprocess.run([os.environ.get('LATEXMK','latexmk'),'-pdf','-no-shell-escape','-interaction=nonstopmode','-halt-on-error','main.tex'],cwd=R/paper,capture_output=True,text=True)
   (R/'qa'/f'{paper}_compile.txt').write_text(r.stdout+'\n'+r.stderr)
   if r.returncode:raise RuntimeError(paper+' PDF build failed; see qa/'+paper+'_compile.txt\n'+r.stdout[-1800:])
 (R/'qa/build_report.json').write_text(json.dumps({'time':time.time(),'seconds':time.time()-start,'papers':stats,'pdf_compiled':compile_pdf},indent=2))
 print('Build complete',stats,'seconds',round(time.time()-start,1),flush=True)

def render_bibliography(paper):
 p=R/paper/'references.bib'
 if not p.exists():return ''
 # Balanced BibTeX fields support both brace-delimited and quoted values.
 text=p.read_text();parts=[]
 for m in re.finditer(r'@\w+\{([^,]+),',text):
  a=m.end();depth=1;i=a
  while depth and i<len(text):
   if text[i]=='{':depth+=1
   elif text[i]=='}':depth-=1
   i+=1
  entry=text[a:i-1];fields={}
  for f in re.finditer(r'(\w+)\s*=\s*\{',entry):
   j=f.end();d=1;k=j
   while d and k<len(entry):
    if entry[k]=='{':d+=1
    elif entry[k]=='}':d-=1
    k+=1
   fields[f[1].lower()]=entry[j:k-1]
  fields.update({f[1].lower():f[2] for f in re.finditer(r'(\w+)\s*=\s*"([^"]*)"',entry)})
  author=', '.join(fields.get('author','').split(' and ')[:3]);url=fields.get('url','');title=fields.get('title','').replace('{','').replace('}','');key=m[1]
  parts.append('<p id="ref-'+key+'">'+html.escape(author)+'. '+(f'<a href="{html.escape(url)}" target="_blank">{html.escape(title)}</a>' if url else html.escape(title))+'.</p>')
 return ''.join(parts)

def make_mapping():
 explicit_path=R/'sources/alignment.json'
 explicit=json.loads(explicit_path.read_text()) if explicit_path.exists() else {}
 left=parse('reference');valid={b['id'] for b in left};mapping={}
 for block in parse('draft'):
  item=explicit.get(block['id'])
  if item is None:
   target=next((b['id'] for b in left if b['align']==block['align']),None)
   if target:item={'target':target,'role':'按章节与写作功能对应'}
  if item:
   if item['target'] not in valid:raise ValueError('Alignment target does not exist: '+item['target'])
   mapping[block['id']]=item
 (R/'sources/paragraph_alignment.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2))
 return mapping

if __name__=='__main__':build('--pdf' in sys.argv)
