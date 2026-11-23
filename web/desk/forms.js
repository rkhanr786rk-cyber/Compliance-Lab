/* The editor, preview and exports share one document model. Nothing is sent to a server. */
(() => {
  'use strict';
  const indiaCode = name => 'https://upload.indiacode.nic.in/showfile?actid=AC_CEN_22_29_00008_201318_1517807327856&filename=' + name + '&type=rule';
  const sources = {
    dir: indiaCode('NCARules_Chapter11.pdf') + '#page=44',
    clearance: 'https://indiacode.ecourtsindia.com/doc/e82c7a65-63d6-4ede-8428-53e0f4c4efc4.pdf',
    dirKit: 'https://www.mca.gov.in/content/dam/mca/mca-forms-instruction-kit/Instruction%20Kit_Form%20No%20DIR%2012.pdf',
    mbp: indiaCode('NCARules_Chapter12.pdf') + '#page=19',
    proxy: 'https://thc.nic.in/Central%20Governmental%20Rules/Companies%20%28Management%20and%20Administration%29%20Rules%2C2014.pdf#page=107',
    schedule: 'https://upload.indiacode.nic.in/schedulefile?aid=AC_CEN_22_29_00008_201318_1517807327856&rid=8',
    standard: 'https://www.icsi.edu/media/webmodules/Final_SS-1.pdf'
  };
  const field = (key, label, type = 'text', options = []) => ({ key, label, type, options });
  const company = field('company', 'Company name');
  const director = field('name', 'Director’s full name');
  const office = field('office', 'Registered office address', 'textarea');
  const place = field('place', 'Place of signing');
  const date = field('date', 'Date of signing', 'date');
  const designation = field('designation', 'Designation');
  const signer = field('signer', 'Signatory’s name');
  const meetingDate = field('meetingDate', 'Meeting date', 'date');
  const meetingTime = field('meetingTime', 'Meeting time and time zone');
  const venue = field('venue', 'Full address of meeting venue', 'textarea');
  const meetingNo = field('meetingNo', 'Meeting serial number');
  const cin = field('cin', 'Corporate identity number (CIN)');
  const p = text => ({ type: 'paragraph', text });
  const head = text => ({ type: 'heading', text });
  const table = (headings, rows, widths) => ({ type: 'table', headings, rows, widths });
  const blanks = label => '[' + label + ']';
  const value = (data, key, label) => String(data[key] || '').trim() || blanks(label);
  const lines = content => String(content || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  const formatDate = (dateValue, withDay = false) => {
    if (!dateValue) return '[Date]';
    const parsed = new Date(dateValue + 'T12:00:00Z');
    if (Number.isNaN(parsed.getTime())) return dateValue;
    const opt = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    if (withDay) opt.weekday = 'long';
    return new Intl.DateTimeFormat('en-IN', opt).format(parsed);
  };
  function signingDate(dateValue) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || '')) return '[Day] day of [Month and year]';
    const [year, month, day] = dateValue.split('-').map(Number);
    const monthName = new Intl.DateTimeFormat('en-IN', {month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(year, month - 1, day)));
    return String(day) + ' day of ' + monthName + ' ' + year;
  }
  const signature = (data, withName = false) => [
    p('Signature: __________________________'),
    ...(withName ? [p(value(data, 'signer', 'Signatory’s name'))] : []),
    p('Designation: ' + value(data, 'designation', 'Designation')),
    p('Place: ' + value(data, 'place', 'Place of signing') + '     Date: ' + formatDate(data.date))
  ];
  const numbered = (content, fallback) => {
    const entries = lines(content);
    return (entries.length ? entries : [blanks(fallback)]).map((item, i) => p((i + 1) + '. ' + item));
  };
  const dirFields = [
    field('din', 'Director identification number (DIN)'), director,
    field('father', 'Father’s full name'), field('address', 'Residential address', 'textarea'),
    field('email', 'Email address', 'email'), field('mobile', 'Mobile number', 'tel'),
    field('pan', 'Income-tax PAN'), field('occupation', 'Occupation'),
    field('birth', 'Date of birth', 'date'), field('nationality', 'Nationality'),
    field('directorships', 'Existing directorship count and companies where MD, CEO, whole-time director, secretary, CFO or manager', 'textarea'),
    field('membership', 'Professional institute, membership and certificate of practice numbers (enter NIL if none)', 'textarea')
  ];
  const clearanceAnswers = ['Clearance is not required', 'Clearance was required, obtained and attached'];
  const interestColumns = ['Entity name', 'Interest or change in interest', 'Shareholding', 'Date the interest arose or changed'];
  const interestKeys = ['entity', 'interest', 'holding', 'since'];
  const templates = [
    {
      id: 'dir-2', code: 'DIR-2', title: 'Consent to act as a director', kind: 'Adapted working copy', documentCode: 'DIR-2 · Working copy', verification: 'The declarations are adapted from the notified form. Review the signed wording against the Gazette and its 2022 amendment.',
      section: 152, basis: 'Section 152(5) · Appointment and Qualification of Directors Rules, rule 8',
      description: 'Prepare director particulars and review the written consent and clearance declarations against the Gazette.',
      source: sources.dir, references: [
        ['Notified DIR-2 · Gazette, 31 March 2014, pp. 44–45', sources.dir],
        ['Security-clearance amendment · G.S.R. 410(E), 1 June 2022', sources.clearance],
        ['MCA V3 · DIR-12 instruction kit', sources.dirKit]
      ],
      note: 'This working copy uses adapted declarations. Check the notified wording before signing. For an MCA V3 appointment, complete the electronic consent within DIR-12.',
      groups: [['Company', [company, office]], ['Director particulars', dirFields], ['Declaration and signing', [
        field('clearance', 'MHA security clearance', 'select', clearanceAnswers), designation, place, date
      ]]],
      body(d) {
        const name = value(d, 'name', 'Director’s name');
        const entity = value(d, 'company', 'Company name');
        const clearance = d.clearance === clearanceAnswers[0] ? 'I do not require prior security clearance from the Government of India’s Ministry of Home Affairs for this appointment.'
          : d.clearance === clearanceAnswers[1] ? 'I require prior security clearance from the Government of India’s Ministry of Home Affairs for this appointment. I have obtained it and attach a copy.'
          : '[Select the applicable Ministry of Home Affairs security-clearance declaration before signing.]';
        return [
          p('To\n' + entity + '\n' + value(d, 'office', 'Company address')), head('Subject: Consent to act as a director'),
          p('I, ' + name + ', consent under section 152(5) of the Companies Act, 2013 to serve as a director of ' + entity + '. I certify that the Act does not disqualify me from appointment.'),
          ...dirFields.map((f, i) => p((i + 1) + '. ' + f.label + ': ' + (f.type === 'date' ? formatDate(d[f.key]) : value(d, f.key, f.label)))),
          head('Declaration'),
          p('(i) I declare that I have not been convicted of any offence in connection with the promotion, formation or management of any company or LLP and have not been found guilty of any fraud or misfeasance or of any breach of duty to any company under this Act or any previous company law in the last five years. I further declare that, if appointed, the total number of companies in which I hold directorships will not exceed the prescribed number.'),
          p('(ii) ' + clearance), p('Signature: __________________________'), p('Designation: ' + value(d, 'designation', 'Designation')), p('Date: ' + formatDate(d.date)), p('Place: ' + value(d, 'place', 'Place')), head('Attachments'), p('1. Identity evidence\n2. Evidence of residential address' + (d.clearance === clearanceAnswers[1] ? '\n3. Ministry of Home Affairs security clearance' : ''))
        ];
      }
    },
    {
      id: 'mbp-1', code: 'MBP-1', title: 'Notice of interest by director', kind: 'Prescribed format', documentCode: 'Form MBP-1', documentBasis: '[Pursuant to section 184(1) and rule 9(1)]', verification: 'The notice recital, interest columns and signature particulars follow the published MBP-1. Company-specific choices and spacing are filled in here.',
      section: 184, basis: 'Section 184(1) · Meetings of Board and its Powers Rules, rule 9(1)',
      description: 'Record a director’s interests, shareholdings and changes in a repeatable disclosure table.',
      source: sources.mbp, references: [['Notified MBP-1 · G.S.R. 240(E), 31 March 2014, pp. 19–20', sources.mbp]],
      note: 'Address the notice to the board. Enter each interest separately, or expressly select a nil disclosure.',
      groups: [['Director and company', [company, director, field('relation', 'Relationship', 'select', ['Son', 'Daughter', 'Spouse']), field('relative', 'Parent’s or spouse’s full name'), field('address', 'Residential address', 'textarea')]],
        ['Interests', [field('nil', 'Disclosure status', 'select', ['Interests to disclose', 'Nil disclosure'])]], ['Signing', [designation, place, date]]],
      body(d) {
        const rowData = d.nil === 'Nil disclosure' ? [['1', 'NIL', '—', '—', '—']] : rowsFor(d, 'interests').map((row, i) => [String(i + 1), ...interestKeys.map((k, index) => k === 'since' ? formatDate(row[k]) : value(row, k, interestColumns[index]))]);
        return [p('To\nThe Board of Directors\n' + value(d, 'company', 'Company name')), p('Dear Sir(s),'),
          p('I, ' + value(d, 'name', 'Director’s name') + ', ' + value(d, 'relation', 'Son/daughter/spouse').toLowerCase() + ' of ' + value(d, 'relative', 'Name') + ', resident of ' + value(d, 'address', 'Address') + ', being a director in the company hereby give notice of my interest or concern in the following company or companies, bodies corporate, firms or other association of individuals:–'),
          table(['Sl. No.', 'Names of the Companies/bodies corporate/firms/association of individuals', 'Nature of interest or concern / Change in interest or concern', 'Shareholding', 'Date on which interest or concern arose / changed'], rowData, [6, 26, 29, 18, 21]),
          p('Signature: __________________________'), p(value(d, 'designation', 'MD/Director/Secretary/Whole time Director')), p('Place: ' + value(d, 'place', 'Place')), p('Date: ' + formatDate(d.date))];
      }
    },
    {
      id: 'mgt-11', code: 'MGT-11', title: 'Proxy form', kind: 'Prescribed format', documentCode: 'Form No. MGT-11', documentBasis: '[Pursuant to section 105(6) of the Companies Act, 2013 and rule 19(3) of the Companies (Management and Administration) Rules, 2014]', verification: 'The member particulars, proxy alternatives, grant of authority, stamp space, signatures and deposit note follow the published MGT-11. Meeting and signature dates use the entered values.',
      section: 105, basis: 'Section 105(6) · Management and Administration Rules, rule 19(3)',
      description: 'Prepare a member’s proxy appointment for voting on a poll at a general meeting.',
      source: sources.proxy, references: [['Notified MGT-11 · G.S.R. 260(E), 31 March 2014, pp. 107–108', sources.proxy]],
      note: 'For a general meeting at which appointment of proxies is available. Check the meeting notice and the applicable proxy, stamping and deposit requirements.',
      groups: [['Company and member', [company, cin, office, field('member', 'Member name(s)'), field('address', 'Member’s registered address', 'textarea'), field('email', 'Member’s email address', 'email'), field('folio', 'Folio number or client ID'), field('dp', 'DP ID (where applicable)'), field('shares', 'Number of shares held')]],
        ['Proxy holders', []], ['Meeting and resolutions', [field('meetingType', 'Meeting type', 'select', ['Annual general meeting', 'Extraordinary general meeting']), meetingNo, meetingDate, meetingTime, venue, field('resolutions', 'Resolutions, in notice order (one per line)', 'textarea'), date]]],
      body(d) {
        const proxies = rowsFor(d, 'proxies');
        const persons = Array.from({ length: 3 }, (_, i) => {
          const row = proxies[i] || {};
          return p((i + 1) + '. Name: ' + value(row, 'name', 'Proxy’s name') + '\nAddress: ' + value(row, 'address', 'Proxy’s address') + '\nEmail: ' + value(row, 'email', 'Proxy’s email') + '\nSignature: ______________________' + (i < 2 ? '   or failing him' : ''));
        });
        return [p('CIN: ' + value(d, 'cin', 'CIN') + '\nName of the company: ' + value(d, 'company', 'Company name') + '\nRegistered office: ' + value(d, 'office', 'Registered office')),
          p('Name of the member(s): ' + value(d, 'member', 'Member name(s)') + '\nRegistered address: ' + value(d, 'address', 'Member address') + '\nEmail: ' + value(d, 'email', 'Email address') + '\nFolio / client ID: ' + value(d, 'folio', 'Folio or client ID') + '\nDP ID: ' + value(d, 'dp', 'DP ID or N/A')),
          p('I/We, being the member(s) of ' + value(d, 'shares', 'Shares held') + ' shares of the above named company, hereby appoint'), ...persons,
          p('as my/our proxy to attend and vote (on a poll) for me/us and on my/our behalf at the ' + value(d, 'meetingNo', 'Serial number') + ' ' + value(d, 'meetingType', 'General meeting').toLowerCase() + ' of the company, to be held on ' + formatDate(d.meetingDate, true) + ' at ' + value(d, 'meetingTime', 'Time') + ' at ' + value(d, 'venue', 'Venue') + ' and at any adjournment thereof in respect of such resolutions as are indicated below:'),
          head('Resolution No.'), ...numbered(d.resolutions, 'Resolution as numbered in the meeting notice'), p('Signed this ' + signingDate(d.date)),
          { type: 'stamp', text: 'Affix revenue stamp' }, p('Signature of shareholder: __________________________'), p('Signature of Proxy holder(s): ________________________'),
          p('Note: This form of proxy in order to be effective should be duly completed and deposited at the Registered Office of the Company, not less than 48 hours before the commencement of the Meeting.')];
      }
    },
    {
      id: 'moa-table-a', code: 'Schedule I · Table A', title: 'Memorandum of association of a company limited by shares', kind: 'Statutory text',
      documentCode: 'Schedule I · Table A', section: 4, basis: 'Section 4(6) · Companies Act, 2013, Schedule I, Table A',
      documentBasis: '(See sections 4 and 5)', description: 'Populate the statutory memorandum clauses, subscription table and OPC nominee particulars.',
      source: sources.schedule, references: [['India Code · Schedule I, Table A', sources.schedule]],
      verification: 'The clause wording and subscription-table headings are transcribed from Schedule I, Table A, pages 252–253 of the supplied Act (1 April 2021 edition), and checked against India Code. The selected subscriber route determines which subscription and nomination clauses appear.',
      note: 'For a company limited by shares with one class of shares. Select the subscriber route and prepare the memorandum for review. Complete the applicable incorporation webform on MCA.',
      groups: [['Company', [field('company', 'Full approved company name, including its suffix'), field('state', 'State or union territory of the registered office')]],
        ['Objects and capital', [field('objects', 'Objects to be pursued on incorporation', 'textarea'), field('furtherance', 'Matters necessary for furtherance of the objects', 'textarea'), field('capital', 'Share capital in rupees'), field('shareCount', 'Number of shares'), field('faceValue', 'Face value of each share in rupees')]],
        ['Subscription', [field('subscriberMode', 'Subscriber route', 'select', ['Two or more subscribers', 'One person company'])]],
        ['Execution', [date]]],
      body(d) {
        const out = [p('1st   The name of the company is “' + value(d, 'company', 'Approved name, including suffix') + '”.'),
          p('2nd   The registered office of the company will be situated in the State of ' + value(d, 'state', 'State') + '.'),
          p('3rd   (a) The objects to be pursued by the company on its incorporation are:—\n' + value(d, 'objects', 'Objects')),
          p('(b) Matters which are necessary for furtherance of the objects specified in clause 3(a) are:—\n' + value(d, 'furtherance', 'Matters in furtherance')),
          p('4th   The liability of the member(s) is limited and this liability is limited to the amount unpaid, if any, on the shares held by them.'),
          p('5th   The share capital of the company is ' + value(d, 'capital', 'Share capital') + ' rupees, divided into ' + value(d, 'shareCount', 'Number of shares') + ' shares of ' + value(d, 'faceValue', 'Face value') + ' rupees each.')];
        const witness = person => 'Signed before me:\nSignature __________________\n' + value(person, 'witness', 'Witness’s particulars');
        if (d.subscriberMode !== 'One person company') {
          const people = rowsFor(d, 'subscribers');
          const shares = people.map(person => String(person.shareAmount || '').replace(/,/g, '').trim());
          const complete = shares.every(amount => /^\d{1,40}$/.test(amount));
          const total = complete ? shares.reduce((sum, share) => sum + BigInt(share), 0n).toString() : '[Total shares taken]';
          const rows = people.map(person => [value(person, 'person', 'Subscriber’s particulars'), value(person, 'shareAmount', 'Shares taken'), '__________________', witness(person)]);
          rows.push(['Total shares taken:', total, '', '']);
          out.push(p('6th   We, the several persons, whose names and addresses are subscribed, are desirous of being formed into a company in pursuance of this memorandum of association, and we respectively agree to take the number of shares in the capital of the company set against our respective names:—'),
            table(['Names, addresses, descriptions and occupations of subscribers', 'No. of Shares taken by each subscriber', 'Signature of subscriber', 'Signature, names, addresses, descriptions and occupations of witnesses'], rows, [31, 17, 18, 34]));
        }
        if (d.subscriberMode !== 'Two or more subscribers') {
          out.push(p('7th   I, whose name and address is given below, am desirous of forming a company in pursuance of this memorandum of association and agree to take all the shares in the capital of the company (Applicable in case of one person company):—'),
            table(['Name, address, description and occupation of subscriber', 'Signature of subscriber', 'Signature, name, address, description and occupation of witness'], [[value(d, 'person', 'Subscriber’s particulars'), '__________________', witness(d)]], [38, 24, 38]),
            p('8th   ' + value(d, 'nominee', 'Shri/Smt and name of nominee') + ', ' + value(d, 'kinship', 'son/daughter') + ' of ' + value(d, 'nomineeParent', 'Parent’s name') + ', resident of ' + value(d, 'nomineeAddress', 'Nominee’s address') + ' aged ' + value(d, 'age', 'Age') + ' years shall be the nominee in the event of death of the sole member (Applicable in case of one person company)'));
        }
        out.push(p('Dated ' + signingDate(d.date)));
        return out;
      }
    },
    {
      id: 'board-notice', code: 'Board notice', title: 'Notice of a board meeting', kind: 'Practice draft',
      section: 173, basis: 'Section 173(3) · Secretarial Standard–1, paragraphs 1.2 and 1.3',
      description: 'Prepare a board notice with the agenda, venue, electronic participation and contact details.',
      source: sources.standard, references: [['ICSI SS-1 · Revised edition effective 1 April 2024', sources.standard]],
      note: 'Prepared for an ordinary notice period. Review the company’s articles, dispatch timing and agenda papers before circulation.',
      groups: [['Company and meeting', [company, cin, office, field('noticeDate', 'Notice date', 'date'), meetingNo, meetingDate, meetingTime, venue]],
        ['Attendance and agenda', [field('electronic', 'Electronic participation and joining instructions', 'textarea'), field('contact', 'Name, phone or email for attendance confirmation'), field('agenda', 'Agenda items (one per line)', 'textarea'), field('enclosures', 'Agenda papers and enclosures (one per line)', 'textarea')]], ['Issued by', [signer, designation]]],
      body(d) {
        return [head(value(d, 'company', 'Company name')), p('CIN: ' + value(d, 'cin', 'CIN') + '\nRegistered office: ' + value(d, 'office', 'Registered office')),
          p('Date: ' + formatDate(d.noticeDate) + '\nTo each member of the Board of Directors'),
          p('Notice is given that board meeting ' + value(d, 'meetingNo', 'Meeting serial number') + ' will take place on ' + formatDate(d.meetingDate, true) + ' at ' + value(d, 'meetingTime', 'Time and zone') + ', at ' + value(d, 'venue', 'Venue') + '.'),
          head('Participation'), p('Electronic participation: ' + value(d, 'electronic', 'Joining instructions') + '\nPlease confirm your attendance and mode of participation with ' + value(d, 'contact', 'Contact details') + '.'),
          head('Agenda'), ...numbered(d.agenda, 'Agenda item'), head('Enclosures'), ...numbered(d.enclosures, 'Agenda papers or enclosures'), p('For ' + value(d, 'company', 'Company name')), p('Signature: __________________________\n' + value(d, 'signer', 'Signatory’s name') + '\n' + value(d, 'designation', 'Designation'))];
      }
    },
    {
      id: 'resolution-extract', code: 'Board extract', title: 'Certified board resolution extract', kind: 'Practice draft',
      section: 118, basis: 'Section 118 · Secretarial Standard–1, paragraph 7.7.2',
      description: 'Prepare a certified extract using the exact resolution entered in the minutes book.',
      source: sources.standard, references: [['ICSI SS-1 · Revised edition effective 1 April 2024, paragraph 7.7.2', sources.standard]],
      note: 'Use this extract after the minutes have been entered in the minutes book. Transcribe the approved resolution exactly.',
      groups: [['Company and meeting', [company, cin, office, meetingNo, meetingDate, meetingTime, venue]],
        ['Minutes entry', [field('item', 'Agenda item or resolution number'), field('subject', 'Subject'), field('resolution', 'Exact text of the resolution recorded in the minutes', 'textarea')]],
        ['Certification', [signer, designation, field('identifier', 'DIN or membership number, if applicable'), place, date]]],
      body(d) {
        return [head(value(d, 'company', 'Company name')), p('CIN: ' + value(d, 'cin', 'CIN') + '\nRegistered office: ' + value(d, 'office', 'Registered office')),
          p('Extract from the minutes of board meeting ' + value(d, 'meetingNo', 'Meeting serial number') + ', held on ' + formatDate(d.meetingDate, true) + ' at ' + value(d, 'meetingTime', 'Time and zone') + ' at ' + value(d, 'venue', 'Venue') + '.'),
          head('Item ' + value(d, 'item', 'Item number') + ' · ' + value(d, 'subject', 'Subject')), p(value(d, 'resolution', 'Exact approved resolution')),
          p('Certified as a true extract from the minutes book of ' + value(d, 'company', 'Company name') + '.'), ...signature(d, true),
          ...(d.identifier ? [p('DIN / membership number: ' + d.identifier)] : [])];
      }
    }
  ];

  function rowsFor(data, key) {
    if (Array.isArray(data[key]) && data[key].length) return data[key];
    return key === 'subscribers' ? [{}, {}] : [{}];
  }
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function blocks(doc) {
    return doc.parts.map(block => {
      if (block.type === 'table') return '<table><colgroup>' + block.widths.map(w => '<col style="width:' + w + '%">').join('') + '</colgroup><thead><tr>' + block.headings.map(h => '<th>' + escape(h) + '</th>').join('') + '</tr></thead><tbody>' + block.rows.map(row => '<tr>' + row.map(c => '<td>' + escape(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      const tag = block.type === 'heading' ? 'h4' : 'p';
      return '<' + tag + (block.type === 'stamp' ? ' class="df-stamp"' : '') + '>' + escape(block.text) + '</' + tag + '>';
    }).join('');
  }
  function documentHTML(doc) {
    return (doc.code ? '<div class="df-doc-code">' + escape(doc.code) + '</div>' : '') + '<h3>' + escape(doc.title) + '</h3><p class="df-citation">' + escape(doc.basis) + '</p>' + blocks(doc);
  }
  function documentModel(template, data) {
    return { title: template.title, code: template.documentCode || '', basis: template.documentBasis || template.basis, parts: template.body(data) };
  }
  // Office Open XML packages use ZIP. Store the small XML parts uncompressed to work offline.
  function packageXML(files) {
    const encoder = new TextEncoder();
    const parts = [];
    const directory = [];
    let offset = 0;
    const header = bytes => {
      const data = new Uint8Array(bytes);
      const view = new DataView(data.buffer);
      return { data, short: (i, v) => view.setUint16(i, v, true), long: (i, v) => view.setUint32(i, v, true) };
    };
    for (const [name, content] of Object.entries(files)) {
      const fileName = encoder.encode(name);
      const bytes = encoder.encode(content);
      let checksum = -1;
      for (const byte of bytes) {
        checksum ^= byte;
        for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
      }
      checksum = (checksum ^ -1) >>> 0;
      const local = header(30);
      local.long(0, 0x04034b50);
      local.short(4, 20);
      local.short(12, 33); // DOS date, 1 January 1980.
      local.long(14, checksum);
      local.long(18, bytes.length);
      local.long(22, bytes.length);
      local.short(26, fileName.length);
      parts.push(local.data, fileName, bytes);
      const entry = header(46);
      entry.long(0, 0x02014b50);
      entry.short(4, 20);
      entry.short(6, 20);
      entry.short(14, 33);
      entry.long(16, checksum);
      entry.long(20, bytes.length);
      entry.long(24, bytes.length);
      entry.short(28, fileName.length);
      entry.long(42, offset);
      directory.push(entry.data, fileName);
      offset += local.data.length + fileName.length + bytes.length;
    }
    const end = header(22);
    const total = Object.keys(files).length;
    end.long(0, 0x06054b50);
    end.short(8, total);
    end.short(10, total);
    end.long(12, directory.reduce((sum, part) => sum + part.length, 0));
    end.long(16, offset);
    return new Blob([...parts, ...directory, end.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function wordFile(doc) {
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const office = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const pkg = 'http://schemas.openxmlformats.org/package/2006';
    const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const safe = v => escape(String(v).replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, ''));
    const para = (str, type = 'body') => {
      const styles = {
        body: ['', '22'], heading: ['<w:b/>', '24'], title: ['<w:b/>', '33'], code: ['<w:b/>', '22'], citation: ['<w:i/>', '20'], stamp: ['<w:i/>', '20']
      };
      const [attr, size] = styles[type];
      const text = String(str).split(/\r\n|\r|\n/).map(s => '<w:t xml:space="preserve">' + safe(s) + '</w:t>').join('<w:br/>');
      const align = ['title', 'code', 'citation'].includes(type) ? '<w:jc w:val="center"/>' : '';
      const keep = ['heading', 'title', 'code', 'citation'].includes(type) ? '<w:keepNext/>' : '';
      return '<w:p><w:pPr>' + keep + '<w:spacing w:before="0" w:after="100" w:line="270" w:lineRule="auto"/>' + align + '</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/>' + attr + '<w:sz w:val="' + size + '"/></w:rPr>' + text + '</w:r></w:p>';
    };
    const drawTable = (headings, rows, widths, stamp = false) => {
      const grid = widths.map(x => Math.round(9350 * x / 100));
      const borders = ['top','left','bottom','right','insideH','insideV'].map(edge => '<w:' + edge + ' w:val="single" w:sz="4" w:color="888888"/>').join('');
      const rowXML = (row, isHead) => '<w:tr>' + (isHead ? '<w:trPr><w:tblHeader/></w:trPr>' : '') + row.map((c, i) => '<w:tc><w:tcPr><w:tcW w:w="' + grid[i] + '" w:type="dxa"/>' + (isHead ? '<w:shd w:fill="F0EFEB"/>' : '') + '</w:tcPr>' + para(c, isHead ? 'heading' : 'body') + '</w:tc>').join('') + '</w:tr>';
      return '<w:tbl><w:tblPr><w:tblW w:w="' + (stamp ? grid[0] : 9350) + '" w:type="dxa"/><w:tblBorders>' + borders + '</w:tblBorders></w:tblPr><w:tblGrid>' + grid.map(x => '<w:gridCol w:w="' + x + '"/>').join('') + '</w:tblGrid>' + (headings.length ? rowXML(headings, true) : '') + rows.map(row => rowXML(row, false)).join('') + '</w:tbl>';
    };
    const parts = doc.parts.map(b => b.type === 'table' ? drawTable(b.headings, b.rows, b.widths) : b.type === 'stamp' ? drawTable([], [['\n' + b.text + '\n']], [23], true) : para(b.text, b.type === 'heading' ? 'heading' : 'body')).join('');
    const body = (doc.code ? para(doc.code, 'code') : '') + para(doc.title, 'title') + para(doc.basis, 'citation') + parts;
    return packageXML({
      '[Content_Types].xml': xml + '<Types xmlns="' + pkg + '/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': xml + '<Relationships xmlns="' + pkg + '/relationships"><Relationship Id="rId1" Type="' + office + '/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': xml + '<w:document xmlns:w="' + w + '"><w:body>' + body + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1200" w:right="1278" w:bottom="1200" w:left="1278" w:header="500" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>'
    });
  }
  function download(template, data) {
    const doc = wordFile(documentModel(template, data));
    const url = URL.createObjectURL(doc);
    const a = document.createElement('a');
    const suffix = (data.company || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 64);
    a.download = template.id + (suffix ? '-' + suffix : '') + '.docx';
    a.href = url;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  const pageStyle = `
    .df-page{color:#292523;background:white;font-family:var(--serif,Georgia,serif);font-size:1rem;line-height:1.54;overflow-wrap:anywhere}
    .df-page h3{font-family:inherit;text-align:center;margin:.3rem 0 .55rem;font-weight:600;font-size:1.55rem;line-height:1.16}
    .df-doc-code{text-align:center;font-family:var(--sans,Arial,sans-serif);font-size:.8rem;text-transform:uppercase;letter-spacing:.09em;font-weight:650;color:#653545}
    .df-page .df-citation{text-align:center;font-style:italic;font-size:.92rem;line-height:1.42;margin:0 0 1.3rem;color:#595455}
    .df-page h4{font:600 1.07rem/1.35 var(--serif,Georgia,serif);margin:1.25rem 0 .35rem}
    .df-page p{font-family:inherit;color:inherit;font-size:inherit;line-height:inherit;margin:.65rem 0;white-space:pre-line}
    .df-page table{border-collapse:collapse;width:100%;table-layout:fixed;font-family:inherit;font-size:.88rem;margin:1rem 0}
    .df-page th,.df-page td{text-align:left;border:1px solid #c1bcb8;padding:.35rem;vertical-align:top;white-space:pre-line}
    .df-page th{font-weight:600;background:#f5f3f0}.df-page .df-stamp{border:1px solid #888;width:8rem;text-align:center;padding:1.3rem .5rem;font-size:.9rem}
  `;
  function printDoc(model) {
    document.getElementById('desk-form-print')?.remove();
    const frame = document.createElement('iframe');
    frame.id = 'desk-form-print';
    frame.title = 'Printable document';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:780px;height:1000px;border:0';
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        const page = window.open('', '_blank');
        if (page) { page.document.write(frame.srcdoc); page.document.close(); page.focus(); page.print(); }
      }
    };
    frame.srcdoc = '<!doctype html><html lang="en"><meta charset="utf-8"><title>' + escape(model.title) + '</title><style>@page{size:A4;margin:19mm}body{margin:0}.df-page{font-size:11pt!important}.df-page h3{font-size:17pt}.df-page p,.df-page tr{orphans:2;widows:2}.df-page tr{break-inside:avoid}.df-page h4{break-after:avoid}.df-page thead{display:table-header-group}' + pageStyle + '</style><body><article class="df-page">' + documentHTML(model) + '</article></html>';
    document.body.append(frame);
  }
  function installStyles() {
    if (document.getElementById('desk-forms-css')) return;
    const style = document.createElement('style');
    style.id = 'desk-forms-css';
    style.textContent = pageStyle + `
      .df{--df-rule:#dedbd3;--df-ink:#302d2b;--df-accent:#642b3c;color:var(--df-ink);min-width:0}
      .df-head{margin:0 0 1rem}.df-tag{font:600 .8rem/1.4 var(--sans,Arial,sans-serif);color:var(--df-accent);letter-spacing:.04em}
      .df h2{font:500 clamp(1.8rem,3vw,2.8rem)/1.12 var(--serif,Georgia,serif);margin:.4rem 0 .6rem;color:var(--df-ink)}
      .df-subtitle{margin:.45rem 0;font:400 1rem/1.6 var(--sans,Arial,sans-serif);color:#615951;max-width:74ch}
      .df-actions{display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin:.85rem 0}.df button,.df-list a{font:600 .9rem/1.4 var(--sans,Arial,sans-serif)}
      .df-btn,.df-small{appearance:none;color:var(--df-ink);background:white;border:1px solid #cfc9c1;border-radius:5px;padding:.5rem .9rem;cursor:pointer}
      .df button:hover{background:#f1eeea}.df .df-primary{background:var(--df-accent);color:#fff;border-color:var(--df-accent)}.df .df-primary:hover{background:#512031}
      .df-grid{display:grid;grid-template-columns:minmax(0,.95fr) minmax(0,1.05fr);gap:1.2rem;align-items:start}
      .df-editor,.df-preview{min-width:0}.df-editor{border:1px solid var(--df-rule);border-radius:7px;background:white;overflow:hidden}
      .df-editor fieldset{border:0;padding:1rem 1.1rem 1.1rem;margin:0;min-width:0}.df-editor fieldset+fieldset{border-top:1px solid var(--df-rule)}
      .df-group-title,.df-preview-title{font:600 1.12rem/1.4 var(--serif,Georgia,serif);color:#302d2b;margin:0 0 .65rem}
      .df-field{display:block;min-width:0;margin:0 0 .65rem;font:500 .9rem/1.4 var(--sans,Arial,sans-serif);color:#423c39}.df-field span{display:block;margin-bottom:.25rem}
      .df-field input,.df-field select,.df-field textarea{display:block;box-sizing:border-box;width:100%;font:400 1rem/1.45 var(--sans,Arial,sans-serif);background:#fff;color:#302d2b;border:1px solid #c8c4be;border-radius:4px;padding:.42rem .55rem;min-height:2.5rem}
      .df-field textarea{resize:vertical;min-height:4.65rem}.df-field select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath fill='none' stroke='%23615b57' stroke-width='1.5' d='m1 1 5 5 5-5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right .75rem center;padding-right:2.1rem}
      .df :focus-visible{outline:2px solid var(--df-accent);outline-offset:2px}.df-repeat-row{padding:.7rem .75rem .25rem;border:1px solid var(--df-rule);background:#faf9f6;border-radius:5px;margin:.5rem 0}
      .df-row-head{display:flex;align-items:center;justify-content:space-between;gap:.4rem;margin-bottom:.65rem;font:600 .86rem/1.4 var(--sans,Arial,sans-serif)}
      .df .df-source{font:600 .9rem/1.4 var(--sans,Arial,sans-serif);color:var(--df-accent);padding:.3rem}.df .df-text-button{border:0;background:transparent;color:#642b3c;text-decoration:underline;padding:.3rem;font-weight:500}
      .df-preview{border:1px solid var(--df-rule);background:#eeece7;padding:.7rem;border-radius:7px}.df-preview-title{font:600 .85rem/1.45 var(--sans,Arial,sans-serif);margin:.15rem .15rem .65rem;color:#5d5550}
      .df-preview .df-page{padding:clamp(1rem,3vw,2.2rem);border:1px solid #d8d4cb;box-shadow:0 2px 5px #25221d0a}
      .df-references{border-block:1px solid var(--df-rule);padding:.65rem 0;margin:.95rem 0;font:400 .9rem/1.5 var(--sans,Arial,sans-serif)}
      .df-references summary{cursor:pointer;font-weight:600}.df-references p{margin:.4rem 0}.df a{color:var(--df-accent)}.df-references ul{margin:.5rem 0;padding-left:1.2rem}
      .df-list{display:grid;gap:.75rem}.df-list a{display:block;color:inherit;border:1px solid var(--df-rule);border-radius:6px;padding:1rem;text-decoration:none;background:white}
      .df-list a:hover{border-color:var(--df-accent)}.df-list strong,.df-list span{display:block}.df-list strong{font:500 1.3rem/1.4 var(--serif,Georgia,serif);margin:.25rem 0}.df-list span:last-child{font-weight:400;color:#58524f}
      .df-feedback{font-size:.88rem;min-height:1.3rem;margin:.1rem 0;color:#642b3c}
      @media(max-width:1090px){.df-grid{grid-template-columns:1fr}.df-preview .df-page{padding:clamp(1rem,5vw,3rem)}}
      @media(max-width:520px){.df-editor fieldset{padding:.8rem}.df-preview{padding:.35rem}.df-preview .df-page{padding:.8rem}.df-page table{font-size:.8rem}}
    `;
    document.head.append(style);
  }
  const drafts = new Map();
  function formField(f, data, collection = '', index = 0) {
    const v = data[f.key] || '';
    const attrs = ' data-key="' + f.key + '"' + (collection ? ' data-collection="' + collection + '" data-row="' + index + '"' : '');
    let input;
    if (f.type === 'select') {
      input = '<select' + attrs + '><option value="">Choose an option</option>' + f.options.map(opt => '<option' + (opt === v ? ' selected' : '') + '>' + escape(opt) + '</option>').join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea rows="2"' + attrs + '>' + escape(v) + '</textarea>';
    } else {
      input = '<input type="' + f.type + '"' + attrs + ' value="' + escape(v) + '">';
    }
    return '<label class="df-field"><span>' + escape(f.label) + '</span>' + input + '</label>';
  }
  const repeatSchemas = {
    subscribers: { name: 'Subscriber', limit: Infinity, fields: [field('person', 'Subscriber’s name, address, description and occupation', 'textarea'), field('shareAmount', 'Number of shares taken'), field('witness', 'Witness’s name, address, description and occupation', 'textarea')] },
    interests: { name: 'Interest', limit: Infinity, fields: interestColumns.map((label, i) => field(interestKeys[i], label, i === 3 ? 'date' : 'text')) },
    proxies: { name: 'Proxy', limit: 3, fields: [field('name', 'Proxy’s name'), field('address', 'Proxy’s address', 'textarea'), field('email', 'Proxy’s email address', 'email')] }
  };
  function rowEditor(d, collection) {
    if (collection === 'interests' && d.nil === 'Nil disclosure') return '';
    if (collection === 'subscribers') {
      if (!d.subscriberMode) return '';
      if (d.subscriberMode === 'One person company') {
        const details = [field('person', 'Sole subscriber’s name, address, description and occupation', 'textarea'), field('witness', 'Witness’s name, address, description and occupation', 'textarea'),
          field('nominee', 'Nominee’s full name, including title'), field('kinship', 'Nominee’s relationship to parent', 'select', ['son', 'daughter']), field('nomineeParent', 'Parent’s full name'), field('nomineeAddress', 'Nominee’s residential address', 'textarea'), field('age', 'Nominee’s age in years')];
        return details.map(f => formField(f, d)).join('');
      }
    }
    const items = rowsFor(d, collection);
    const schema = repeatSchemas[collection];
    const minimum = collection === 'subscribers' ? 2 : 1;
    return items.map((row, i) => '<div class="df-repeat-row"><div class="df-row-head"><strong>' + schema.name + ' ' + (i + 1) + '</strong>' + (items.length > minimum ? '<button type="button" class="df-text-button" data-remove="' + collection + '" data-index="' + i + '" aria-label="Remove ' + schema.name + ' ' + (i + 1) + '">Remove</button>' : '') + '</div>' + schema.fields.map(f => formField(f, row, collection, i)).join('') + '</div>').join('') + (items.length < schema.limit ? '<button type="button" class="df-small" data-add="' + collection + '">Add ' + (collection === 'proxies' ? 'alternate proxy' : 'another ' + schema.name.toLowerCase()) + '</button>' : '');
  }
  function render(host, templateId) {
    if (!host) return;
    installStyles();
    const template = templates.find(t => t.id === templateId);
    const root = document.createElement('section');
    root.className = 'df';
    host.replaceChildren(root);
    if (!template) {
      root.innerHTML = '<div class="df-head"><h2>Document studio</h2><p class="df-subtitle">Choose a document to fill in, review and export.</p></div><div class="df-list">' + templates.map(t => '<a href="#documents/' + t.id + '"><span class="df-tag">' + escape(t.code) + ' · ' + escape(t.kind) + '</span><strong>' + escape(t.title) + '</strong><span>' + escape(t.description) + '</span></a>').join('') + '</div>';
      return;
    }
    const d = drafts.get(template.id) || {};
    drafts.set(template.id, d);
    const groupEditor = () => template.groups.map(([name, fields], i) => {
      const repeat = { Interests: 'interests', 'Proxy holders': 'proxies', Subscription: 'subscribers' }[name];
      return '<fieldset aria-labelledby="df-group-' + i + '"><h3 class="df-group-title" id="df-group-' + i + '">' + escape(name) + '</h3>' + fields.map(f => formField(f, d)).join('') + (repeat ? '<div data-repeater="' + repeat + '">' + rowEditor(d, repeat) + '</div>' : '') + '</fieldset>';
    }).join('');
    const annotated = template.verification || 'Practice draft for adaptation to the company’s records and circumstances.';
    root.innerHTML = '<div class="df-head"><span class="df-tag">' + escape(template.kind) + (template.documentCode ? ' · ' + escape(template.code) : '') + '</span><h2>' + escape(template.title) + '</h2><p class="df-subtitle">' + escape(template.note) + '</p></div>' +
      '<div class="df-actions"><button type="button" class="df-btn df-primary" data-action="docx">Download Word</button><button type="button" class="df-btn" data-action="print">Print / save PDF</button>' + (template.documentCode ? '<a class="df-source" target="_blank" rel="noopener noreferrer" href="' + escape(template.source) + '">' + (template.id === 'moa-table-a' ? 'Open Schedule I' : 'Open notified form') + '</a>' : '') + '<button type="button" class="df-text-button" data-action="clear">Clear fields</button></div>' +
      '<details class="df-references"><summary>Sources and use</summary><p>' + escape(annotated) + ' Entries stay in this tab until you reload or clear the fields. Square brackets mark details to complete.</p><ul><li><a href="#reader/act-' + template.section + '">Read section ' + template.section + ' in the Acts reader</a></li>' + template.references.map(([label, link]) => '<li><a href="' + escape(link) + '" target="_blank" rel="noopener noreferrer">' + escape(label) + '</a></li>').join('') + '</ul></details>' +
      '<div class="df-grid"><div class="df-editor" role="group" aria-label="Document fields">' + groupEditor() + '</div><section class="df-preview" aria-label="Document preview"><h3 class="df-preview-title">Document preview</h3><article class="df-page"></article></section></div>' +
      '<p class="df-feedback" role="status" aria-live="polite"></p>';
    const preview = root.querySelector('.df-page');
    const status = root.querySelector('.df-feedback');
    const repaint = () => { preview.innerHTML = documentHTML(documentModel(template, d)); };
    const repeatUpdate = collection => {
      const panel = root.querySelector('[data-repeater="' + collection + '"]');
      panel.innerHTML = rowEditor(d, collection);
      return panel;
    };
    repaint();
    root.addEventListener('input', e => {
      const f = e.target;
      if (!f.dataset.key) return;
      const { key, collection, row } = f.dataset;
      if (collection) {
        if (!d[collection]) d[collection] = rowsFor(d, collection);
        d[collection][Number(row)][key] = f.value;
      } else {
        d[key] = f.value;
        if (key === 'nil') repeatUpdate('interests');
        if (key === 'subscriberMode') repeatUpdate('subscribers');
      }
      if (status.textContent) status.textContent = '';
      repaint();
    });
    root.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      const { add, remove, action } = button.dataset;
      const collection = add || remove;
      if (collection && repeatSchemas[collection]) {
        const rows = rowsFor(d, collection);
        if (add && rows.length < repeatSchemas[collection].limit) rows.push({});
        if (remove && rows.length > (collection === 'subscribers' ? 2 : 1)) rows.splice(Number(button.dataset.index), 1);
        d[collection] = rows;
        const panel = repeatUpdate(collection);
        const index = add ? rows.length - 1 : Math.min(Number(button.dataset.index), rows.length - 1);
        panel.querySelector('[data-row="' + index + '"]')?.focus();
        repaint();
      } else if (action === 'docx') {
        download(template, d);
        status.textContent = 'Word document prepared.';
      } else if (action === 'print') {
        printDoc(documentModel(template, d));
      } else if (action === 'clear') {
        if (Object.keys(d).length && window.confirm('Clear all entries in this document?')) {
          drafts.delete(template.id);
          render(host, template.id);
          host.querySelector('.df-feedback').textContent = 'Fields cleared.';
          host.querySelector('.df-field input')?.focus();
        }
      }
    });
  }
  window.DeskForms = { templates, render };
})();
