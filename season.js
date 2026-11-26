/* Статистика ВХЛ собрана по уникальным протоколам. Журнал оператора имеет собственный расчёт. */
const seasonScreen = (() => {
  const pages = {overview:'Обзор', players:'Игроки', matches:'Матчи', operator:'Данные оператора'};
  const groups = {forwards:{label:'Нападающие',pos:'н'},defenders:{label:'Защитники',pos:'з'},goalies:{label:'Вратари',pos:'в'}};
  const section = new URLSearchParams(location.search).get('section');
  const state = {page:Object.hasOwn(pages,section)?section:'overview', group:'forwards', sort:'pts', descending:true, offset:0, query:''};
  const history = () => window.SEASON_HISTORY;
  const date = (iso, month='long') => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month,timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
  const countWord = (n, forms) => forms[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2];
  const gameCount = n => n+' '+countWord(n,['матч','матча','матчей']);
  const signed = n => n>0?'+'+n:String(n).replace('-','−');
  const percent = (n,total) => total?(100*n/total).toLocaleString('ru-RU',{maximumFractionDigits:1})+'%':'—';
  const clock = seconds => Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  const position = {н:'Нападающий',з:'Защитник',в:'Вратарь'};
  const pageSize = () => innerHeight < 760 || innerWidth <= 820 ? 6 : innerHeight < 900 ? 8 : 10;
  const shotsSaved = p => p.shots?p.sv/p.shots:null;

  function portrait(p) {
    const photo = PHOTOS && cById(p.id)?.ph;
    return `<span class="sz-portrait"><span>№ ${p.n}</span>${photo?`<img src="photos/${p.id}.jpg" alt="" onerror="this.remove()">`:''}</span>`;
  }
  function showName(p) {
    const [surname,...rest] = p.name.split(' ');
    return esc(rest.concat(surname).join(' '));
  }
  function matchRow(m, full=false) {
    const won = m.goalsFor > m.goalsAgainst;
    const shortDate = m.date.slice(8)+'.'+m.date.slice(5,7);
    const description = esc(m.opponent)+' · '+date(m.date);
    const protocol = full && m.protocolUrl ? `<div class="sz-protocols">
      <a data-season-protocol href="${esc(m.protocolUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Протокол ВХЛ: ${description} (в новой вкладке)">Протокол ВХЛ</a>
      <a data-season-attachment href="protocols/${m.id}.html" download="Челмет — ${esc(m.opponent)} — ${m.date}.html" aria-label="Скачать копию протокола: ${description}">Скачать копию</a>
    </div>` : '';
    return `<div class="sz-match">
      <time datetime="${m.date}">${full?date(m.date):shortDate}</time>
      <span class="sz-opponent">${esc(m.opponent)}<small>${m.home?'Дома':'В гостях'}</small></span>
      <span class="sz-score" aria-label="Счёт Челмета ${m.goalsFor}:${m.goalsAgainst}">${m.goalsFor}:${m.goalsAgainst}</span>
      <span class="sz-outcome ${won?'sz-win':''}">${won?'Победа':'Поражение'}${m.finish?' · '+esc(m.finish):''}</span>${protocol}
    </div>`;
  }
  function resultsChart(matches) {
    const scale = Math.max(1,...matches.map(m=>Math.abs(m.goalsFor-m.goalsAgainst)));
    return `<figure class="sz-chart"><figcaption>Разница шайб по матчам</figcaption><div class="sz-bars" aria-hidden="true">${matches.map(m=>{
      const diff=m.goalsFor-m.goalsAgainst;
      return `<span class="${diff>0?'up':'down'}" title="${date(m.date)} · ${esc(m.opponent)} · ${signed(diff)}"><i style="--height:${Math.abs(diff)/scale*48}%"></i></span>`;
    }).join('')}</div><div class="sz-axis"><span>${date(matches[0].date)}</span><span>${date(matches[matches.length-1].date)}</span></div></figure>`;
  }
  function leaderCard(label,key) {
    const h = history();
    const players = key==='a' ? [...h.players,...h.goalies.filter(p=>Number.isFinite(p.a))] : h.players;
    const best = Math.max(...players.map(p=>p[key]));
    const leaders = players.filter(p=>p[key]===best && best>0);
    const titles = {pts:['очко','очка','очков'],g:['гол','гола','голов'],a:['передача','передачи','передач']};
    return `<section class="sz-leader"><h3>${label}</h3>${leaders.length?`<div class="sz-mark">${best}<small>${countWord(best,titles[key])}</small></div>
      <div class="sz-winners">${leaders.map(p=>`<button data-season-player="${p.id}">${portrait(p)}<span>${showName(p)}</span></button>`).join('')}</div>`:'<p>Нет данных</p>'}</section>`;
  }
  function overview(h) {
    const games = h.matches, wins = games.filter(m=>m.goalsFor>m.goalsAgainst).length;
    const goals = games.reduce((s,m)=>[s[0]+m.goalsFor,s[1]+m.goalsAgainst],[0,0]);
    return `<div class="sz-overview"><section class="sz-record">
      <div class="sz-record-head"><h2>${gameCount(games.length)} ВХЛ</h2>${Number.isInteger(SEASON.data?.n)?`<span>Журнал оператора — ${gameCount(SEASON.data.n)}</span>`:''}</div>
      <div class="sz-tally"><div><strong>${wins}</strong><span>${countWord(wins,['победа','победы','побед'])}</span></div>
      <div><strong>${games.length-wins}</strong><span>${countWord(games.length-wins,['поражение','поражения','поражений'])}</span></div>
      <div class="sz-goals"><b>${goals[0]}:${goals[1]}</b><span>шайбы с учётом буллитов</span></div></div>
      ${resultsChart(games)}</section>
      <section class="sz-recent sz-card"><div class="sz-card-heading"><h2>Последние матчи</h2><button class="sz-link" data-season-page="matches">Все матчи <span aria-hidden="true">›</span></button></div>
      <div class="sz-recent-list">${games.slice(-3).reverse().map(m=>matchRow(m)).join('')}</div></section>
      <section class="sz-leaders sz-card"><div class="sz-card-heading"><h2>Лидеры команды</h2><button class="sz-link" data-season-page="players">Все игроки <span aria-hidden="true">›</span></button></div>
      <div class="sz-leader-grid">${leaderCard('По очкам','pts')}${leaderCard('По голам','g')}${leaderCard('По передачам','a')}</div></section></div>`;
  }

  const skaterCols = [['gp','Игры'],['g','Голы'],['a','Передачи'],['pts','Очки'],['sog','Броски в створ'],['pm','Плюс-минус']];
  const goalieCols = [['gp','Игры'],['toi','Игровое время, мин:с'],['shots','Броски по воротам'],['ga','Пропущено'],['sv','Отражено'],['pct','% отражённых']];
  const departedGoalies = new Set([38463]); // Савелий Шерстнев. Матчи за «Челмет» остаются в истории.
  const readValue = (p,key) => key==='pct'?shotsSaved(p):p[key];
  function pageSlice(rows) {
    const size=pageSize(), last=Math.max(0,Math.ceil(rows.length/size)-1);
    state.offset=Math.min(state.offset,last);
    const start=state.offset*size;
    const pager = rows.length>size?`<div class="sz-pager"><span>${start+1}–${Math.min(start+size,rows.length)} из ${rows.length}</span><button data-season-step="-1" aria-label="Предыдущая страница" ${state.offset===0?'disabled':''}>‹</button><button data-season-step="1" aria-label="Следующая страница" ${state.offset===last?'disabled':''}>›</button></div>`:'';
    return {visible:rows.slice(start,start+size),pager};
  }
  function players(h) {
    const goalies=state.group==='goalies', cols=goalies?goalieCols:skaterCols;
    const role=groups[state.group].pos, query=tz(state.query);
    const roster=goalies?h.goalies.filter(p=>!departedGoalies.has(p.id)):h.players;
    const rows=roster.filter(p=>p.pos===role&&tz(p.name).includes(query)).sort((a,b)=>{
      const av=readValue(a,state.sort),bv=readValue(b,state.sort);
      if(av==null||bv==null)return (av==null)-(bv==null);
      return (state.descending?bv-av:av-bv)||a.name.localeCompare(b.name,'ru');
    });
    const {visible,pager}=pageSlice(rows);
    return `<section class="sz-directory sz-card"><div class="sz-tools"><div class="sz-group" role="group" aria-label="Амплуа">${Object.entries(groups).map(([key,g])=>`<button data-season-group="${key}" aria-pressed="${state.group===key}">${g.label}</button>`).join('')}</div>
      <input type="search" aria-label="Найти игрока по фамилии" placeholder="Найти игрока" value="${esc(state.query)}" id="seasonSearch"></div>
      <div class="sz-table-wrap"><table class="sz-table"><thead><tr><th scope="col">Игрок</th>${cols.map(([key,label])=>`<th scope="col" ${key===state.sort?'aria-sort="'+(state.descending?'descending':'ascending')+'"':''}><button data-season-sort="${key}">${label}${key===state.sort?(state.descending?' ↓':' ↑'):''}</button></th>`).join('')}</tr></thead>
      <tbody>${visible.map(p=>`<tr><td><button data-season-player="${p.id}"><span class="sz-number">№ ${p.n}</span><b>${esc(p.name)}</b></button></td>${cols.map(([key])=>`<td class="${state.sort===key?'sz-ranked':''}">${key==='pct'?percent(p.sv,p.shots):key==='pm'?signed(p.pm):key==='toi'?(Number.isFinite(p.toi)?clock(p.toi):'Нет данных'):p[key]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${rows.length?'':'<p class="sz-empty">Игроков с таким именем нет.</p>'}${pager}</section>`;
  }
  function matches(h) {
    const {visible,pager}=pageSlice([...h.matches].reverse());
    return `<section class="sz-directory sz-card"><div class="sz-card-heading"><h2>Матчи «Челмета»</h2><span class="sz-secondary">Счёт со стороны «Челмета»</span></div>
      <div class="sz-match-list">${visible.map(m=>matchRow(m,true)).join('')}</div>${pager}</section>`;
  }
  function profile(id) {
    const h=history(),p=[...h.players,...h.goalies].find(p=>p.id===id);
    if(!p)return;
    const stats=p.pos==='в'?[['Игры',p.gp],['Броски по воротам',p.shots],['Пропущено',p.ga],['Отражено',p.sv],['Процент отражённых',percent(p.sv,p.shots)],['Передачи',p.a??'Нет данных'],['Штраф, мин',p.pim??'Нет данных'],['Время на льду, мин:с',clock(p.toi)]]:
      [['Игры',p.gp],['Голы',p.g],['Передачи',p.a],['Очки',p.pts],['Броски в створ',p.sog],['Плюс-минус',signed(p.pm)],['Силовые приёмы',p.hit],['Блоки',p.bl],['Штраф, мин',p.pim],['Вбрасывания выиграны',p.fow+' из '+p.fo],['Смены',p.shifts],['Время на льду, мин:с',clock(p.toi)]];
    sh.classList.add('narrow');
    sh.innerHTML=`<div class="sz-profile" role="dialog" aria-modal="true" aria-labelledby="seasonPlayerName"><div class="sz-person">${portrait(p)}<div><span class="sz-secondary">${position[p.pos]} · № ${p.n}</span><h2 id="seasonPlayerName">${showName(p)}</h2></div></div>
     <div class="sz-profile-stats">${stats.map(([k,v])=>`<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
     <footer><span>Протоколы ВХЛ по ${date(h.asOf)}</span><button class="btn dark" id="seasonDone">Готово</button></footer></div>`;
    const origin=document.activeElement;
    open_();
    const done=document.getElementById('seasonDone');
    done.onclick=()=>{close_();if(origin?.isConnected)origin.focus()};
    done.focus();
  }
  function render() {
    const h=history(), panel=document.getElementById('view');
    const searchFocused=document.activeElement?.id==='seasonSearch';
    const selection=searchFocused?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
    const page=state.page, official=page!=='operator';
    const caption=official&&h?`Челмет · ${esc(h.season)} · Протоколы ВХЛ по ${date(h.asOf)}`: 'Статистика из матчей, записанных оператором';
    const waiting=SEASON.busy&&!SEASON.data&&navigator.onLine;
    const canExport=h?.matches?.length||SEASON.data?.matches?.length;
    panel.innerHTML=`<div class="sz-shell"><header class="sz-head"><div><h1>Итоги сезона</h1><p>${caption}</p></div>
      <nav class="sz-nav" aria-label="Разделы сезона">${Object.entries(pages).map(([key,label])=>`<button data-season-page="${key}" ${page===key?'aria-current="page"':''}>${label}</button>`).join('')}</nav>
      <button type="button" class="sz-export" data-season-export ${waiting||!canExport?'disabled':''} title="Полные итоги сезона в формате .xlsx">${waiting?'Загружаем данные…':'Скачать Excel'}</button></header><div id="seasonPanel" class="sz-panel sz-${page}-panel"></div></div>`;
    if(page==='operator'){
      const counts=[];
      if(SEASON.data)counts.push('Журнал оператора — '+gameCount(SEASON.data.n));
      if(h?.matches?.length)counts.push('ВХЛ по '+date(h.asOf)+' — '+gameCount(h.matches.length));
      renderOperatorSeason(counts.join(' · '));
      return;
    }
    const content=document.getElementById('seasonPanel');
    if(!h?.matches?.length){content.innerHTML='<p class="sz-empty">Нет данных из официальных протоколов ВХЛ.</p>';return}
    content.innerHTML=page==='players'?players(h):page==='matches'?matches(h):overview(h);
    if(searchFocused){const field=document.getElementById('seasonSearch');if(field){field.focus();field.setSelectionRange(...selection)}}
  }
  document.addEventListener('click', e=>{
    const b=e.target.closest('#view button');
    if(!b||UI.tab!=='season')return;
    const d=b.dataset;
    if('seasonExport' in d){
      const h=history();
      try{
        const sheets=seasonExportSheets(h,SEASON.data,SEASON.at);
        if(!sheets.length){snack('Нет данных для выгрузки','Закрыть',()=>{});return}
        const name=h?.matches?.length?'итоги сезона '+h.season.replace(/\//g,'-'):'данные оператора';
        dl('Челмет — '+name+'.xlsx',seasonXlsxBlob(sheets));
      }catch(error){console.error('Выгрузка сезона',error);snack('Не удалось собрать файл Excel','Закрыть',()=>{})}
      return;
    }
    if(d.seasonPlayer){profile(Number(d.seasonPlayer));return}
    if(d.seasonPage){state.page=d.seasonPage;state.offset=0;state.query=''}
    else if(d.seasonGroup){state.group=d.seasonGroup;state.sort=d.seasonGroup==='goalies'?'gp':'pts';state.descending=true;state.offset=0;state.query=''}
    else if(d.seasonSort){state.descending=state.sort===d.seasonSort?!state.descending:true;state.sort=d.seasonSort;state.offset=0}
    else if(d.seasonStep)state.offset=Math.max(0,state.offset+Number(d.seasonStep));
    else return;
    render();
    if(d.seasonPage==='operator')loadSeason();
    const attr=Array.from(b.attributes).find(a=>a.name.startsWith('data-season-'));
    if(attr){const target=document.querySelector(`#view button[${attr.name}="${attr.value}"]:not(:disabled)`);target?.focus({preventScroll:true})}
  });
  document.addEventListener('input',e=>{if(e.target.id==='seasonSearch'){state.query=e.target.value;state.offset=0;render()}});
  let size=pageSize();
  addEventListener('resize',()=>{const next=pageSize();if(next!==size){size=next;if(UI.tab==='season'&&['players','matches'].includes(state.page))render()}});
  return {render, pageSlice, firstPage(){state.offset=0}};
})();
function renderSeason(){seasonScreen.render()}
