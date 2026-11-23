"""Build Compliance Desk reader records from the PDFs and index in Compliance-Lab.

Run from the repository root: python build_desk_library.py --root . --out desk/library
Requires PyMuPDF. Inputs are versioned with the repository, and no network is used.
"""
import argparse
import collections
import datetime
import json
import re
import shutil
from pathlib import Path
from urllib.parse import quote

import fitz


INDIA_CODE = 'https://www.indiacode.nic.in/indiacode/handle/123456789/2114?view_type=browse'
SEBI = 'https://www.sebi.gov.in/sebi_data/attachdocs/oct-2026/1792664915776.pdf'
NUM = re.compile(r'^(?:\[\s*)*(\d{1,3}[A-Z]{0,2})\s*\.\s*')
CHAPTER = re.compile(r'^\[?CHAPTER\s*([IVXL]+(?:\s*[-–]?\s*A)?)\s*\]?$', re.I)
START_PARA = re.compile(r'^\[*(?:\(\s*(?:[a-zA-Z0-9-]{1,6})\s*\)|Provided\b|Explanation\b|Illustration\b|Note\b|[A-Z0-9]{1,3}\.\s)')
SLUGS = {
    'meetings-of-board':'board','appointment-and-qualification':'directors',
    'appointment-and-remuneration':'managerial','incorporation':'incorporation',
    'share-capital-and-debentures':'share-capital','prospectus-and':'prospectus',
    'management-and-administration':'management','audit-and-auditors':'audit',
    'accounts-rules':'accounts','registration-of-charges':'charges',
    'corporate-social':'csr','declaration-and-payment':'dividend',
    'acceptance-of-deposits':'deposits','significant-beneficial':'sbo',
    'registration-offices':'registration','compromises-arrangements':'arrangements',
}
# Topic-level companion readings, distinct from literal cross-citations.
LODR_COMPANIONS = {
    '17':'149 152 173','18':'177','19':'178','20':'178','22':'177','23':'188 177',
    '24A':'204','25':'149 150 152','26':'165','29':'173','33':'129 134',
    '34':'134 135 136','36':'136 101','37':'230 232','40':'56','42':'91','43':'123',
    '44':'108 110','45':'13','62D':'149 152 173','62F':'177','62G':'178',
    '62H':'178','62J':'177','62K':'177 188','62M':'204','62N':'149',
}
RULE_COMPANIONS = {
    'board-3':'173','board-6':'177 178','board-6A':'177 188','board-7':'177',
    'board-8':'179','board-9':'184','board-15':'188','board-16':'189',
    'directors-4':'149','directors-5':'149','directors-6':'150','directors-8':'152',
    'directors-14':'164','directors-15':'168','directors-17':'170','directors-18':'170',
    'managerial-8':'203','managerial-8A':'203','managerial-9':'204',
    'accounts-8':'134','accounts-12':'137','audit-4':'139','audit-13':'143',
    'management-11':'92','management-18':'101','management-20':'108',
    'management-22':'110','management-24':'117','incorporation-25':'12',
    'share-capital-13':'62','prospectus-14':'42','charges-3':'77',
    'csr-4':'135','csr-5':'135','csr-7':'135','dividend-3':'123',
}
LODR_RULES = {
    '17':'directors-4 board-3','18':'board-6','19':'board-6','20':'board-6',
    '22':'board-7','23':'board-6A board-15','24A':'managerial-9','25':'directors-4',
    '34':'accounts-8','44':'management-20','62F':'board-6','62K':'board-15','62M':'managerial-9',
}
# Edition headings printed across multiple lines, superscript note markers or page breaks.
LODR_TITLES = {
    '1':'Short title and commencement','2':'Definitions','5':'General obligation of compliance',
    '24A':'Secretarial audit and secretarial compliance report',
    '30A':'Disclosure requirements for certain types of agreements binding listed entities',
    '31A':'Conditions for re-classification of any person as promoter / public',
    '31B':'Special rights to shareholders','37A':'Sale, lease or disposal of an undertaking outside scheme of arrangement',
    '59A':'Draft scheme of arrangement and scheme of arrangement',
    '62A':'Listing of subsequent issuances of non-convertible debt securities',
    '62G':'Nomination and remuneration committee','91D':'Intimations and disclosures by Social Enterprise of events or information to Stock Exchange(s)',
    'SIII':'Disclosures of events or information','SIV':'Disclosures in financial results',
    'SVIII':'Omitted',
}


