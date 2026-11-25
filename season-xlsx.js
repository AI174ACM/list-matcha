/* Выгрузка «Сезона» в XLSX. Содержимое книги формируется локально.
   Строки 1–3 — название, источник и шапка. Первая строка данных — 4. */
globalThis.seasonXlsxBlob = (() => {
  const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const spreadsheet = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const relationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRels = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const encode = new TextEncoder();
  const crcTable = Uint32Array.from({length:256}, (_,byte) => {
    let crc = byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    return crc >>> 0;
  });

  // ZIP, метод Store. Имена частей ASCII, XML в UTF-8. Даты файлов — 1 января 1980.
  function archive(parts) {
    const local = [], central = [];
    let offset = 0, centralSize = 0;
    for (const [name, xml] of parts) {
      const filename = encode.encode(name);
      const data = encode.encode(xmlHeader + xml);
      let crc = 0xFFFFFFFF;
      for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
      crc = (crc ^ 0xFFFFFFFF) >>> 0;
      const header = new DataView(new ArrayBuffer(30));
      header.setUint32(0, 0x04034B50, true);
      header.setUint16(4, 20, true);
      header.setUint16(12, 33, true);
      header.setUint32(14, crc, true);
      header.setUint32(18, data.length, true);
      header.setUint32(22, data.length, true);
      header.setUint16(26, filename.length, true);
      local.push(header.buffer, filename, data);
      const entry = new DataView(new ArrayBuffer(46));
      entry.setUint32(0, 0x02014B50, true);
      entry.setUint16(4, 20, true);
      new Uint8Array(entry.buffer, 6, 26).set(new Uint8Array(header.buffer, 4));
      entry.setUint32(42, offset, true);
      central.push(entry.buffer, filename);
      offset += 30 + filename.length + data.length;
      centralSize += 46 + filename.length;
    }
    if (parts.length > 65535 || offset + centralSize > 0xFFFFFFFF)
      throw new RangeError('Книга слишком велика для формата ZIP32.');
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054B50, true);
    end.setUint16(8, parts.length, true);
    end.setUint16(10, parts.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...local, ...central, end.buffer], {type:mime});
  }
  const escape = value => String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'\uFFFD').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  // Excel интерпретирует _xHHHH_ как код символа даже внутри inlineStr.
  const literal = value => escape(String(value).replace(/_x[0-9a-f]{4}_/gi, m=>'_x005F_'+m.slice(1))
    .replace(/[\u0000-\u0008\u000B-\u000D\u000E-\u001F\uFFFE\uFFFF]/g,
      c=>'_x'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')+'_'));
  function columnName(index) {
    let name = '';
    for (let i=index+1; i; i=Math.floor((i-1)/26)) name=String.fromCharCode(65+(i-1)%26)+name;
    return name;
  }
  const formats = {date:4, duration:5, percent:6, decimal:7};
  function cell(ref, style, value) {
    if (value == null) return '';
    const tag = '<c r="'+ref+'" s="'+style+'"';
    if (typeof value === 'string') {
      if (value.length > 32767) throw new RangeError('Слишком длинный текст в '+ref);
      return tag+' t="inlineStr"><is><t xml:space="preserve">'+literal(value)+'</t></is></c>';
    }
    if (Number.isFinite(value)) return tag+'><v>'+value+'</v></c>';
    if (typeof value === 'object' && typeof value.formula === 'string' && Number.isFinite(value.value))
      return tag+'><f>'+escape(value.formula)+'</f><v>'+value.value+'</v></c>';
    throw new TypeError('Неизвестное значение ячейки '+ref);
  }
  function worksheet(sheet) {
    const {columns,rows}=sheet;
    if (!columns.length || columns.length > 16384 || rows.length > 1048573)
      throw new RangeError('Размер листа превышает возможности Excel.');
    const letters=columns.map((_,i)=>columnName(i)), lastCol=letters[letters.length-1];
    const lastRow=rows.length+3;
    const cols=columns.map(({width},i)=>{
      const size=Number.isFinite(width)?Math.max(1,Math.min(width,255)):18;
      return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+size+'" customWidth="1"/>';
    }).join('');
    const heading=(n,height,content)=>'<row r="'+n+'" ht="'+height+'" customHeight="1">'+content+'</row>';
    const merged=columns.length===1?'':'<mergeCells count="2"><mergeCell ref="A1:'+lastCol+'1"/><mergeCell ref="A2:'+lastCol+'2"/></mergeCells>';
    const body=rows.map((row,i)=>{
      if(row.length>columns.length) throw new RangeError('Лишние значения в строке '+(i+4));
      const n=i+4, content=row.map((v,j)=>cell(letters[j]+n,formats[columns[j].format]||0,v)).join('');
      return '<row r="'+n+'">'+content+'</row>';
    }).join('');
    return '<worksheet xmlns="'+spreadsheet+'"><sheetPr><tabColor rgb="FFFF781C"/></sheetPr>'+
      '<dimension ref="A1:'+lastCol+lastRow+'"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">'+
      '<pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/>'+
      '<selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews>'+
      '<sheetFormatPr defaultRowHeight="18"/><cols>'+cols+'</cols><sheetData>'+
      heading(1,32,cell('A1',1,sheet.title||sheet.name))+heading(2,32,cell('A2',2,sheet.subtitle||''))+
      heading(3,35,columns.map((c,j)=>cell(letters[j]+'3',3,c.label)).join(''))+body+
      '</sheetData><autoFilter ref="A3:'+lastCol+lastRow+'"/>'+merged+'</worksheet>';
  }
  function styles() {
    const font=(size,color,bold)=>'<font>'+(bold?'<b/>':'')+'<sz val="'+size+'"/><color rgb="'+color+'"/><name val="Onest"/></font>';
    const fill=color=>'<fill><patternFill patternType="solid"><fgColor rgb="'+color+'"/><bgColor indexed="64"/></patternFill></fill>';
    const xf=(fontId,fillId,borderId,numFmtId,align='')=>'<xf xfId="0" fontId="'+fontId+'" fillId="'+fillId+'" borderId="'+borderId+'" numFmtId="'+numFmtId+'" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" '+align+'/></xf>';
    return '<styleSheet xmlns="'+spreadsheet+'"><numFmts count="4">'+
      [[164,'dd.mm.yyyy'],[165,'[m]:ss'],[166,'0.0%'],[167,'0.0']].map(([id,fmt])=>'<numFmt numFmtId="'+id+'" formatCode="'+fmt+'"/>').join('')+
      '</numFmts><fonts count="4">'+font(11,'FF24262B',false)+font(17,'FFFFFFFF',true)+font(10,'FFDADDE1',false)+font(11,'FFFFFFFF',true)+'</fonts>'+
      '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+fill('FF27292E')+fill('FF35383D')+'</fills>'+
      '<borders count="2"><border/><border><bottom style="medium"><color rgb="FFFF781C"/></bottom></border></borders>'+
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
      '<cellXfs count="8">'+xf(0,0,0,0)+xf(1,2,0,0)+xf(2,2,0,0,'wrapText="1"')+xf(3,3,1,0,'wrapText="1"')+
      [164,165,166,167].map(id=>xf(0,0,0,id)).join('')+'</cellXfs>'+
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }
  const rel=(id,type,target)=>'<Relationship Id="'+id+'" Type="'+type+'" Target="'+target+'"/>';
  const rels=entries=>'<Relationships xmlns="'+packageRels+'">'+entries.join('')+'</Relationships>';
  return function seasonXlsxBlob(sheets) {
    if (!Array.isArray(sheets)||!sheets.length) throw new TypeError('Нужен хотя бы один лист.');
    const unique=new Set();
    for(const {name} of sheets){
      if(typeof name!=='string'||!name.trim()||name.length>31||/[\\/:*?\[\]\u0000-\u001F]/.test(name)||/^'|'$/.test(name)||unique.has(name.toLowerCase()))
        throw new Error('Недопустимое или повторное имя листа: '+name);
      unique.add(name.toLowerCase());
    }
    const book='<workbook xmlns="'+spreadsheet+'" xmlns:r="'+relationships+'"><bookViews><workbookView/></bookViews><sheets>'+
      sheets.map((s,i)=>'<sheet name="'+literal(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+
      '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
    const override=(name,type)=>'<Override PartName="/'+name+'" ContentType="'+type+'"/>';
    const officeType='application/vnd.openxmlformats-officedocument.spreadsheetml.';
    const types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'+
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
      override('xl/workbook.xml',officeType+'sheet.main+xml')+override('xl/styles.xml',officeType+'styles+xml')+
      override('docProps/core.xml','application/vnd.openxmlformats-package.core-properties+xml')+
      sheets.map((_,i)=>override('xl/worksheets/sheet'+(i+1)+'.xml',officeType+'worksheet+xml')).join('')+'</Types>';
    const metadata='<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">'+
      '<dc:creator>Лист матча</dc:creator><dc:title>'+escape(sheets[0].title||sheets[0].name)+'</dc:title><dc:description>'+
      escape([...new Set(sheets.map(s=>s.subtitle).filter(Boolean))].join('\n'))+'</dc:description></cp:coreProperties>';
    const parts=[
      ['[Content_Types].xml',types],
      ['_rels/.rels',rels([rel('rId1',relationships+'/officeDocument','xl/workbook.xml'),rel('rId2',packageRels+'/metadata/core-properties','docProps/core.xml')])],
      ['docProps/core.xml',metadata],['xl/workbook.xml',book],['xl/styles.xml',styles()],
      ['xl/_rels/workbook.xml.rels',rels([...sheets.map((_,i)=>rel('rId'+(i+1),relationships+'/worksheet','worksheets/sheet'+(i+1)+'.xml')),rel('rIdStyles',relationships+'/styles','styles.xml')])]
    ];
    sheets.forEach((sheet,i)=>parts.push(['xl/worksheets/sheet'+(i+1)+'.xml',worksheet(sheet)]));
    return archive(parts);
  };
})();
