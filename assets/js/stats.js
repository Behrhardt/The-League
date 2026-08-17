/* Turns raw Sleeper season data into league history: champions, manager careers,
 * and all-time records.
 *
 * Managers are keyed by Sleeper user_id, which is stable across seasons even
 * when someone renames their team every August.
 */

/* ------------------------------------------------------------- utilities -- */

const pts = (settings, key) =>
  (settings?.[key] || 0) + (settings?.[`${key}_decimal`] || 0) / 100;

export const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
export const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "—");
export const pct = (n) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—");

export function ordinal(n) {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n);
  const s = ["th", "st", "nd", "rd"];
  const m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

/* ------------------------------------------------------- season standings -- */

/**
 * Final placement for one season.
 *
 * Playoff teams get their place from the winners bracket: every bracket game
 * carrying a `p` (placement) field decides places p and p+1. Teams that missed
 * the playoffs are ranked below them by regular-season record, then points for.
 * That ordering is stated on the page so nobody has to guess at the method.
 */
export function seasonStandings(season) {
  const byRoster = new Map();

  for (const r of season.rosters) {
    const s = r.settings || {};
    byRoster.set(r.roster_id, {
      rosterId: r.roster_id,
      ownerId: r.owner_id || `orphan-${season.season}-${r.roster_id}`,
      orphan: !r.owner_id,
      wins: s.wins || 0,
      losses: s.losses || 0,
      ties: s.ties || 0,
      pointsFor: pts(s, "fpts"),
      pointsAgainst: pts(s, "fpts_against"),
      place: null,
    });
  }

  // Placements from the winners bracket.
  for (const g of season.bracket || []) {
    if (g.p == null || g.w == null || g.l == null) continue;
    const winner = byRoster.get(g.w);
    const loser = byRoster.get(g.l);
    if (winner && winner.place == null) winner.place = g.p;
    if (loser && loser.place == null) loser.place = g.p + 1;
  }

  const teams = [...byRoster.values()];
  const regularOrder = (a, b) =>
    b.wins - a.wins || b.ties - a.ties || b.pointsFor - a.pointsFor;

  // Fill the rest, skipping places already taken by the bracket.
  const taken = new Set(teams.filter((t) => t.place != null).map((t) => t.place));
  const unplaced = teams.filter((t) => t.place == null).sort(regularOrder);
  let next = 1;
  for (const t of unplaced) {
    while (taken.has(next)) next++;
    t.place = next;
    taken.add(next);
  }

  teams.sort((a, b) => a.place - b.place);

  // Regular-season seeding is a separate question from final placement, and
  // some rules (last place, points title) key off it.
  const regular = [...teams].sort(regularOrder);
  regular.forEach((t, i) => (t.regularPlace = i + 1));

  return teams;
}

/* ------------------------------------------------------------- game log --- */

/** Every regular-season head-to-head game across every season, flattened. */
export function gameLog(seasons) {
  const games = [];

  for (const season of seasons) {
    const owner = new Map(
      season.rosters.map((r) => [r.roster_id, r.owner_id || null])
    );

    for (const { week, teams } of season.weeks) {
      const byMatchup = new Map();
      for (const t of teams) {
        if (t.matchup_id == null) continue; // bye or not yet scheduled
        if (!byMatchup.has(t.matchup_id)) byMatchup.set(t.matchup_id, []);
        byMatchup.get(t.matchup_id).push(t);
      }

      for (const pair of byMatchup.values()) {
        if (pair.length !== 2) continue;
        const [a, b] = pair;
        const ap = Number(a.points) || 0;
        const bp = Number(b.points) || 0;
        if (ap === 0 && bp === 0) continue; // week hasn't been played

        games.push({
          season: season.season,
          week,
          a: { rosterId: a.roster_id, ownerId: owner.get(a.roster_id), points: ap },
          b: { rosterId: b.roster_id, ownerId: owner.get(b.roster_id), points: bp },
          margin: Math.abs(ap - bp),
          total: ap + bp,
        });
      }
    }
  }

  return games;
}

/* ---------------------------------------------------------- manager index -- */

/** Display names, keyed by user_id, preferring the most recent season's name. */
export function managerDirectory(seasons) {
  const dir = new Map();

  // Oldest first so newer seasons overwrite with current names.
  for (const season of [...seasons].reverse()) {
    for (const u of season.users) {
      dir.set(u.user_id, {
        userId: u.user_id,
        name: u.display_name || "Unknown manager",
        teamName: u.metadata?.team_name || null,
        avatar: u.avatar || null,
      });
    }
  }

  return dir;
}

/* --------------------------------------------------------- career records -- */