def compact(text):
    return re.sub(r'\s+', ' ', text.replace('\xad','').replace('\xa0',' ')).strip()


def join(lines):
    return compact(' '.join(lines))


def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def natural(s):
    m = re.match(r'(\d+)(.*)',s)
    return (int(m[1]),m[2]) if m else (1000,s)


def lines_of(pdf, kind):
    """Group spans by physical baseline. Drop note markers, page furniture and notes."""
    rows=[]
    for page in pdf:
        cut=page.rect.height-52
        if kind=='act':
            # India Code prints a horizontal 2-inch separator before marginal notes.
            for draw in page.get_drawings():
                rect=draw['rect']
                if 141<rect.width<146 and rect.height<1.6 and rect.x0<90:
                    cut=min(cut,rect.y0)
        grouped={}
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines',[]):
                for span in line['spans']:
                    y=span['origin'][1]
                    t=span['text']
                    if not t.strip() or y>cut or (kind=='rule' and (y<72 or y>page.rect.height-61)):
                        continue
                    if kind=='lodr' and span['size']<10.8:
                        continue
                    if kind=='rule' and span['size']<8.4:
                        continue
                    if kind=='act' and span['size']<8.4 and re.fullmatch(r'[\s\d*]+',t):
                        continue
                    k=round(y)
                    k=next((v for v in (k,k-1,k+1) if v in grouped),k)
                    grouped.setdefault(k,[]).append(span)
        for y, spans in sorted(grouped.items()):
            spans.sort(key=lambda s:s['origin'][0])
            text='';bold='';in_lead=True;end=None
            for span in spans:
                if end and span['origin'][0]-end>1.45:
                    text+=' '
                    if in_lead:bold+=' '
                text+=span['text'];end=span['bbox'][2]
                if 'Bold' in span['font'] and in_lead:
                    bold+=span['text']
                elif span['text'].strip() not in ('[',']','{','}'):
                    in_lead=False
            text=compact(text)
            if not text or (text==str(page.number+1) and y>page.rect.height-99):
                continue
            rows.append((page.number+1,round(spans[0]['origin'][0]),compact(bold),text))
    return rows


def norm_heading(t):
    return re.sub(r"[\s.\[\]{}:—–─-]+","",t).casefold()


def after_heading(text, lead):
    """PDF bold runs sometimes omit editorial brackets inside the printed title."""
    goal=norm_heading(lead)
    if not goal:return None
    folded=''
    for j,c in enumerate(text):
        folded+=norm_heading(c)
        if folded==goal:
            return text[j+1:].lstrip(' .—–─-:]}')
        if not goal.startswith(folded):return None
    return None


def paragraphs(lines):
    pars=[]
    for text in lines:
        text=compact(text)
        if not text:continue
        if not pars or START_PARA.match(text) or (len(text)>4 and text.isupper()) or (pars[-1].rstrip(']').endswith(('.',':','—',';')) and text[0].isupper()):
            pars.append(text)
        else:pars[-1]+=' '+text
    return pars


