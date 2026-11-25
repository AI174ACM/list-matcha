/* Данные книги сезона. У протоколов ВХЛ и журнала оператора разный охват. */
function seasonExportSheets(history, operator, at) {
  const sheets = [];
  const official = history?.matches?.length > 0;
  if (!official && !operator) return sheets;

  const col = (label, width, format) => ({label, width, ...(format ? {format} : {})});
  const position = {н:'Нападающий', з:'Защитник', в:'Вратарь'};
  const day = 86400000;
  const duration = seconds => Number.isFinite(seconds) ? seconds / 86400 : null;
  const ratio = (n, d) => Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null;
  const formula = (expression, value) => Number.isFinite(value) ? {formula:expression, value} : null;
  const sheet = (name, title, subtitle, columns, rows) => sheets.push({name, title, subtitle, columns, rows});
  function excelDate(value) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const ru = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
    if (!iso && !ru) return null;
    const [,y,m,d] = iso || [null,ru[3],ru[2],ru[1]];
    const dt = new Date(Date.UTC(+y,+m-1,+d));
    if (dt.getUTCDate() !== +d || dt.getUTCMonth() !== +m-1) return null;
    return (dt.getTime() - Date.UTC(1899,11,30)) / day;
  }
  const prettyDate = iso => iso.split('-').reverse().join('.');
  const leagueSource = official ? 'Официальные протоколы ВХЛ · ' + prettyDate(history.start) + ' — ' + prettyDate(history.asOf) : '';
  const fetched = at && Number.isFinite(new Date(at).getTime()) ? new Date(at).toLocaleString('ru-RU',{
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
    timeZone:'Asia/Yekaterinburg'
  }) + ' по Челябинску' : '';
  const operatorSource = 'Журнал оператора' + (fetched ? ' · получено ' + fetched : '');
  const overview = [];
  if (official) {
    const games = history.matches, wins = games.filter(m => m.goalsFor > m.goalsAgainst).length;
    const total = key => games.reduce((sum,m) => sum + m[key], 0);
    overview.push(['Матчи ВХЛ',games.length,leagueSource],['Победы',wins,null],['Поражения',games.length-wins,null],
      ['Заброшено шайб',total('goalsFor'),'По итоговым счетам, включая решающий буллит'],
      ['Пропущено шайб',total('goalsAgainst'),'По итоговым счетам, включая решающий буллит'],
      ['Полевые игроки',history.players.length,'Выходили на лёд за «Челмет»'],
      ['Вратари',history.goalies.length,'Выходили на лёд за «Челмет»']);
    for (const [key,label] of [['pts','Лидеры по очкам'],['g','Лидеры по голам'],['a','Лидеры по передачам']]) {
      const best = Math.max(...history.players.map(p => p[key]));
      if (best > 0) overview.push([label,best,history.players.filter(p => p[key] === best).map(p => p.name).join(', ')]);
    }
  } else {
    overview.push(['Протоколы ВХЛ',null,'Данные ВХЛ недоступны']);
  }
  overview.push(['Данные оператора',operator?.n ?? null,operator
    ? 'Матчи в отдельном расчёте журнала. ' + operatorSource
    : 'Данные журнала недоступны']);
  sheet('Обзор','Челмет · ' + (official ? 'сезон ' + history.season : 'журнал оператора'),
    official ? leagueSource : operatorSource,
    [col('Показатель',24),col('Значение',14),col('Подробности',76)],overview);

  if (official) {
    sheet('Матчи','Челмет · матчи сезона',leagueSource + ' · счёт со стороны «Челмета»',
      [col('Дата',15,'date'),col('Соперник',27),col('Площадка',17),col('Заброшено',15),
       col('Пропущено',15),col('Результат',18),col('Решение матча',24),col('ID протокола ВХЛ',21)],
      history.matches.map(m => [excelDate(m.date),m.opponent,m.home ? 'Дома' : 'В гостях',m.goalsFor,m.goalsAgainst,
        m.goalsFor > m.goalsAgainst ? 'Победа' : 'Поражение',
        ({'':'Основное время','Б':'Буллиты','ОТ':'Овертайм'})[m.finish] ?? m.finish,m.id]));

    sheet('Полевые','Челмет · полевые игроки',leagueSource + ' · номер по последнему сыгранному матчу',
      [col('Игрок',30),col('№',9),col('Амплуа',18),col('Матчи',12),col('Голы',12),col('Передачи',14),
       col('Очки',12),col('Плюс-минус',15),col('Броски в створ',19),col('Штраф, мин',16),col('Силовые приёмы',21),
       col('Блоки',12),col('Вбрасывания',17),col('Выиграно вбрасываний',25),col('Доля выигранных',22,'percent'),
       col('Смены',12),col('Время на льду',20,'duration'),col('Время за матч',20,'duration'),col('ID игрока ВХЛ',18)],
      history.players.map((p,i) => {
        const r=i+4;
        return [p.name,p.n,position[p.pos],p.gp,p.g,p.a,formula('E'+r+'+F'+r,p.pts),p.pm,p.sog,p.pim,p.hit,p.bl,
          p.fo,p.fow,formula('IFERROR(N'+r+'/M'+r+',"")',ratio(p.fow,p.fo)),p.shifts,duration(p.toi),
          formula('IFERROR(Q'+r+'/D'+r+',"")',ratio(duration(p.toi),p.gp)),p.id];
      }));
    sheet('Вратари','Челмет · вратари',leagueSource + ' · номер по последнему сыгранному матчу',
      [col('Вратарь',30),col('№',9),col('Матчи',12),col('Броски в створ',19),col('Пропущено',16),
       col('Отражено',15),col('Доля отражённых',22,'percent'),col('Время на льду',20,'duration'),
       col('Время за матч',20,'duration'),col('ID игрока ВХЛ',18)],
      history.goalies.map((p,i) => {
        const r=i+4;
        return [p.name,p.n,p.gp,p.shots,p.ga,p.sv,formula('IFERROR(F'+r+'/D'+r+',"")',ratio(p.sv,p.shots)),
          duration(p.toi),formula('IFERROR(H'+r+'/C'+r+',"")',ratio(duration(p.toi),p.gp)),p.id];
      }));
  }
  if (!operator) return sheets;

  const matches = operator.matches || [];
  const source = operatorSource + ' · матчей в расчёте: ' + operator.n;
  const measures = [
    ['fw','Выиграно вбрасываний'],['fl','Проиграно вбрасываний'],['sh','Броски в створ'],
    ['g','Голы'],['a','Передачи'],['bl','Блоки'],['hit','Силовые приёмы'],['to','Потери шайбы'],['pen','Штраф, мин']
  ];
  const teamMeasures = [...measures,['ga','Пропущено шайб']];
  if (operator.n > 0) {
    const team = operator.team.t;
    sheet('Оператор — команда','Журнал оператора · команда',source,
      [col('Показатель',27),col('Всего',14),col('В среднем за матч',23,'decimal')],
      teamMeasures.map(([key,label]) => [label,team[key],ratio(team[key],operator.n)]));

    function playerSheet(name, title, average, last) {
      const fmt = average ? 'decimal' : undefined;
      const columns = [col('Игрок',28),col('№',9),col('Амплуа',18),col('Сыграно матчей',20),
        ...measures.map(([,label]) => col(label,Math.max(13,label.length+4),fmt)),
        col('Доля выигранных вбрасываний',31,'percent'),col('Плюсы',13,fmt),col('Минусы',13,fmt)];
      const rows = [];
      for (const p of operator.players || []) {
        const games = last ? p.gp5 : p.gp, t = last ? p.t5 : p.t;
        if (!games || !t) continue;
        const value = n => average ? ratio(n,games) : n;
        const recorded = t.pmc > 0 && Number.isFinite(t.pm);
        rows.push([p.name,p.n,position[p.pos],games,...measures.map(([key]) => value(t[key])),
          ratio(t.fw,t.fw+t.fl),recorded ? value((t.pmc+t.pm)/2) : null,
          recorded ? value((t.pmc-t.pm)/2) : null]);
      }
      const note = last ? 'Последние пять учтённых матчей команды' : source;
      const subtitle = average ? note + ' · в среднем за сыгранный игроком матч' : note;
      sheet(name,title,last ? subtitle + ' · ' + operatorSource : subtitle,columns,rows);
    }
    playerSheet('Оператор — игроки','Журнал оператора · суммы по игрокам',false,false);
    playerSheet('Оператор — средние','Журнал оператора · средние игрока за матч',true,false);
    if (operator.n > 5) {
      playerSheet('Оператор — последние 5','Журнал оператора · форма игроков за последние пять матчей',true,true);
    }

    const periods = [];
    for (const [p,stats] of Object.entries(operator.team.per || {})) {
      // Приёмник создаёт нулевую строку ОТ даже для матчей, завершившихся в основное время.
      if (p === '4' && !teamMeasures.some(([key]) => stats[key] > 0)) continue;
      periods.push([p === '4' ? 'Овертайм' : p+'-й период',stats]);
    }
    periods.push(['Весь матч',team]);
    const periodRows = [];
    for (const [period,stats] of periods) {
      for (const [key,label] of teamMeasures) {
        periodRows.push([period,label,stats[key],ratio(stats[key],operator.n),
          key === 'fw' ? ratio(stats.fw,stats.fw+stats.fl) : null]);
      }
    }
    sheet('Оператор — периоды','Журнал оператора · команда по периодам',source,
      [col('Период',20),col('Показатель',28),col('Всего',14),col('На один учтённый матч',27,'decimal'),
       col('Доля выигранных вбрасываний',32,'percent')],periodRows);
  }
  sheet('Оператор — матчи','Журнал оператора · матчи и охват',source,
    [col('Дата',15,'date'),col('Соперник',27),col('Площадка',17),col('Счёт в журнале',20),
     col('В расчёте',16),col('Причина исключения',39),col('ID записи',24)],
    matches.map(m => [excelDate(m.date),m.away,({ДОМА:'Дома',ВЫЕЗД:'В гостях'})[m.venue] ?? m.venue,
      m.score,m.why ? 'Нет' : 'Да',m.why || null,m.id]));
  return sheets;
}
