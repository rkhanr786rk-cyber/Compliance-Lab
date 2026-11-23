(function browserMain() {
  'use strict';
  const $=s=>document.querySelector(s);
  const page=$('#page'), dialog=$('#search-dialog'), catalog=new Map(), bodies=new Map(), searchable=[];
  const volumes={
    act:{title:'Companies Act, 2013',short:'Companies Act',unit:'Section',plural:'entries',icon:'book',description:'Browse sections by chapter and follow the rules and listing provisions linked to each one.'},
    rule:{title:'Companies Rules',short:'Companies Rules',unit:'Rule',plural:'rules',icon:'layers',description:'Choose a rule set to read its provisions alongside the relevant sections of the Act.'},
    lodr:{title:'SEBI LODR, 2015',short:'SEBI LODR',unit:'Regulation',plural:'entries',icon:'columns',description:'Read the Listing Obligations and Disclosure Requirements Regulations with their schedules and Companies Act links.'}
  };
  const paths={
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
    checklist:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3.5" rx="1"/><path d="m8 11 1 1 2-3m2 2h3m-8 5 1 1 2-3m2 2h3"/>',
    pen:'<path d="M13 4H5v16h14v-8M10 14l1-4L18 3l3 3-7 7-4 1zm6-9 3 3"/>',
    book:'<path d="M12 6c-3-2-6-2.5-10-2v14c4-.5 7 0 10 2 3-2 6-2.5 10-2V4c-4-.5-7 0-10 2zm0 0v14"/>',
    layers:'<path d="m12 3 10 5-10 5L2 8l10-5zm-9.5 9 9.5 5 9.5-5m-19 4 9.5 5 9.5-5"/>',
    columns:'<path d="m2 8 10-5 10 5H2zm2 12h16M2 22h20M6 10v8m4-8v8m4-8v8m4-8v8"/>',
    bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2.5v5m10-5v5M3 10h18"/>',
    search:'<circle cx="10" cy="10" r="6.3"/><path d="m15 15 5 5"/>',
    menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
    x:'<path d="m6 6 12 12M18 6 6 18"/>',chevron:'<path d="m9 5 7 7-7 7"/>',
    external:'<path d="M14 3h7v7m0-7L10 14m-1-9H4v15h15v-5"/>',
    archive:'<path d="M4 8h16v12H4zM3 4h18v4H3zm6 8h6"/>',
    file:'<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h7"/>',
    users:'<circle cx="10" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 4 4v2"/>',
    notes:'<path d="M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5"/>',
    link:'<path d="m9 15 6-6m-4-2 2-2a4 4 0 0 1 6 6l-2 2m-4 4-2 2a4 4 0 0 1-6-6l2-2"/>',
    check:'<path d="m4 12 5 5L20 6"/>',plus:'<path d="M12 4v16M4 12h16"/>',home:'<path d="m3 10 9-7 9 7M6 9v12h12V9"/>'
  };
  const icon=n=>`<svg class="ico" aria-hidden="true" viewBox="0 0 24 24">${paths[n]||paths.file}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug=s=>encodeURIComponent(s);
  const format=n=>new Intl.NumberFormat('en-IN').format(n);
  $('#today').textContent=new Intl.DateTimeFormat('en-IN',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date());
  const key='compliance-desk:v1', initial={saved:{},matters:{},selected:{},sizes:1.16};
  let state;
  try {state={...initial,...JSON.parse(localStorage.getItem(key)||'{}')};}catch{state={...initial};}
  let noticeTimer;
  function notify(message){const n=$('#notice');n.textContent=message;n.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.remove('show'),2300);}
  function persist(){try{localStorage.setItem(key,JSON.stringify(state));}catch{notify('Browser storage is unavailable. Changes last for this tab.');}syncSaved();}
  function syncSaved(){const n=Object.keys(state.saved).length;$('#saved-count').textContent=n?String(n):'';}
  function saveBtn(id){const saved=Boolean(state.saved[id]);return `<button type="button" class="btn" data-save="${html(id)}" aria-pressed="${saved}">${icon(saved?'check':'bookmark')} ${saved?'Saved':'Save'}</button>`;}
  const crumb=(links,current)=>{$('#crumb').innerHTML=links.map(([title,url])=>`<a href="${html(url)}">${html(title)}</a>${icon('chevron')}`).join('')+`<b>${html(current)}</b>`;};
  const header=(k,t,desc='')=>`<header class="page-head"><div class="kicker">${html(k)}</div><h1>${html(t)}</h1>${desc?`<p>${html(desc)}</p>`:''}</header>`;
  const right=()=>`<span class="chev">${icon('chevron')}</span>`;
  const safeUrl=u=>{if(typeof u!=='string'||!u)return '';if(u.startsWith('reference.html#'))return u;try{const v=new URL(u,location.href);return ['https:','http:'].includes(v.protocol)?v.href:'';}catch{return '';}};
  const sourceLink=(name,url,extra='')=>safeUrl(url)?`<a href="${html(safeUrl(url))}" ${url.startsWith('reference.html#')?'':'target="_blank" rel="noopener noreferrer"'}>${html(name)} ${icon('external')}${extra?`<small>${html(extra)}</small>`:''}</a>`:'';
  const word=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
  const tokens=s=>word(s).split(/\s+/).filter(Boolean);
  const matches=(text,query)=>tokens(query).every(q=>text.includes(q));
  let lib=[],flows=[],guides=[],templates=[],routeNo=0,activeNav='';
  const procIcons={'board-meeting':'calendar','appoint-director':'users','director-interests':'notes','annual-general-meeting':'users','registered-office':'columns','material-event':'file'};
  const ref=r=>{
    if(r.kind==='lodr'&&/^s(?:ch(?:edule)?)?[\s.-]*[ivx]+$/i.test(r.number)) return 'Schedule '+String(r.number).replace(/^s(?:ch(?:edule)?)?[\s.-]*/i,'');
    if(/^(section|regulation|rule|schedule)\b/i.test(r.number))return r.number;
    return volumes[r.kind].unit+' '+r.number;
  };
  const lawHref=r=>'#reader/'+slug(r.id);
  const procHref=r=>'#procedures/'+slug(r.id);
  const docHref=r=>'#documents/'+slug(r.id);
  const localJSON=async path=>{const f=await fetch(path);if(!f.ok)throw new Error(`Could not open ${path}`);return f.json();};
  function nav(id){activeNav=id;document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
  function routeParts(){try{return location.hash.slice(1).split('/').map(decodeURIComponent);}catch{return ['invalid'];}}
  function toggleMenu(on){$('#sidebar').classList.toggle('open',on);$('#side-shade').hidden=!on;$('#menu-toggle').setAttribute('aria-expanded',String(on));}
  $('#menu-toggle').onclick=()=>toggleMenu(!$('#sidebar').classList.contains('open'));
  $('#side-shade').onclick=()=>toggleMenu(false);
  function findFlow(id){return flows.find(x=>x.id===id);}
  const flowRow=(p,detail=p.category)=>`<a class="proc-row" href="${procHref(p)}"><span class="item-icon">${icon(procIcons[p.id]||'checklist')}</span><div class="row-main"><div class="row-title">${html(p.title)}</div><div class="row-meta">${html(detail)}</div></div><span class="chip">${p.steps.length} steps</span>${right()}</a>`;
  const lawRow=r=>`<a class="directory-row" href="${lawHref(r)}"><span class="ref-num">${html(ref(r))}</span><div class="row-main"><div class="row-title">${html(r.title)}</div><div class="row-meta">${html(r.group)}</div></div>${right()}</a>`;
  function empty(t,p){return `<div class="empty-state"><h2>${html(t)}</h2><p>${html(p)}</p></div>`;}
  function home(){
    crumb([['Workspace','#overview']],'Overview');nav('overview');document.title='Practice desk · Compliance Desk';
    const started=Object.entries(state.matters).flatMap(([id,ms])=>Object.entries(ms).map(([name,steps])=>({flow:findFlow(id),name,steps:Object.values(steps).filter(Boolean).length}))).filter(r=>r.flow&&r.steps>0&&r.steps<r.flow.steps.length);
    const featured=['board-meeting','appoint-director','director-interests','annual-general-meeting'].map(findFlow).filter(Boolean);
    page.innerHTML=`<section class="hero"><img class="hero-art" src="desk/engraving.webp" alt=""><div class="hero-copy"><div class="eyebrow">Company secretary workspace</div><h1>Practice desk</h1><p>Read the law, follow a procedure, and prepare the documents for your next filing.</p><button type="button" class="hero-search" data-search>${icon('search')}Search your desk…<kbd>Ctrl K</kbd></button></div></section>
    <section class="section"><div class="section-head"><h2>Reference library</h2></div><div class="reference-grid">${Object.entries(volumes).map(([k,v])=>{const records=lib.filter(r=>r.kind===k);const meta=k==='rule'?`${format(new Set(records.map(r=>r.group)).size)} rule sets`:k==='lodr'?`${format(records.length)} regulations & schedules`:`${format(records.filter(r=>!r.number.startsWith('Schedule')).length)} sections · ${records.filter(r=>r.number.startsWith('Schedule')).length} schedules`;return `<a class="volume ${k}" href="#library/${k}"><span class="vol-icon">${icon(v.icon)}</span><h3>${v.title}</h3><p>${meta}</p></a>`;}).join('')}</div></section>
    ${started.length?`<section class="section"><div class="section-head"><h2>Work in progress</h2></div><div class="procedure-list">${started.slice(0,5).map(s=>`<a class="proc-row" href="${procHref(s.flow)}/${slug(s.name)}"><span class="item-icon">${icon('checklist')}</span><div class="row-main"><div class="row-title">${html(s.flow.title)}</div><div class="row-meta">${html(s.name)}</div></div><span class="chip">${s.steps} of ${s.flow.steps.length}</span>${right()}</a>`).join('')}</div></section>`:''}
    <section class="section"><div class="section-head"><h2>Common procedures</h2><a class="section-link" href="#procedures">View all procedures</a></div><div class="procedure-list">${(featured.length?featured:flows.slice(0,4)).map(p=>flowRow(p)).join('')}</div></section>
    <section class="section"><div class="section-head"><h2>Document studio</h2><a class="section-link" href="#documents">View templates</a></div><div class="tile-grid">${templates.slice(0,3).map(docCard).join('')}</div></section>`;
  }
  const filterInput=label=>`<label class="field-search">${icon('search')}<input id="filter" type="search" placeholder="${html(label)}" aria-label="${html(label)}"></label>`;
  function library(kind){
    if(!volumes[kind])return missing();
    const v=volumes[kind],rows=lib.filter(r=>r.kind===kind),groups=[...new Set(rows.map(x=>x.group))];nav(kind);crumb([['Reference library','#overview']],v.short);document.title=v.title+' · Compliance Desk';
    page.innerHTML=header('Reference library',v.title,v.description)+`<p class="edition-line">${icon('book')} ${kind==='act'?'Source edition · 1 April 2021':kind==='lodr'?'Source edition · 15 October 2026':'Source editions vary by rule set'} · <a target="_blank" rel="noopener noreferrer" href="${html(rows[0]?.source||'https://www.indiacode.nic.in/')}">Check official text</a></p>`+`<div class="tabs" aria-label="Reference collections">${Object.entries(volumes).map(([k,x])=>`<a class="tab ${k===kind?'selected':''}" href="#library/${k}">${x.short}</a>`).join('')}</div><div class="tool-row">${filterInput('Find by number or title…')}<select id="group" aria-label="Filter by chapter or rule set" style="max-width:min(100%,360px)"><option value="">${kind==='rule'?'All rule sets':'All chapters'}</option>${groups.map(g=>`<option>${html(g)}</option>`).join('')}</select></div><div id="library-results" aria-live="polite"></div>`;
    let limit=45;
    function list(){const q=$('#filter').value,g=$('#group').value;
      const filtered=rows.filter(r=>(!g||g===r.group)&&matches(r.search,q));$('#library-results').innerHTML=`<p class="countline">${format(filtered.length)} ${v.plural}</p>`+(filtered.length?`<div class="list-panel">${filtered.slice(0,limit).map(lawRow).join('')}</div>`:empty('No provisions found','Try a different number, title or chapter.'))+(filtered.length>limit?`<button class="btn more" id="more">Show more provisions</button>`:'');if($('#more'))$('#more').onclick=()=>{limit+=70;list();};}
    $('#filter').oninput=$('#group').onchange=()=>{limit=45;list();};list();
  }
  const sidePanel=(title,content)=>`<section class="context-box"><h2>${html(title)}</h2>${content}</section>`;
  const relatedLink=(id,label)=>{const x=catalog.get(id);return x?`<a href="${lawHref(x)}">${html(ref(x))} · ${html(x.title)}<small>${html(label||x.group)}</small></a>`:'';};
  function procedureLinks(ps){return ps.map(p=>`<a href="${procHref(p)}">${html(p.title)}<small>${p.steps.length} checklist steps</small></a>`).join('');}
  function templateLinks(ds){return ds.map(d=>`<a href="${docHref(d)}">${html(d.code||d.kind)} · ${html(d.title)}</a>`).join('');}
  async function reader(id,serial){
    const r=catalog.get(id);if(!r)return missing();
    nav(r.kind);crumb([[volumes[r.kind].short,'#library/'+r.kind]],ref(r));document.title=ref(r)+' · '+r.title+' · Compliance Desk';
    page.innerHTML=header(volumes[r.kind].title,ref(r)+' · '+r.title,r.group)+'<p class="load-text">Opening provision…</p>';
    if(!bodies.has(r.part))bodies.set(r.part,localJSON('desk/library/'+encodeURIComponent(r.part)).catch(e=>{bodies.delete(r.part);throw e;}));
    const chunk=await bodies.get(r.part);if(serial!==routeNo)return;
    const body=chunk[r.id];if(!body)throw new Error('Missing provision');
    const links=body.related||[];
    const related=['rule','lodr','act'].map(kind=>{
      const group=links.filter(x=>x.kind===kind).sort((a,b)=>Number(b.label.startsWith('Companion'))-Number(a.label.startsWith('Companion')));
      if(!group.length)return '';
      const items=group.map(x=>relatedLink(x.id,x.label));
      return '<div class="link-group"><h3>'+html(volumes[kind].short)+'</h3>'+items.slice(0,4).join('')+(items.length>4?'<details><summary>Show '+(items.length-4)+' more</summary>'+items.slice(4).join('')+'</details>':'')+'</div>';
    }).join('');
    const ps=flows.filter(x=>x.related?.includes(id)),ds=templates.filter(d=>r.kind==='act'&&String(d.section)===String(r.number));
    const neighbours=lib.filter(x=>x.kind===r.kind&&(r.kind!=='rule'||x.group===r.group));
    const pos=neighbours.findIndex(x=>x.id===r.id);
    const paging=[[neighbours[pos-1],'Previous'],[neighbours[pos+1],'Next']].filter(([x])=>x).map(([x,side])=>`<a href="${lawHref(x)}"><small>${side}</small>${html(ref(x))} · ${html(x.title)}</a>`).join('');
    const original=(r.kind==='act'&&/^\d/.test(r.number)&&r.number!=='378ZA')?sourceLink('Original dashboard cross-references','reference.html#/s/'+slug(r.number)):'';
    page.innerHTML=header(volumes[r.kind].title,ref(r)+' · '+r.title,r.group)+`<div class="detail-layout"><section class="reading"><div class="reading-toolbar"><span>Source edition · ${html(r.asOf)}</span><div class="size-controls"><button type="button" data-font="-1" aria-label="Decrease text size">A−</button><button type="button" data-font="1" aria-label="Increase text size">A+</button></div>${saveBtn('law:'+id)}</div>${body.note?`<div class="source-note">${html(body.note)}</div>`:''}<div class="statute" style="--reading-size:${Number(state.sizes)||1.16}">${body.paragraphs.length?body.paragraphs.map(p=>`<p class="${/^\([a-zivx]+\)/i.test(p)?'indent':''}">${html(p)}</p>`).join(''):sourceLink('Read '+ref(r)+' in the source PDF',body.pdf)}</div><nav class="provision-paging" aria-label="Neighbouring provisions">${paging}</nav></section><aside>
    ${sidePanel('Linked provisions',related||'<p>No linked provisions are indexed for this entry.</p>')}${ps.length?sidePanel('Related procedures',procedureLinks(ps)):''}${ds.length?sidePanel('Document templates',templateLinks(ds)):''}${sidePanel('Sources',sourceLink('Official reference',r.source)+sourceLink('Source PDF at this provision',body.pdf)+original)}</aside></div>`;
  }
  function procedures(mode='checklists'){
    nav('procedures');crumb([['Workspace','#overview']],'Procedure library');document.title='Procedure library · Compliance Desk';
    page.innerHTML=header('Workspace','Procedure library','Work through a checklist for a matter, or consult a guide from the reference directory.')+`<div class="tabs"><a class="tab ${mode==='checklists'?'selected':''}" href="#procedures">Working checklists</a><a class="tab ${mode==='guides'?'selected':''}" href="#guides">Reference guides</a></div><div class="tool-row">${filterInput('Find a procedure…')}<select id="group" aria-label="Procedure category"><option value="">All categories</option>${[...new Set((mode==='guides'?guides:flows).map(p=>p.category))].map(x=>`<option>${html(x)}</option>`).join('')}</select></div><div id="procedure-results" aria-live="polite"></div>`;
    function list(){const q=$('#filter').value,g=$('#group').value,results=(mode==='guides'?guides:flows).filter(x=>(!g||g===x.category)&&matches(word([x.title,x.category,x.summary].join(' ')),q));
      $('#procedure-results').innerHTML=`<p class="countline">${results.length} ${mode==='guides'?'reference guides':'working checklists'}</p>`+(results.length?`<div class="procedure-list">${mode==='guides'?results.map(x=>`<a class="proc-row" href="${html(safeUrl(x.url))}" ${x.kind==='archive'?'':'target="_blank" rel="noopener noreferrer"'}><span class="item-icon">${icon('book')}</span><div class="row-main"><div class="row-title">${html(x.title)}</div><div class="row-meta">${html(x.category)} · ${x.kind==='archive'?'Original dashboard':'External reference'}</div></div>${icon(x.kind==='archive'?'chevron':'external')}</a>`).join(''):results.map(p=>flowRow(p,p.summary)).join('')}</div>`:empty('No matching procedures','Try a shorter title or another category.'));}
    $('#filter').oninput=$('#group').onchange=list;list();
  }
  const defaultMatter='General checklist';
  function workflow(id,fromLink){
    const p=findFlow(id);if(!p)return missing();
    const ms=state.matters[id]||{};let matter=Object.hasOwn(ms,fromLink)?fromLink:state.selected[id]||defaultMatter;if(!Object.hasOwn(ms,matter)&&matter!==defaultMatter)matter=defaultMatter;
    nav('procedures');crumb([['Procedure library','#procedures']],p.category);document.title=p.title+' · Compliance Desk';
    const sectionLinks=(p.related||[]).map(r=>relatedLink(r)).join(''),ds=(p.templates||[]).map(id=>templates.find(t=>t.id===id)).filter(Boolean);
    function show(){
      const selected=state.matters[id]?.[matter]||{},checked=p.steps.reduce((n,s,i)=>n+Number(Boolean(selected[i])),0);
      page.innerHTML=header(p.category,p.title,p.summary)+`<div class="detail-layout"><section class="panel"><div class="between"><h2>Working checklist</h2>${saveBtn('flow:'+id)}</div><div class="matter-bar"><label for="matter">Matter</label><select id="matter">${[...new Set([defaultMatter,...Object.keys(state.matters[id]||{})])].map(n=>`<option ${n===matter?'selected':''}>${html(n)}</option>`).join('')}</select><button class="btn" id="add-matter">${icon('plus')} New matter</button></div><form id="new-matter" class="matter-bar" hidden><label for="matter-name">Matter name</label><input class="field-control" id="matter-name" maxlength="80" required placeholder="Company or matter name"><button class="btn primary">Create</button><button type="button" class="btn" id="cancel-matter">Cancel</button></form><div class="meta"><span id="completed">${checked}</span> of ${p.steps.length} complete · Saved in this browser</div><div class="progress"><span id="progress-bar" style="width:${100*checked/p.steps.length}%"></span></div>
      ${p.steps.map((s,i)=>`<label class="step"><input type="checkbox" data-step="${i}" ${selected[i]?'checked':''}><span><strong>${html(s.title)}</strong><p>${html(s.detail)}</p><small class="step-ref">${html(s.reference)}</small></span></label>`).join('')}</section><aside>${sidePanel('Applicability',`<p>${html(p.scope)}</p>`)}${sectionLinks?sidePanel('Legal references',sectionLinks):''}${ds.length?sidePanel('Prepare documents',templateLinks(ds)):''}${sidePanel('Sources',(p.sources||[]).map(s=>sourceLink(s.label,s.url)).join(''))}${p.guides?.length?sidePanel('Further reading',p.guides.map(id=>guides.find(g=>g.id===id)).filter(Boolean).map(g=>sourceLink(g.title,g.url)).join('')):''}</aside></div>`;
      const nameForm=$('#new-matter');
      $('#add-matter').onclick=()=>{nameForm.hidden=false;$('#matter-name').focus();};$('#cancel-matter').onclick=()=>{nameForm.hidden=true;$('#add-matter').focus();};
      $('#matter').onchange=e=>{matter=e.target.value;state.selected[id]=matter;persist();history.replaceState(null,'',procHref(p));show();};
      nameForm.onsubmit=e=>{e.preventDefault();const n=$('#matter-name').value.trim();if(!n||['__proto__','constructor','prototype'].includes(n)){notify('Choose another matter name.');return;}state.matters[id]??={};if(!Object.hasOwn(state.matters[id],n))state.matters[id][n]={};matter=n;state.selected[id]=n;persist();history.replaceState(null,'',procHref(p));show();};
      document.querySelectorAll('[data-step]').forEach(c=>c.onchange=()=>{state.matters[id]??={};state.matters[id][matter]??={};state.matters[id][matter][c.dataset.step]=c.checked;state.selected[id]=matter;persist();const n=document.querySelectorAll('[data-step]:checked').length;$('#completed').textContent=n;$('#progress-bar').style.width=100*n/p.steps.length+'%';});
    }show();
  }
  function docCard(d){return `<a class="tile" href="${docHref(d)}"><span class="type-chip">${html(d.code||d.kind)}</span><h3>${html(d.title)}</h3><p>${html(d.description)}</p><span class="meta">${html(d.kind)}</span></a>`;}
  function documents(id){
    nav('documents');
    if(id){const d=templates.find(x=>x.id===id);if(!d)return missing();crumb([['Document studio','#documents']],d.code||d.title);document.title=d.title+' · Compliance Desk';page.innerHTML=`<div class="detail-actions" style="justify-content:flex-end;margin:0 0 .5rem">${saveBtn('doc:'+id)}</div><div id="doc-host"></div>`;window.DeskForms.render($('#doc-host'),id);return;}
    crumb([['Workspace','#overview']],'Document studio');document.title='Document studio · Compliance Desk';
    page.innerHTML=header('Workspace','Document studio','Prepare editable Word documents, review the prescribed format, and print a copy for signature.')+`<div class="tool-row">${filterInput('Find a form or template…')}</div><div id="doc-list" aria-live="polite"></div><section class="guide-box">${sidePanel('More drafting tools','<a href="generators/">Open the original document generators</a><a href="https://www.mca.gov.in/" target="_blank" rel="noopener noreferrer">Open MCA for official webforms</a>')}</section>`;
    function list(){const ds=templates.filter(d=>matches(word([d.title,d.code,d.kind,d.description].join(' ')),$('#filter').value));$('#doc-list').innerHTML=ds.length?`<div class="tile-grid">${ds.map(docCard).join('')}</div>`:empty('No matching documents','Search by form code or document name.');}$('#filter').oninput=list;list();
  }
  function saved(){
    nav('saved');crumb([['Workspace','#overview']],'Saved items');document.title='Saved items · Compliance Desk';
    const saved=Object.keys(state.saved).map(id=>searchable.find(s=>s.key===id)).filter(Boolean);
    page.innerHTML=header('Personal','Saved items','Your bookmarked provisions, procedures and documents are available in this browser.')+(saved.length?`<div class="list-panel">${saved.map(x=>`<div class="saved-row"><a class="item-list-link" href="${html(x.href)}"><span class="item-icon">${icon(x.icon)}</span><span class="row-main"><span class="row-title">${html(x.title)}</span><br><span class="row-meta">${html(x.meta)}</span></span></a><button class="iconbtn" aria-label="Remove ${html(x.title)} from saved items" data-save="${html(x.key)}">${icon('x')}</button></div>`).join('')}</div>`:empty('Your saved shelf is empty','Open a provision, procedure or document and choose Save to keep it here.'));
  }
  function missing(){nav('');crumb([['Workspace','#overview']],'Page unavailable');document.title='Page unavailable · Compliance Desk';page.innerHTML=empty('Page unavailable','This entry could not be found.')+'<p class="tool-row"><a class="btn" href="#overview">Return to overview</a></p>';}
  async function render(){
    const serial=++routeNo, [dest,id,matter]=routeParts();toggleMenu(false);if(dialog.open)dialog.close();window.scrollTo(0,0);
    try{
      if(location.hash.startsWith('#/')){location.replace('reference.html'+location.hash);return;}
      if(!dest||dest==='overview')home();else if(dest==='library')library(id||'act');else if(dest==='reader')await reader(id,serial);else if(dest==='procedures')id?workflow(id,matter):procedures();else if(dest==='guides')procedures('guides');else if(dest==='documents')documents(id);else if(dest==='saved')saved();else if(dest==='main'){history.replaceState(null,'','#overview');home();$('#main').focus();}else if(dest==='')home();else if(dest.startsWith('/'))location.replace('reference.html'+location.hash);else missing();
    }catch(e){if(serial===routeNo){page.innerHTML=empty('This page could not be loaded','Try opening this page again.')+'<button class="btn" id="retry">Try again</button>';$('#retry').onclick=render;}console.error(e);}
  }
  function getSearch(){const q=$('#search-input').value.trim();let found;
    if(!q){const ids=['law:act-173','flow:appoint-director','doc:mbp-1','law:lodr-30'];found=ids.map(k=>searchable.find(x=>x.key===k)).filter(Boolean);}
    else{const w=word(q),ts=tokens(q);found=searchable.filter(s=>ts.every(t=>s.index.includes(t))).map(s=>({s,score:(s.exact===w?100:0)+(s.titleSearch===w?90:0)+(s.titleSearch.startsWith(w)?40:0)+(s.titleSearch.includes(w)?20:0)+(s.key.startsWith('law:')?0:3)})).sort((a,b)=>b.score-a.score).slice(0,30).map(x=>x.s);}
    $('#search-results').innerHTML=`<p class="search-label">${q?'Search results':'Quick lookups'}</p>`+(found.length?found.map(s=>`<a class="result-item" href="${html(s.href)}"><span class="item-icon">${icon(s.icon)}</span><div><strong>${html(s.title)}</strong><small>${html(s.meta)}</small></div></a>`).join(''):empty('No matches','Try a section number, procedure title or form code.'));}
  function openSearch(){if(!dialog.open)dialog.showModal();$('#search-input').value='';getSearch();$('#search-input').focus();}
  $('#global-search').onclick=openSearch;$('#close-search').onclick=()=>dialog.close();$('#search-input').oninput=getSearch;$('#search-form').onsubmit=e=>{e.preventDefault();const a=$('#search-results a');if(a){dialog.close();location.hash=a.hash;}};
  dialog.addEventListener('click',e=>{if(e.target.closest('a'))dialog.close();else if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  $('.skip').addEventListener('click',e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView();});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}if(e.key==='Escape')toggleMenu(false);});
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-search'))openSearch();
    if(b.dataset.save){const key=b.dataset.save;if(state.saved[key])delete state.saved[key];else state.saved[key]=true;persist();if(activeNav==='saved')saved();else {const wrap=document.createElement('div');wrap.innerHTML=saveBtn(key);const next=wrap.firstElementChild;b.replaceWith(next);next.focus();}}
    if(b.dataset.font){const val=Math.round(((Number(state.sizes)||1.16)+Number(b.dataset.font)*.1)*100)/100;state.sizes=Math.min(1.76,Math.max(.96,val));document.querySelector('.statute')?.style.setProperty('--reading-size',state.sizes);persist();}
  });
  function searchEntry(o){o.titleSearch=word(o.title);o.index=word([o.title,o.meta,o.extra,o.exact].join(' '));o.exact=word(o.exact);searchable.push(o);}
  async function start(){
    try{
      const [entries,pr]=await Promise.all([localJSON('desk/library/catalog.json'),localJSON('desk/procedures/catalog.json')]);
      lib=entries;flows=pr.workflows;guides=pr.guides;templates=window.DeskForms.templates;
      lib.forEach(r=>{catalog.set(r.id,r);r.search=word([ref(r),r.title,r.group].join(' '));searchEntry({key:'law:'+r.id,title:ref(r)+' · '+r.title,meta:volumes[r.kind].short+' · '+r.group,href:lawHref(r),icon:volumes[r.kind].icon,exact:ref(r),extra:r.number});});
      flows.forEach(p=>searchEntry({key:'flow:'+p.id,title:p.title,meta:'Procedure · '+p.category,extra:p.summary,href:procHref(p),icon:'checklist'}));
      templates.forEach(d=>searchEntry({key:'doc:'+d.id,title:(d.code?d.code+' · ':'')+d.title,meta:d.kind,extra:d.description,exact:d.code,href:docHref(d),icon:'pen'}));
      syncSaved();window.addEventListener('hashchange',render);await render();
    }catch(e){page.innerHTML=empty('The desk could not be opened','Reload to try loading the reference library again.')+'<button class="btn" id="retry-start">Reload desk</button>';$('#retry-start').onclick=()=>location.reload();console.error(e);}
  }start();
})();
