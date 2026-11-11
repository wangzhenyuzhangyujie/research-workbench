/* Saved comments are separate from generated HTML and never change the paper. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scope = document.querySelector('meta[name="review-scope"]')?.content;
  const key = 'paperAnnotations:' + location.pathname + (scope ? ':' + scope : '');
  const names = {draft: '我的论文', reference: '参考论文'};
  const sections = {title:'标题',abstract:'摘要',intro:'引言',method:'方法',experiments:'实验',results:'结果',analysis:'分析',related:'相关工作',conclusion:'结论',references:'参考文献',appendix:'附录',whole:'整篇意见'};
  const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></svg>';
  let notes = [], draft = null, busy = false, loaded = false, filter = 'open', focusedId = null, selection = null, toastTimer;
  const storage = {
    read(suffix) { try { return JSON.parse(localStorage.getItem(key + suffix)); } catch { return null; } },
    write(suffix, data) { try { data === null ? localStorage.removeItem(key + suffix) : localStorage.setItem(key + suffix, JSON.stringify(data)); } catch { message('浏览器无法保留草稿，请及时点“保存批注”。', true); } }
  };
  const dirty = () => !!draft && draft.body !== draft.originalBody;
  window.paperAnnotations = {get hasUnsaved(){return dirty();}, get isSaving(){return busy;}};
  function message(text, error = false) { $('annotation-message').textContent = text; $('annotation-message').classList.toggle('error', error); }
  function label(note) { return names[note.paper] + ' · ' + (sections[note.section] || '正文'); }
  function openPanel() { $('annotation-panel').hidden = false; document.body.classList.add('annotations-open'); $('annotations-toggle').setAttribute('aria-expanded','true'); storage.write(':open', true); }
  function closePanel() { $('annotation-panel').hidden = true; document.body.classList.remove('annotations-open'); $('annotations-toggle').setAttribute('aria-expanded','false'); storage.write(':open', false); $('annotations-toggle').focus(); }
  function persistDraft() { storage.write(':draft', draft); }
  function element(tag, cls, text) { const el = document.createElement(tag); if(cls)el.className=cls;if(text !== undefined)el.textContent=text;return el; }
  function button(text, fn, cls='') { const b=element('button',cls,text);b.type='button';b.addEventListener('click',fn);return b; }
  async function api(payload) {
    const response = await fetch('/api/annotations', payload ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)} : {cache:'no-store'});
    let result; try { result=await response.json(); } catch { throw new Error('批注服务暂不可达；草稿仍保留，请稍后重试。'); }
    if(response.status===401){notes=[];draft=null;renderList();renderEditor();location.replace('/review/login');}
    if(!response.ok)throw new Error(result.error || '保存未完成，请重试。');
    return result;
  }
  async function refresh() {
    try { const data=await api();notes=data.comments;loaded=true;renderList();return true; }
    catch(err){message(err.message || '批注服务暂不可达；草稿仍保留。',true);return false;}
  }
  function locate(note) {
    if(!note.block_id)return;
    const block=$(note.block_id);if(!block){message('原段落已移除，批注中的原文仍保留。');return;}
    document.querySelectorAll('.block.selected').forEach(el=>el.classList.remove('selected'));
    block.classList.add('selected');block.scrollIntoView({behavior:'smooth',block:'center'});
  }
  function highlightReviewQuotes(block, related) {
    const quotes=related.filter(n=>n.status==='open'&&n.id.startsWith('wording-audit-'))
      .flatMap(n=>(n.quote||'').split('\n')).map(s=>s.trim()).filter(Boolean);
    const signature=JSON.stringify(quotes);
    if(block.dataset.wordingHighlights===signature)return;
    block.dataset.wordingHighlights=signature;
    block.querySelectorAll('mark.wording-review-highlight').forEach(mark=>mark.replaceWith(...mark.childNodes));
    block.normalize();
    if(!quotes.length)return;
    const nodes=[],walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);
    let node,joined='';
    while((node=walker.nextNode())){
      if(node.parentElement.closest('.block-meta,.annotation-trigger,.translation-status'))continue;
      nodes.push({node,start:joined.length});joined+=node.data;
    }
    let compact='',positions=[];
    for(let i=0;i<joined.length;i++)if(!/\s/.test(joined[i])){compact+=joined[i];positions.push(i);}
    const ranges=[];
    for(const quote of quotes){
      const needle=quote.replace(/\s/g,'');if(!needle)continue;
      let offset=0,index;
      while((index=compact.indexOf(needle,offset))!==-1){
        ranges.push([positions[index],positions[index+needle.length-1]+1]);offset=index+needle.length;
      }
    }
    ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const range of ranges){const last=merged[merged.length-1];if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push(range.slice());}
    for(const item of nodes.reverse()){
      const length=item.node.data.length;
      for(const [start,end] of merged.slice().reverse()){
        const a=Math.max(0,start-item.start),b=Math.min(length,end-item.start);if(a>=b)continue;
        if(b<item.node.data.length)item.node.splitText(b);
        const text=a?item.node.splitText(a):item.node;
        const mark=document.createElement('mark');mark.className='wording-review-highlight';
        text.replaceWith(mark);mark.append(text);
      }
    }
  }
  function renderList() {
    const openCount=notes.filter(n=>n.status==='open').length;
    $('annotation-count').textContent=openCount;
    $('annotations-toggle').title=`${openCount} 条待修改批注`;
    document.querySelectorAll('[data-note-filter]').forEach(b=>{const count=b.dataset.noteFilter==='all'?notes.length:notes.filter(n=>n.status===b.dataset.noteFilter).length;b.textContent=({open:'待修改',resolved:'已处理',all:'全部'})[b.dataset.noteFilter]+' '+count;b.classList.toggle('active',filter===b.dataset.noteFilter);b.setAttribute('aria-pressed',String(filter===b.dataset.noteFilter));});
    document.querySelectorAll('.annotation-trigger').forEach(b=>{
      const related=notes.filter(n=>n.block_id===b.dataset.block),count=related.filter(n=>n.status==='open').length;
      b.classList.toggle('has-notes',related.length>0);b.querySelector('span').textContent=related.length||'';
      b.closest('.block').classList.toggle('has-open-notes',count>0);
      highlightReviewQuotes(b.closest('.block'),related);
      b.setAttribute('aria-label',related.length?`查看这一段的 ${related.length} 条批注`:'给这一段添加批注');
      b.title=related.length?`${related.length} 条批注，${count} 条待修改`:'给这一段添加批注';
    });
    const list=$('annotation-list');list.replaceChildren();
    const visible=notes.filter(n=>filter==='all'||n.status===filter).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    $('annotation-empty').hidden=visible.length>0;
    $('annotation-empty').replaceChildren(element('strong','',!loaded?'正在读取批注…':filter==='resolved'?'暂无已处理批注':notes.length?'当前分类没有批注':'从一句话开始批注'),element('span','',!loaded?'':notes.length?'切换分类可查看其他批注。':'选中正文中的文字，或点击段落旁的批注图标。整段、图表和整篇都可以写意见。'));
    visible.forEach(note=>{
      const card=element('article','annotation-card'+(note.id===focusedId?' focused':''));card.dataset.noteId=note.id;
      const top=element('div','annotation-card-top');top.append(element('span','',label(note)),element('span','annotation-status'+(note.status==='resolved'?' resolved':''),note.status==='resolved'?'已处理':'待修改'));card.append(top);
      if(note.source_missing||note.source_changed)card.append(element('p','annotation-change',note.source_missing?'原段落已移除 · 原文保留在批注中':'正文已更新 · 请核对原文'));
      const excerpt=note.quote || note.context_zh;
      if(excerpt)card.append(element('blockquote','annotation-quote',excerpt.length>180?excerpt.slice(0,180)+'…':excerpt));
      card.append(element('p','annotation-note',note.body));
      if(note.resolution)card.append(element('p','annotation-resolution','处理说明：'+note.resolution));
      if(note.author_name)card.append(element('p','annotation-author','审阅者：'+note.author_name));
      const time=element('time','',new Date(note.updated_at).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}));time.dateTime=note.updated_at;card.append(time);
      const actions=element('div','annotation-card-actions');
      if(note.block_id)actions.append(button('定位原文',()=>locate(note)));
      if(note.can_edit!==false)actions.append(button('编辑',()=>edit(note)));
      if(note.can_resolve!==false)actions.append(button(note.status==='open'?'标为已处理':'恢复待修改',()=>mutate(note,'status',{status:note.status==='open'?'resolved':'open'})));
      if(note.can_delete!==false)actions.append(button('删除',()=>mutate(note,'delete'),'annotation-delete'));
      card.append(actions);list.append(card);
    });
  }
  function renderEditor() {
    $('annotation-editor').hidden=!draft;if(!draft)return;
    $('annotation-editor-title').textContent=draft.expected_revision?'编辑批注':'添加批注';
    $('annotation-anchor').textContent=label(draft)+(draft.quote?' · 选中文字':draft.block_id?' · 整段 / 图表':'');
    $('annotation-preview').textContent=draft.quote || draft.context_zh || '对这篇论文整体的修改意见';
    $('annotation-body').value=draft.body;
    $('annotation-save').disabled=busy || !draft.body.trim();
    $('annotation-save').textContent=busy?'保存中…':'保存批注';
    $('annotation-cancel').disabled=busy;
  }
  function canSwitch() {
    if(busy){message('正在保存，请稍等。');return false;}
    if(dirty()){openPanel();message('当前批注尚未保存，请先保存或取消，再给另一处写意见。',true);$('annotation-body').focus();return false;}
    return true;
  }
  function context(block) {
    const copy=block.cloneNode(true);copy.querySelectorAll('.block-meta,.annotation-trigger,.translation-status').forEach(el=>el.remove());
    return (copy.textContent||'').replace(/\s+/g,' ').trim().slice(0,24000);
  }
  function begin(block=null, quote='') {
    if(!canSwitch())return;
    const paper=block?(block.closest('#right')?'draft':'reference'):$('annotation-paper').value;
    draft={id:crypto.randomUUID(),expected_revision:0,paper,block_id:block?.id||null,section:block?.dataset.align||'whole',source_hash:block?.dataset.sourceHash||'',quote:quote.slice(0,4000),context_zh:block?context(block):'',body:'',originalBody:''};
    persistDraft();openPanel();renderEditor();message('');$('annotation-scroll').scrollTop=0;$('annotation-body').focus();
  }
  function edit(note) {
    if(!canSwitch())return;
    draft={...note,expected_revision:note.revision,originalBody:note.body};focusedId=note.id;persistDraft();openPanel();renderEditor();renderList();message('');$('annotation-scroll').scrollTop=0;$('annotation-body').focus();locate(note);
  }
  async function save() {
    if(busy||!draft||!draft.body.trim())return;
    busy=true;renderEditor();message('正在保存…');
    try {
      const result=await api({...draft,action:'save'});focusedId=result.comment.id;draft=null;persistDraft();
      filter=result.comment.status;await refresh();message('批注已保存到工作台。');
    } catch(err) {message(err.message || '保存未完成；草稿仍保留，请重试。',true);await refresh();}
    finally {busy=false;renderEditor();}
  }
  function toast(text, undo) {
    clearTimeout(toastTimer);const box=$('annotation-toast');box.replaceChildren(element('span','',text));
    if(undo)box.append(button('撤销',()=>{undo();box.hidden=true;}));box.hidden=false;toastTimer=setTimeout(()=>box.hidden=true,12000);
  }
  async function mutate(note,action,extra={}) {
    if(busy)return;
    if(draft?.id===note.id&&dirty()){message('请先保存或取消这条批注的编辑。',true);return;}
    busy=true;
    try {
      const data=await api({id:note.id,expected_revision:note.revision,action,...extra});
      if(draft?.id===note.id){draft=null;persistDraft();renderEditor();}
      await refresh();message('已保存。');
      if(action==='delete')toast('批注已删除',()=>mutate(data.comment,'restore'));
    }catch(err){message(err.message || '操作未完成，请重试。',true);await refresh();}
    finally {busy=false;renderEditor();}
  }
  document.querySelectorAll('.block').forEach(block=>{
    const trigger=element('button','annotation-trigger');trigger.type='button';trigger.dataset.block=block.id;trigger.innerHTML=icon+'<span></span>';trigger.title='给这一段添加批注';trigger.setAttribute('aria-label','给这一段添加批注');
    trigger.addEventListener('click',()=>{
      const existing=notes.filter(n=>n.block_id===block.id);
      if(!existing.length){begin(block);return;}
      openPanel();filter='all';focusedId=existing[0].id;renderList();
      const card=[...document.querySelectorAll('.annotation-card')].find(c=>c.dataset.noteId===focusedId);card?.scrollIntoView({behavior:'smooth',block:'center'});
      message('可定位已有批注，或选中文字添加另一条意见。');
    });block.append(trigger);
  });
  function hideSelection(){ $('annotation-selection').hidden=true;selection=null; }
  function captureSelection(){
    const s=window.getSelection();if(!s||s.isCollapsed||!s.rangeCount||!s.toString().trim()){hideSelection();return;}
    const parent=node=>node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
    const start=parent(s.anchorNode)?.closest('.block'),end=parent(s.focusNode)?.closest('.block');
    if(!start||start!==end){hideSelection();return;}
    const rect=s.getRangeAt(0).getBoundingClientRect();selection={block:start,quote:s.toString().trim()};
    const target=$('annotation-selection');target.hidden=false;target.style.left=Math.max(8,Math.min(rect.left,innerWidth-150))+'px';target.style.top=Math.max(80,Math.min(rect.bottom+6,innerHeight-45))+'px';
  }
  document.addEventListener('pointerup',e=>{if(e.target.closest('#annotation-selection,#annotation-panel'))return;setTimeout(captureSelection,0);});
  document.addEventListener('keyup',e=>{if(e.key==='Shift')captureSelection();if(e.key==='Escape')hideSelection();});
  document.querySelectorAll('.reading').forEach(el=>el.addEventListener('scroll',hideSelection,{passive:true}));
  $('annotation-selection').addEventListener('pointerdown',e=>e.preventDefault());
  $('annotation-selection').addEventListener('click',()=>{if(selection)begin(selection.block,selection.quote);hideSelection();});
  $('annotations-toggle').addEventListener('click',()=>{$('annotation-panel').hidden?openPanel():closePanel();});
  $('annotations-close').addEventListener('click',closePanel);
  $('annotation-whole').addEventListener('click',()=>begin());
  document.querySelectorAll('[data-note-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.noteFilter;renderList();}));
  $('annotation-body').addEventListener('input',()=>{if(!draft)return;draft.body=$('annotation-body').value;persistDraft();$('annotation-save').disabled=busy||!draft.body.trim();message('草稿尚未保存');});
  $('annotation-body').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();save();}});
  $('annotation-save').addEventListener('click',save);
  $('annotation-cancel').addEventListener('click',()=>{if(busy)return;draft=null;persistDraft();renderEditor();message('');});
  window.addEventListener('beforeunload',e=>{if(dirty()||busy){e.preventDefault();e.returnValue='';}});
  const saved=storage.read(':draft');
  if(saved && ['draft','reference'].includes(saved.paper)&&typeof saved.body==='string'&&typeof saved.id==='string')draft=saved;
  if(storage.read(':open')||draft)openPanel();
  renderEditor();refresh();
  window.addEventListener('pageshow', e=>{if(e.persisted && scope)location.reload();});
  if(draft)message('已恢复上次未提交的草稿。');
  setInterval(()=>{if(!busy&&!document.hidden)refresh();},10000);
})();