export function managerCareers(seasons, dir) {
  const careers = new Map();

  const get = (ownerId) => {
    if (!careers.has(ownerId)) {
      const info = dir.get(ownerId);
      careers.set(ownerId, {
        userId: ownerId,
        name: info?.name || "Former manager",
        teamName: info?.teamName || null,
        avatar: info?.avatar || null,
        known: Boolean(info),
        seasons: 0,
        completedSeasons: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        titles: 0,
        runnerUps: 0,
        thirds: 0,
        playoffApps: 0,
        lastPlaces: 0,
        finishes: [],
        bestFinish: null,
        worstFinish: null,
        firstSeason: null,
        lastSeason: null,
        seasonRows: [],
      });
    }
    return careers.get(ownerId);
  };

  for (const season of seasons) {
    const standings = seasonStandings(season);
    const teamCount = standings.length;
    const playoffTeams = season.settings?.playoff_teams || 0;

    for (const t of standings) {
      if (t.orphan) continue; // unclaimed team, nobody to credit or blame
      const c = get(t.ownerId);

      c.seasons++;
      c.wins += t.wins;
      c.losses += t.losses;
      c.ties += t.ties;
      c.pointsFor += t.pointsFor;
      c.pointsAgainst += t.pointsAgainst;

      if (!c.firstSeason || season.season < c.firstSeason) c.firstSeason = season.season;
      if (!c.lastSeason || season.season > c.lastSeason) c.lastSeason = season.season;

      c.seasonRows.push({
        season: season.season,
        place: season.complete ? t.place : null,
        regularPlace: t.regularPlace,
        record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
        pointsFor: t.pointsFor,
        teamCount,
        complete: season.complete,
      });

      // Only finished seasons count toward finishes and titles.
      if (!season.complete) continue;

      c.completedSeasons++;
      c.finishes.push(t.place);
      if (t.place === 1) c.titles++;
      if (t.place === 2) c.runnerUps++;
      if (t.place === 3) c.thirds++;
      if (playoffTeams && t.place <= playoffTeams) c.playoffApps++;
      if (t.place === teamCount) c.lastPlaces++;

      if (c.bestFinish == null || t.place < c.bestFinish) c.bestFinish = t.place;
      if (c.worstFinish == null || t.place > c.worstFinish) c.worstFinish = t.place;
    }
  }

  for (const c of careers.values()) {
    const games = c.wins + c.losses + c.ties;
    c.games = games;
    c.winPct = games ? (c.wins + c.ties * 0.5) / games : NaN;
    c.avgFinish = c.finishes.length
      ? c.finishes.reduce((s, n) => s + n, 0) / c.finishes.length
      : NaN;
    c.pointsPerGame = games ? c.pointsFor / games : NaN;
    c.seasonRows.sort((a, b) => b.season.localeCompare(a.season));
  }

  return careers;
}

/* ---------------------------------------------------------------- titles -- */

export function championsByYear(seasons, dir) {
  const rows = [];

  for (const season of seasons) {
    if (!season.complete) continue;
    const standings = seasonStandings(season);
    const champ = standings.find((t) => t.place === 1);
    const runnerUp = standings.find((t) => t.place === 2);
    if (!champ) continue;

    const name = (t) =>
      t ? dir.get(t.ownerId)?.name || "Former manager" : null;

    rows.push({
      season: season.season,
      champion: name(champ),
      championAvatar: champ ? dir.get(champ.ownerId)?.avatar : null,
      championRecord: `${champ.wins}-${champ.losses}${champ.ties ? `-${champ.ties}` : ""}`,
      championPoints: champ.pointsFor,
      championSeed: champ.regularPlace,
      runnerUp: name(runnerUp),
      teamCount: standings.length,
    });
  }

  return rows; // already newest-first, matching the season order
}

/* --------------------------------------------------------------- records -- */