class Library:
    def __init__(self,root):
        self.root=root
        self.index={}
        self.content={}
        self.edges={}
        self.source_files = {}

    def add(self,key,kind,num,title,group,source,edition,pdf,page,body,note=None):
        if key in self.index:raise ValueError(f'Duplicate reader id: {key}')
        self.index[key]={'id':key,'kind':kind,'number':num,'title':title,'group':group,'source':source,'asOf':edition}
        relative_pdf = pdf.relative_to(self.root)
        self.source_files[relative_pdf] = pdf
        source_pdf = 'desk/sources/' + quote(relative_pdf.as_posix())
        self.content[key]={'paragraphs':paragraphs(body),'related':[],'pdf':source_pdf+f'#page={page}'}
        if note:self.content[key]['note']=note

    def edge(self,a,b,label_a,label_b):
        if a not in self.index or b not in self.index or a==b:return
        if (a,b) in self.edges:return
        self.edges[(a,b)]=label_a;self.edges[(b,a)]=label_b

    def save(self,out):
        out.mkdir(exist_ok=True,parents=True)
        for relative_pdf, source in self.source_files.items():
            destination = out.parent / 'sources' / relative_pdf
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
        for (a,b),label in self.edges.items():
            self.content[a]['related'].append({'id':b,'kind':self.index[b]['kind'],'label':label})
        for kind in ('act','rule','lodr'):
            batch={};size=0;seq=1
            for key,row in self.index.items():
                if row['kind']!=kind:continue
                record=self.content[key]
                add=len(dump(record).encode())+len(key)+5
                if size+add>340_000 and batch:
                    (out/f'texts-{kind}-{seq}.json').write_text(dump(batch),encoding='utf-8')
                    batch={};size=0;seq+=1
                row['part']=f'texts-{kind}-{seq}.json'
                size+=add;batch[key]=record
            if batch:(out/f'texts-{kind}-{seq}.json').write_text(dump(batch),encoding='utf-8')
        (out/'catalog.json').write_text(dump(list(self.index.values())),encoding='utf-8')


def add_act(lib,sections,path):
    legacy={s['section']:s for s in sections}
    with fitz.open(path) as doc:rows=lines_of(doc,'act')
    body_start=next(i for i,(_,_,_,t) in enumerate(rows) if 'BE it enacted by Parliament' in t)
    sched_start=next(i for i in range(body_start,len(rows)) if rows[i][-1]=='SCHEDULE I')
    # The PDF table of contents supplies titles; text labels are resolved in numeric order.
    group={};toc={};ch='I'
    for _,_,_,t in rows[:body_start]:
        m=CHAPTER.match(t)
        if m:ch=m[1]
        m=NUM.match(t)
        if m:
            n=m[1];group[n]=ch;toc[n]=t[m.end():].strip(' .[]')
    groups={s['chapter']:s['chapter_title'].capitalize() for s in sections}
    groups.update({'XXI':'Companies authorised to register under this Act','XXIA':'Producer companies'})
    order=sorted(toc.keys()|legacy.keys(),key=natural)
    marks={};last=body_start
    for n in order:
        # The printed heading says 37ZA; the arrangement and numbering give 378ZA.
        prefix='37ZA' if n=='378ZA' else n
        rx=re.compile(r'^\[*\s*'+prefix+r'\s*\.')
        for i in range(last,sched_start):
            if rx.match(rows[i][-1]):
                marks[n]=i;last=i+1;break
    marked=sorted((i,n) for n,i in marks.items())
    for pos,(i,n) in enumerate(marked):
        end=marked[pos+1][0] if pos+1<len(marked) else sched_start
        raw=[x[-1] for x in rows[i:end]]
        # The next chapter/part labels are navigation, outside this section.
        j=next((k for k,t in enumerate(raw[1:],1) if CHAPTER.match(t) or re.match(r'^PART\s+[IVX]+\b',t)),len(raw))
        raw=raw[:j]
        item=legacy.get(n,{})
        t=toc.get(n) or item.get('title') or ('Annual general meetings' if n=='378ZA' else 'Section '+n)
        if item.get('title') and t!='Omitted' and len(item['title'])<160 and n not in ('269','325') and len(item['title'])>=len(t):
            t=item['title']
        first=NUM.sub('',raw[0])
        h=rows[i][2];h=NUM.sub('',h).strip('[] .—-')
        alltext=join([first]+raw[1:3])
        omitted=re.search(r'^\[([^\]]+)\]\.?\s*(?:Omitted|Repealed)',alltext,re.I)
        if omitted:
            t=omitted[1].rstrip('.')
            first=re.sub(r'^\[[^\]]+\]\.?\s*','',first)
        else:
            # The heading/body divider may appear on the next physical line.
            for k,line in enumerate(raw[:4]):
                m=re.search(r'\.\s*[—–―]|\.\s*-(?=[A-Z(])|(?<=[a-z])—(?=\(?[A-Z0-9])',line)
                if m:
                    raw=raw[k:];first=line[m.end():].lstrip('-— .');break
            else:
                ht=t.strip(' .')
                if first.lower().startswith(ht.lower()):first=first[len(ht):].lstrip(' .—-')
        raw[0]=first
        ch=group.get(n,item.get('chapter',''))
        if n.startswith('378') and n!='378':ch='XXIA'
        note=None
        if omitted:note='The source edition records this section as omitted or repealed.'
        if n=='378ZA':note='The arrangement of sections identifies this as section 378ZA. The printed body heading reads “37ZA”.'
        lib.add('act-'+n,'act',n,t.strip(' .'),'Chapter '+ch+' · '+groups.get(ch,''),INDIA_CODE,'1 Apr 2021',path,rows[i][0],raw,note)
    # Preserve layout-sensitive statutory schedules via the exact source page.
    schedule_names=['Memorandum and articles of association','Useful lives to compute depreciation','General instructions for preparation of financial statements','Code for independent directors','Appointment and remuneration of managerial personnel','Infrastructure projects and facilities','Activities for corporate social responsibility']
    for roman,title in zip(['I','II','III','IV','V','VI','VII'],schedule_names):
        target=next((x for x in rows[sched_start:] if re.match(r'^\[?SCHEDULE\s+'+roman+r'(?:\]|$)',x[-1])),None)
        if target:
            lib.add('act-S'+roman,'act','Schedule '+roman,title,'Schedules',INDIA_CODE,'1 Apr 2021',path,target[0],[], 'Open the source PDF to read the schedule with its original tables, forms and layout.')
    return marks


