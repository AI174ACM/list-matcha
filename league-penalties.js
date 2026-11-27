/* Штрафы обеих команд из ленты текстовой трансляции ВХЛ. */
const LeaguePenalties = (() => {
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const teamKey = name => clean(name).toLowerCase().replace(/ё/g,'е').replace(/^хк\s+/,'').replace(/[^а-яa-z0-9]/g,'');
  function fits(snapshot, match, id) {
    if (!snapshot || snapshot.id !== id || !Array.isArray(snapshot.teams) || snapshot.teams.length !== 2 ||
        !Array.isArray(snapshot.list) || !Array.isArray(snapshot.confirmed)) return false;
    const teams = snapshot.teams.map(teamKey), ours = teams.indexOf(teamKey(match.home));
    if (ours<0 || !teams[0] || !teams[1] || teams[0]===teams[1] || teams[1-ours]!==teamKey(match.away)) return false;
    return snapshot.list.every(e=>e && (e.side==='us'||e.side==='them') && teamKey(e.team)===teams[e.side==='us'?ours:1-ours] &&
      Number.isInteger(e.p) && e.p>=1 && e.p<=4 && Number.isInteger(e.min) && e.min>=0 && (e.n===null||Number.isInteger(e.n)));
  }
  function read(html, match, id) {
    const doc = typeof html === 'string' ? new DOMParser().parseFromString(html,'text/html') : html;
    const teams = Array.from(doc.querySelectorAll('.game__team-name'), el => clean(el.textContent));
    const result = {id, teams, list:[], confirmed:[], complete:false, fin:false};
    if (!fits(result,match,id)) return null;
    const summaries = new Map();
    let period = 0, finalTotals = null;
    // ВХЛ публикует последние события сверху. Читаем с начала, чтобы точно отнести штраф на 20:00 к периоду.
    for (const el of Array.from(doc.querySelectorAll('.game-event-item')).reverse()) {
      const text = clean(el.querySelector('.game-event-item__right p')?.textContent);
      const start = /^Начало (\d) периода/i.exec(text);
      if (start) period = Number(start[1]);
      if (/^Начало овертайма/i.test(text)) period = 4;
      if (/^Окончание игры/i.test(text)) result.fin = true;
      const summary = /^Статистика (\d)-го периода:.*?Штраф:\s*(\d+)\s*[-–]\s*(\d+)/i.exec(text);
      const total = /^Статистика матча:.*?Штраф:\s*(\d+)\s*[-–]\s*(\d+)/i.exec(text);
      if (total) finalTotals = [Number(total[1]),Number(total[2])];
      if (summary) summaries.set(Number(summary[1]),[Number(summary[2]),Number(summary[3])]);
      if (!el.classList.contains('game-event-item--pn')) continue;
      const t = clean(el.querySelector('time')?.textContent), clock = /^(\d+):([0-5]\d)$/.exec(t);
      const body = /^Удаление\.\s*(.+?)\.\s*(.+)$/i.exec(text);
      if (!clock || !body) return null;
      const index = teams.findIndex(team => teamKey(team) === teamKey(body[1]));
      const penalty = /^(Командный штраф|\d+\.\s*.+?)\.\s*(\d+)\s*мин\.\s*(.*)$/i.exec(body[2]);
      if (index < 0 || !penalty) return null;
      const player = /^(\d+)\.\s*(.+)$/.exec(penalty[1]);
      const details = penalty[3].split(/(?:Штраф\s+)?Отбыва(?:л|ет)\s*:\s*/i);
      const sec = Number(clock[1])*60 + Number(clock[2]);
      result.list.push({team:teams[index], side:teamKey(teams[index])===teamKey(match.home)?'us':'them',
        n:player?Number(player[1]):null, name:player?player[2]:'Командный штраф', t, sec,
        p:period || Math.min(4,Math.floor(sec/1200)+1), min:Number(penalty[2]),
        why:details[0].trim().replace(/\.$/,''), serve:(details[1] || '').trim().replace(/\.$/,'')});
    }
    result.list.sort((a,b)=>a.sec-b.sec);
    for (const [p, pair] of summaries) {
      const minutes = teams.map(team => result.list.filter(e=>e.p===p && e.team===team).reduce((sum,e)=>sum+e.min,0));
      if (minutes[0]===pair[0] && minutes[1]===pair[1]) result.confirmed.push(p);
    }
    result.confirmed.sort((a,b)=>a-b);
    result.complete = result.fin && !!finalTotals && teams.every((team,i)=>
      result.list.filter(e=>e.team===team).reduce((sum,e)=>sum+e.min,0)===finalTotals[i]);
    return result.list.length || result.confirmed.length || result.complete ? result : null;
  }
  function merge(previous, fresh) {
    if (!previous || !fresh || previous.id!==fresh.id) return fresh || previous || null;
    if (previous.fin && !fresh.fin || previous.complete && !fresh.complete) return previous;
    // Если ВХЛ вернула неполный фрагмент, сохраняем ранее подтверждённый период.
    if (fresh.complete) return fresh;
    const keep = [1,2,3,4].filter(p => !fresh.confirmed.includes(p) && (previous.confirmed.includes(p) ||
      (!fresh.list.some(e=>e.p===p) && previous.list.some(e=>e.p===p))));
    if (!keep.length) return fresh;
    return {...fresh, confirmed:[...new Set([...fresh.confirmed,...previous.confirmed.filter(p=>keep.includes(p))])].sort((a,b)=>a-b),
      list:[...fresh.list.filter(e=>!keep.includes(e.p)),...previous.list.filter(e=>keep.includes(e.p))].sort((a,b)=>a.sec-b.sec)};
  }
  return {read, fits, merge};
})();