export function allTimeRecords(seasons, dir, games) {
  const name = (ownerId) => dir.get(ownerId)?.name || "Former manager";

  /* Season-long points. Sleeper's roster totals are regular season only, which
   * keeps every season comparable regardless of playoff length. */
  const seasonTotals = [];
  for (const season of seasons) {
    for (const t of seasonStandings(season)) {
      if (t.orphan || t.pointsFor <= 0) continue;
      // A season still in progress has fewer games and would fake a "fewest
      // points ever" record, so it only competes for the high mark.
      seasonTotals.push({
        season: season.season,
        complete: season.complete,
        ownerId: t.ownerId,
        manager: name(t.ownerId),
        points: t.pointsFor,
        pointsAgainst: t.pointsAgainst,
        record: `${t.wins}-${t.losses}${t.ties ? `-${t.ties}` : ""}`,
        wins: t.wins,
        losses: t.losses,
        weeks: t.wins + t.losses + t.ties,
      });
    }
  }

  const completedTotals = seasonTotals.filter((s) => s.complete);
  const byPoints = [...seasonTotals].sort((a, b) => b.points - a.points);
  const byPointsCompleted = [...completedTotals].sort((a, b) => a.points - b.points);

  /* Single-week extremes and margins. */
  const sides = [];
  for (const g of games) {
    for (const side of [g.a, g.b]) {
      if (!side.ownerId || side.points <= 0) continue;
      sides.push({ season: g.season, week: g.week, ownerId: side.ownerId, points: side.points });
    }
  }
  const byWeek = [...sides].sort((a, b) => b.points - a.points);

  const scored = games.filter((g) => g.a.points > 0 && g.b.points > 0);
  const blowouts = [...scored].sort((a, b) => b.margin - a.margin);
  const nailBiters = [...scored].sort((a, b) => a.margin - b.margin);
  const shootouts = [...scored].sort((a, b) => b.total - a.total);

  const gameLine = (g) => {
    const [hi, lo] = g.a.points >= g.b.points ? [g.a, g.b] : [g.b, g.a];
    return {
      season: g.season,
      week: g.week,
      winner: name(hi.ownerId),
      loser: name(lo.ownerId),
      winnerPoints: hi.points,
      loserPoints: lo.points,
      margin: g.margin,
      total: g.total,
    };
  };

  /* Best and worst regular-season records, ranked by win rate then points. */
  const withRate = completedTotals
    .filter((s) => s.weeks > 0)
    .map((s) => ({ ...s, rate: s.wins / s.weeks }));
  const bestRecord = [...withRate].sort((a, b) => b.rate - a.rate || b.points - a.points)[0];
  const worstRecord = [...withRate].sort((a, b) => a.rate - b.rate || a.points - b.points)[0];

  return {
    mostPointsSeason: byPoints[0] || null,
    fewestPointsSeason: byPointsCompleted[0] || null,
    topSeasons: byPoints.slice(0, 10),
    highestWeek: byWeek[0] ? { ...byWeek[0], manager: name(byWeek[0].ownerId) } : null,
    lowestWeek: byWeek.length
      ? (() => {
          const l = byWeek[byWeek.length - 1];
          return { ...l, manager: name(l.ownerId) };
        })()
      : null,
    topWeeks: byWeek.slice(0, 10).map((w) => ({ ...w, manager: name(w.ownerId) })),
    biggestBlowout: blowouts[0] ? gameLine(blowouts[0]) : null,
    closestGame: nailBiters[0] ? gameLine(nailBiters[0]) : null,
    highestScoringGame: shootouts[0] ? gameLine(shootouts[0]) : null,
    bestRecord,
    worstRecord,
    gamesCounted: scored.length,
  };
}

/* ------------------------------------------------------------ head to head */

export function headToHead(games) {
  const table = new Map();
  const key = (x, y) => `${x}|${y}`;

  for (const g of games) {
    const { a, b } = g;
    if (!a.ownerId || !b.ownerId || a.points === b.points) continue;
    const [w, l] = a.points > b.points ? [a.ownerId, b.ownerId] : [b.ownerId, a.ownerId];
    table.set(key(w, l), (table.get(key(w, l)) || 0) + 1);
  }

  return {
    record(x, y) {
      return { wins: table.get(key(x, y)) || 0, losses: table.get(key(y, x)) || 0 };
    },
  };
}

/* ------------------------------------------------------------- top level -- */

export function buildLeagueStats(seasons) {
  const dir = managerDirectory(seasons);
  const games = gameLog(seasons);
  const careers = managerCareers(seasons, dir);

  const managers = [...careers.values()]
    .filter((c) => c.seasons > 0)
    .sort((a, b) => {
      // Rank by average finish; managers with no completed season sort last.
      const av = Number.isFinite(a.avgFinish) ? a.avgFinish : Infinity;
      const bv = Number.isFinite(b.avgFinish) ? b.avgFinish : Infinity;
      return av - bv || b.titles - a.titles || b.winPct - a.winPct;
    });

  return {
    seasons,
    directory: dir,
    games,
    managers,
    champions: championsByYear(seasons, dir),
    records: allTimeRecords(seasons, dir, games),
    h2h: headToHead(games),
    firstSeason: seasons.length ? seasons[seasons.length - 1].season : null,
    latestSeason: seasons.length ? seasons[0].season : null,
    completedCount: seasons.filter((s) => s.complete).length,
  };
}