def add_lodr(lib,path,legacy):
    legacy={x['id']:x['t'] for x in legacy}
    with fitz.open(path) as doc:rows=lines_of(doc,'lodr')
    positions={};chapters=[];sched={}
    for i,(p,x,b,t) in enumerate(rows):
        sc=re.match(r'^\[?SCHEDULE\s+([IVX]{1,5})\b',t)
        if sc and (sc[1]=='I' and 'TERMS OF SECURITIES' in t or sched):
            sched.setdefault(sc[1],i)
        if sched:continue
        ch=CHAPTER.match(t)
        if ch:chapters.append((i,'Chapter '+ch[1].replace(' ','')));continue
        m=NUM.match(t)
        if m and (b or m[1]=='59A') and m[1] not in positions:
            positions[m[1]]=i
    marks=[]
    for n,i in positions.items():
        p,x,b,t=rows[i];m=NUM.match(t);start=i
        if re.fullmatch(r'64[A-I]',n):
            title=t[m.end():];first=''
            if n=='64E':title+=' Trustee';i+=1
        else:
            k=i-1
            while k>0 and ((rows[k][2] and norm_heading(rows[k][2])==norm_heading(rows[k][-1])) or (k==i-1 and n=='59A')) and not rows[k][-1].isupper():
                k-=1
            start=k+1 if k<i-1 else i
            title=join(z[-1] for z in rows[start:i])
            first=t[m.end():]
        title=LODR_TITLES.get(n,legacy.get(n,title) if n not in ('64A','64B','64C','64D','64E','64F','64G','64H','64I') else title)
        title=title.strip(' .[]{}')
        chapter=next((ch for j,ch in reversed(chapters) if j<i),'Chapter I')
        marks.append((start,i+1,n,title,chapter,first,p))
    for roman,i in sched.items():
        title=LODR_TITLES.get('S'+roman,legacy.get('S'+roman,'Schedule '+roman)).capitalize()
        marks.append((i,i+1,'S'+roman,title,'Schedules','',rows[i][0]))
    for pos,(start,i,n,title,chapter,first,p) in enumerate(marks):
        stop=marks[pos+1][0] if pos+1<len(marks) else len(rows)
        stop=min([stop]+[j for j,_ in chapters if i<=j<stop])
        body=[first]+[x[-1] for x in rows[i:stop]]
        note=None
        if n.startswith('S'):
            note='The source PDF preserves schedule tables, column headings and amendment footnotes.'
            if n in ('SIX','SX','SVIII'):body=[]
        lib.add('lodr-'+n,'lodr',('Schedule '+n[1:]) if n.startswith('S') else n,title,chapter,SEBI,'15 Oct 2026',path,p,body,note)


def source_edition(doc):
    # Printed-on dates describe a retrieval. Only a stated amendment date dates the law.
    for page in doc:
        m=re.search(r'Last amendment on\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})',page.get_text(),re.I)
        if m:
            try:
                dt=datetime.datetime.strptime(re.sub(r'[/-]','.',m[1]),'%d.%m.%Y')
                return dt.strftime('%d %b %Y').lstrip('0')+' · archive edition'
            except ValueError:pass
    return 'Archive edition · amendment date unspecified'


def add_rules(lib,data):
    sets={s['id']:s for s in data['rule_sets']}
    old=collections.defaultdict(dict)
    for r in data['rules']:old[r['rule_set_id']][r['rule']]=r
    for name,rs in sets.items():
        if name in ('Company Law','Resolution','LODR, 2015'):continue
        path=next(lib.root.rglob(name+'.pdf'),None)
        if not path:continue
        clean_name=re.sub(r'-20\d{6}-\d{6}$','',name)
        slug=next((v for k,v in SLUGS.items() if k in clean_name),clean_name)
        group=rs['name']
        if len(group)>180 or re.search(r'-20\d{6}-\d{6}',group):
            group=clean_name.replace('-',' ').capitalize()
        with fitz.open(path) as doc:
            edition=source_edition(doc);rows=lines_of(doc,'rule')
        stop=next((i for i,r in enumerate(rows) if re.search(r'^(?:Access complete Bare Act|Join WhatsApp Channel|Subscribe now|Dashboard/OnePage|Download Mobile App|\[?(?:F\.\s*No\.|FN\s+\d+/))',r[-1],re.I)),len(rows))
        rows=rows[:stop]
        known=old[name]
        marks={};last=(0,'')
        for i,(p,x,b,t) in enumerate(rows):
            # Body parts end at a named annexure/schedule. These keep their PDF layout.
            if marks and re.fullmatch(r'\s*[\[ ]*SCHEDULE[ \[\]:—–-]*(?:[IVX]+|\d+)?[\] .:-]*',t):
                rows=rows[:i];break
            if marks and re.match(r'^(?:\[?(?:ANNEXURE|APPENDIX)(?:\s*[-:IVX\d]*\]?$|\s*[-:])|FORM\s+(?:NO\.|[A-Z]{2,5}-\d+)|(?:THE )?(?:FIRST |SECOND )?SCHEDULE(?:\s*[-IVX\d]*$))',t):
                rows=rows[:i];break
            omitted=re.fullmatch(r'(?:\[\s*)*Rules?\s+([0-9A-Za-z,\- ]+)\s+omitted\.?[ \]]*',t,re.I)
            if omitted:
                for n in re.findall(r'\d+[A-Z]*',omitted[1]):
                    if n not in marks and natural(n)>last:
                        marks[n]=(i,i,'Omitted','',True);last=natural(n)
                continue
            m=NUM.match(t)
            if not m:continue
            n=m[1]
            if natural(n)<=last or int(re.match(r'\d+',n)[0])>290 or x>125:continue
            if n not in known:
                # New insertions must have a plausible standalone heading or be adjacent.
                numerical=natural(n)[0]
                if numerical not in (last[0],last[0]+1) and n!='1':continue
                if not b and len(t[m.end():])<2:continue
            if not marks and (n!='1' and n not in known):continue
            # Start well after notification numbers, not at a paragraph in the preamble.
            if n=='1' and i>=1 and re.search(r'(?:G\.S\.R\.|S\.O\.)$',rows[i-1][-1]):continue
            title=known.get(n,{}).get('title','')
            title=re.sub(r'\[\d+\]','',title).strip(' .[]{}')
            if len(title)>185 or known.get(n,{}).get('untitled') or title.lower() in ('untitled','omitted'):title=''
            last=natural(n)
            first=t[m.end():]
            # Bold type identifies the rule title, which can wrap onto following baselines.
            dehead=NUM.sub('',b).strip(' []')
            if dehead or b:
                j=i
                heading=dehead
                remaining=first
                while j<len(rows):
                    lead=rows[j][2]
                    if j>i:
                        if not lead or NUM.match(rows[j][-1]):break
                        heading=join([heading,lead])
                    if not lead:break
                    lt=rows[j][-1].lstrip('[')
                    tail=after_heading(lt,lead)
                    if tail:
                        remaining=tail;break
                    if tail is None:
                        # A styled title embedded in body text is retained verbatim.
                        remaining=lt;break
                    if j+1<len(rows) and (not rows[j+1][2] or NUM.match(rows[j+1][-1])):
                        remaining='';break
                    j+=1
                if heading and len(heading)<180:
                    title=heading.lstrip('[(1234567890) ').strip(' .-—─–:[]') or title
                if j>=len(rows):j=i
                if j>i and (not rows[j][2] or NUM.match(rows[j][-1])):j-=1
                if not heading.strip(' .[]:—–-') or re.fullmatch(r'\d+[A-Z]*\.?',heading):
                    title=known.get(n,{}).get('title','')
                if slug=='managerial' and n=='8A':title='Appointment of a whole-time company secretary'
                marks[n]=(i,j,title,remaining,False)
            else:
                # Some statutory provisions have no caption. Never invent a caption from prose.
                if title and compact(first).lower().startswith(title.lower()):
                    first=first[len(title):].lstrip('.-─—– ')
                marks[n]=(i,i,title,first,False)
        for pos,n in enumerate(sorted(marks,key=natural)):
            start,i,title,first,omitted=marks[n]
            if title.endswith('section') and i+1<len(rows) and re.fullmatch(r'\d+\.\s*[-—–.]',rows[i+1][-1]):
                i+=1;title+=' '+re.match(r'\d+',rows[i][-1])[0];first=''
            end=next((s for s,_,_,_,_ in marks.values() if s>start),len(rows))
            body=[first]+[r[-1] for r in rows[i+1:end]]
            note=None
            if omitted:
                body=[rows[start][-1]];title='Omitted';note='The source edition marks this rule as omitted.'
            if not title:title='Rule '+n
            if 'auditors-report-order' in name and ('2015-' in name or '2016-' in name):
                note='Historical auditor reporting order. Check the applicable reporting period and subsequent orders.'
            key='rule-'+slug+'-'+n
            lib.add(key,'rule',n,title,group,INDIA_CODE,edition,path,rows[start][0],body,note)
        # A source PDF remains available when typography cannot confirm an indexed boundary.
        # This also preserves an entire instrument even if no numbered headings were recovered.
        for n in sorted(known.keys()-marks.keys(),key=natural):
            if not marks or natural(n)>max(map(natural,marks)):continue
            entry=known[n]
            title=re.sub(r'\[\d+\]','',entry['title']).strip(' [].-')
            if len(title)>160 or entry.get('untitled'):title='Rule '+n
            previous=[k for k in marks if natural(k)<natural(n)]
            page=rows[marks[previous[-1]][0]][0] if previous else 1
            lib.add('rule-'+slug+'-'+n,'rule',n,title or ('Rule '+n),group,INDIA_CODE,edition,path,page,[],
                    'The archive index lists this rule. Open the PDF and locate the rule number to read its text in context.')


def add_connections(lib):
    # Recognize only explicitly identified Acts. A bare reference in LODR to “the Act”
    # means the SEBI Act and must never generate a Companies Act link.
    sec_spec=r'((?:\d{1,3}[A-Z]{0,2}(?:\s*\([A-Za-z0-9]+\))*\s*(?:(?:,\s*(?:and\s+)?|and\s+|or\s+|to\s+)\d{1,3}[A-Z]{0,2}(?:\s*\([A-Za-z0-9]+\))*\s*)*))'
    for key,item in list(lib.content.items()):
        kind=lib.index[key]['kind']
        if not item['paragraphs']:continue
        text=join(item['paragraphs'])
        law=r'Companies\s+Act,?\s*2013' if kind=='lodr' else r'(?:Companies\s+Act,?\s*2013|Act\b(?!\s*,?\s*19\d\d))'
        pattern=r'(?<![\w-])sections?\s+'+sec_spec+r'of\s+(?:the\s+)?'+law
        for m in re.finditer(pattern,text,re.I):
            spec=re.sub(r'\([^)]*\)','',m[1])
            for n in re.findall(r'\b\d{1,3}[A-Z]{0,2}\b',spec):
                lib.edge(key,'act-'+n,'Cites this section','Cited by this '+('regulation' if kind=='lodr' else 'rule'))
        # Include unqualified section numbers in Companies Act instruments when
        # the surrounding sentence does not name a different enactment. Mark them
        # as contextual references rather than a representation of applicability.
        if kind in ('act','rule'):
            for m in re.finditer(r'(?<![\w-])sections?\s+'+sec_spec,text,re.I):
                after=text[m.end():m.end()+140]
                # “of” followed by an identified law, Code, rules or a source other
                # than the Companies Act is not an intra-Act reference.
                if re.match(r'^\s*of\b',after,re.I):
                    if not re.match(r'^\s*of\s+(?:(?:this|the)\s+Act\b|the\s+Companies\s+Act,?\s*2013)',after,re.I):continue
                    if re.match(r'^\s*of\s+the\s+Act,?\s+19\d\d',after,re.I):continue
                clause=text[max(0,m.start()-110):m.end()+75]
                if re.search(r'Companies Act,?\s*1956|Income.tax Act|Insolvency and Bankruptcy Code|Securities Contracts|Indian Penal Code|Code of (?:Civil|Criminal) Procedure',clause,re.I):continue
                for number in re.findall(r'\b\d{1,3}[A-Z]{0,2}\b',re.sub(r'\([^)]*\)','',m[1])):
                    lib.edge(key,'act-'+number,'Section mentioned in text','Mentioned by this '+('section' if kind=='act' else 'rule'))
        if kind=='lodr':
            for m in re.finditer(r'(?<![\w-])regulations?\s+(\d{1,3}[A-Z]{0,2})(?:\s*\([a-zA-Z0-9]+\))*\s+of\s+these\s+regulations\b',text,re.I):
                lib.edge(key,'lodr-'+m[1],'Cites this regulation','Cited in this provision')
    for n,sections in LODR_COMPANIONS.items():
        for s in sections.split():lib.edge('lodr-'+n,'act-'+s,'Companion provision','Companion provision')
    for n,sections in RULE_COMPANIONS.items():
        for s in sections.split():lib.edge('rule-'+n,'act-'+s,'Companion provision','Companion provision')
    for n,rules in LODR_RULES.items():
        for r in rules.split():lib.edge('lodr-'+n,'rule-'+r,'Companion provision','Companion provision')
    for s,num in [('SI','4 5'),('SII','123'),('SIII','129'),('SIV','149'),('SV','197'),('SVI','55'),('SVII','135')]:
        for n in num.split():lib.edge('act-'+s,'act-'+n,'Companion provision','Companion schedule')
    for n,sched in {'12':'SI','17':'SII','18':'SII','19':'SII','20':'SII','21':'SII','30':'SIII','33':'SIV','34':'SV','39':'SVI','40':'SVII'}.items():
        lib.edge('lodr-'+n,'lodr-'+sched,'Companion schedule','Companion provision')


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root',type=Path,default=Path('.'));p.add_argument('--out',type=Path,default=Path('desk/library'))
    args=p.parse_args();root=args.root.resolve()
    def load(file):return json.loads((root/'data'/file).read_text(encoding='utf-8'))
    lib=Library(root)
    add_act(lib,load('sections.json'),next(root.rglob('Companies Act 2013 as amended upto 01.04.2021_.pdf')))
    add_lodr(lib,next(root.rglob('LODR, 2015.pdf')),load('lodr.json'))
    add_rules(lib,load('rules.json'));add_connections(lib);lib.save(args.out)
    counts=collections.Counter(r['kind'] for r in lib.index.values())
    print(f'Reader: {dict(counts)}; {len(lib.edges)//2} bidirectional links.')

if __name__=='__main__':
    main()
