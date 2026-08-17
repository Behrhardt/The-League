/* Renders the league history page. */

import { loadHistory, ConfigError, avatarUrl } from "./sleeper.js";
import {
  buildLeagueStats,
  seasonStandings,
  fmt1,
  fmt2,
  pct,
  ordinal,
} from "./stats.js";
import {
  $,
  cfg,
  esc,
  html,
  icon,
  renderChrome,
  setupNotice,
  errorNotice,
} from "./site.js";

/* ------------------------------------------------------------- fragments -- */

/** First letter of a manager's name, used when they have no Sleeper avatar. */
const initials = (name) =>
  String(name || "?")
    .replace(/[^a-z0-9]/gi, "")
    .charAt(0)
    .toUpperCase() || "?";

/* Sleeper avatars 404 often enough (deleted accounts, changed handles) that the
 * initial has to be underneath the image rather than beside it. */
const avatarImg = (id, name) => {
  const fallback = `<span class="avatar avatar-fallback" aria-hidden="true">${esc(
    initials(name)
  )}</span>`;
  if (!id) return fallback;
  return `<span class="avatar-stack">${fallback}<img class="avatar" src="${esc(
    avatarUrl(id)
  )}" alt="" loading="lazy" onerror="this.remove()"></span>`;
};

const stat = (label, value, sub, tone = "") =>
  `<div class="stat">
    <span class="stat-label">${esc(label)}</span>
    <span class="stat-value ${tone}">${value}</span>
    ${sub ? `<span class="stat-sub">${sub}</span>` : ""}
  </div>`;

const recordCard = (label, big, who, when, tone = "") =>
  `<div class="record-card">
    <span class="stat-label">${esc(label)}</span>
    <span class="big ${tone}">${big}</span>
    <span class="who-line">${who}</span>
    <span class="when">${when}</span>
  </div>`;

const empty = (msg) =>
  `<div class="card" style="color:var(--text-faint);text-align:center">${esc(msg)}</div>`;

/* ------------------------------------------------------------ page parts -- */

function renderHeadline(stats) {
  const { records, managers, seasons, champions } = stats;

  const totalPoints = managers.reduce((s, m) => s + m.pointsFor, 0);
  const spanLabel =
    stats.firstSeason === stats.latestSeason
      ? stats.firstSeason
      : `${stats.firstSeason}–${stats.latestSeason}`;

  // Most decorated: titles first, then average finish as the tiebreak.
  const mostTitles = [...managers].sort(
    (a, b) => b.titles - a.titles || (a.avgFinish || 99) - (b.avgFinish || 99)
  )[0];

  const steadiest = managers.find((m) => m.completedSeasons >= 2) || managers[0];

  html(
    "#headline",
    `<div class="grid grid-4">
      ${stat("Seasons on record", seasons.length, esc(spanLabel), "gold")}
      ${stat("Games played", records.gamesCounted.toLocaleString(), "Regular season, all years")}
      ${stat(
        "Points scored",
        Math.round(totalPoints).toLocaleString(),
        "By every team, ever",
        "blue"
      )}
      ${stat(
        "Different champions",
        new Set(champions.map((c) => c.champion)).size,
        `${champions.length} title${champions.length === 1 ? "" : "s"} awarded`
      )}
    </div>
    <div class="grid grid-2" style="margin-top:16px">
      ${
        mostTitles && mostTitles.titles > 0
          ? stat(
              "Most decorated",
              esc(mostTitles.name),
              `${mostTitles.titles} title${mostTitles.titles === 1 ? "" : "s"} · ${pct(
                mostTitles.winPct
              )} career win rate`,
              "gold"
            )
          : ""
      }
      ${
        steadiest && Number.isFinite(steadiest.avgFinish)
          ? stat(
              "Most consistent",
              esc(steadiest.name),
              `Average finish of ${fmt1(steadiest.avgFinish)} across ${
                steadiest.completedSeasons
              } season${steadiest.completedSeasons === 1 ? "" : "s"}`,
              "green"
            )
          : ""
      }
    </div>`
  );
}

function renderChampions(stats) {
  const { champions } = stats;

  if (!champions.length) {
    html(
      "#champions",
      empty("No completed seasons yet. The trophy case fills up after your first championship.")
    );
    return;
  }

  html(
    "#champions",
    `<div class="champ-grid">
      ${champions
        .map(
          (c, i) => `
        <article class="champ${i === 0 ? " latest" : ""}">
          <div class="champ-head">
            <span class="champ-year">${esc(c.season)}</span>
            ${avatarImg(c.championAvatar, c.champion)}
          </div>
          <h3 class="champ-name">${esc(c.champion)}</h3>
          <div class="champ-meta">${esc(c.championRecord)} · ${fmt1(
            c.championPoints
          )} pts · ${ordinal(c.championSeed)} seed</div>
          ${
            c.runnerUp
              ? `<div class="champ-runner">Beat <strong>${esc(
                  c.runnerUp
                )}</strong> for it</div>`
              : ""
          }
        </article>`
        )
        .join("")}
    </div>`
  );
}

function renderRecords(stats) {
  const r = stats.records;
  const cards = [];

  if (r.mostPointsSeason) {
    const s = r.mostPointsSeason;
    cards.push(
      recordCard(
        "Most points in a season",
        fmt1(s.points),
        esc(s.manager),
        `${esc(s.season)} · ${esc(s.record)}${s.complete ? "" : " · still in progress"}`,
        "gold"
      )
    );
  }

  if (r.fewestPointsSeason) {
    const s = r.fewestPointsSeason;
    cards.push(
      recordCard(
        "Fewest points in a season",
        fmt1(s.points),
        esc(s.manager),
        `${esc(s.season)} · ${esc(s.record)}`,
        "red"
      )
    );
  }

  if (r.highestWeek) {
    const w = r.highestWeek;
    cards.push(
      recordCard(
        "Highest single week",
        fmt2(w.points),
        esc(w.manager),
        `${esc(w.season)} · Week ${w.week}`,
        "gold"
      )
    );
  }

  if (r.lowestWeek) {
    const w = r.lowestWeek;
    cards.push(
      recordCard(
        "Lowest single week",
        fmt2(w.points),
        esc(w.manager),
        `${esc(w.season)} · Week ${w.week}`,
        "red"
      )
    );
  }

  if (r.biggestBlowout) {
    const g = r.biggestBlowout;
    cards.push(
      recordCard(
        "Biggest blowout",
        `+${fmt2(g.margin)}`,
        `${esc(g.winner)} over ${esc(g.loser)}`,
        `${esc(g.season)} · Week ${g.week} · ${fmt1(g.winnerPoints)}–${fmt1(g.loserPoints)}`
      )
    );
  }

  if (r.closestGame) {
    const g = r.closestGame;
    cards.push(
      recordCard(
        "Closest game",
        fmt2(g.margin),
        `${esc(g.winner)} over ${esc(g.loser)}`,
        `${esc(g.season)} · Week ${g.week} · ${fmt1(g.winnerPoints)}–${fmt1(g.loserPoints)}`
      )
    );
  }

  if (r.highestScoringGame) {
    const g = r.highestScoringGame;
    cards.push(
      recordCard(
        "Highest scoring matchup",
        fmt1(g.total),
        `${esc(g.winner)} vs ${esc(g.loser)}`,
        `${esc(g.season)} · Week ${g.week} · ${fmt1(g.winnerPoints)}–${fmt1(g.loserPoints)}`,
        "blue"
      )
    );
  }

  if (r.bestRecord) {
    const s = r.bestRecord;
    cards.push(
      recordCard(
        "Best regular season",
        esc(s.record),
        esc(s.manager),
        `${esc(s.season)} · ${fmt1(s.points)} pts`,
        "green"
      )
    );
  }

  if (r.worstRecord) {
    const s = r.worstRecord;
    cards.push(
      recordCard(
        "Worst regular season",
        esc(s.record),
        esc(s.manager),
        `${esc(s.season)} · ${fmt1(s.points)} pts`,
        "red"
      )
    );
  }

  html(
    "#records",
    cards.length
      ? `<div class="grid grid-3">${cards.join("")}</div>`
      : empty("Not enough game data yet to set any records.")
  );
}

/* --------------------------------------------------------- sortable table -- */

/**
 * Render a sortable table. `columns` describe how to read, display, and sort
 * each field; sorting re-renders the body only.
 */
function sortableTable(mount, columns, rows, initialKey, initialDir = "asc") {
  let sortKey = initialKey;
  let sortDir = initialDir;

  const compare = (a, b) => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return 0;
    const av = col.sortValue ? col.sortValue(a) : col.value(a);
    const bv = col.sortValue ? col.sortValue(b) : col.value(b);

    // Push blanks to the bottom regardless of direction.
    const aBad = av == null || (typeof av === "number" && !Number.isFinite(av));
    const bBad = bv == null || (typeof bv === "number" && !Number.isFinite(bv));
    if (aBad && bBad) return 0;
    if (aBad) return 1;
    if (bBad) return -1;

    const cmp =
      typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  };

  const draw = () => {
    const sorted = [...rows].sort(compare);
    mount.innerHTML = `<div class="table-wrap"><table>
      <thead><tr>
        <th class="rank" scope="col">#</th>
        ${columns
          .map(
            (c) =>
              `<th scope="col" class="sortable${c.numeric ? " num" : ""}" data-key="${esc(
                c.key
              )}"${
                c.key === sortKey
                  ? ` aria-sort="${sortDir === "asc" ? "ascending" : "descending"}"`
                  : ""
              }${c.title ? ` title="${esc(c.title)}"` : ""}>${esc(c.label)}</th>`
          )
          .join("")}
      </tr></thead>
      <tbody>
        ${sorted
          .map(
            (row, i) =>
              `<tr><td class="rank">${i + 1}</td>${columns
                .map(
                  (c) =>
                    `<td${c.numeric ? ' class="num"' : ""}>${
                      c.render ? c.render(row) : esc(c.value(row))
                    }</td>`
                )
                .join("")}</tr>`
          )
          .join("")}
      </tbody>
    </table></div>`;

    mount.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        if (key === sortKey) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = key;
          const col = columns.find((c) => c.key === key);
          sortDir = col?.defaultDir || (col?.numeric ? "desc" : "asc");
        }
        draw();
      });
    });
  };

  draw();
}

function renderManagers(stats) {
  const mount = $("#managers");
  const rows = stats.managers;

  if (!rows.length) {
    html(mount, empty("No manager history found yet."));
    return;
  }

  const rings = (m) =>
    m.titles > 0
      ? `<span class="rings" title="${m.titles} championship${
          m.titles === 1 ? "" : "s"
        }">${"🏆".repeat(Math.min(m.titles, 6))}${
          m.titles > 6 ? ` ×${m.titles}` : ""
        }</span>`
      : `<span class="rings dim">—</span>`;

  sortableTable(
    mount,
    [
      {
        key: "name",
        label: "Manager",
        value: (m) => m.name,
        render: (m) =>
          `<div class="who">${avatarImg(m.avatar, m.name)}<span><strong>${esc(
            m.name
          )}</strong>${
            m.teamName ? `<small>${esc(m.teamName)}</small>` : ""
          }</span></div>`,
      },
      {
        key: "avgFinish",
        label: "Avg finish",
        numeric: true,
        defaultDir: "asc",
        title: "Average final placement across completed seasons — lower is better",
        value: (m) => m.avgFinish,
        render: (m) => (Number.isFinite(m.avgFinish) ? fmt2(m.avgFinish) : "—"),
      },
      {
        key: "titles",
        label: "Titles",
        numeric: true,
        value: (m) => m.titles,
        render: rings,
      },
      {
        key: "record",
        label: "All-time record",
        numeric: true,
        sortValue: (m) => m.winPct,
        value: (m) => `${m.wins}-${m.losses}${m.ties ? `-${m.ties}` : ""}`,
      },
      {
        key: "winPct",
        label: "Win %",
        numeric: true,
        value: (m) => m.winPct,
        render: (m) => pct(m.winPct),
      },
      {
        key: "playoffApps",
        label: "Playoffs",
        numeric: true,
        title: "Seasons finishing inside the playoff field",
        value: (m) => m.playoffApps,
        render: (m) => `${m.playoffApps}/${m.completedSeasons}`,
        sortValue: (m) =>
          m.completedSeasons ? m.playoffApps / m.completedSeasons : -1,
      },
      {
        key: "pointsFor",
        label: "Points for",
        numeric: true,
        value: (m) => m.pointsFor,
        render: (m) => fmt1(m.pointsFor),
      },
      {
        key: "pointsPerGame",
        label: "PPG",
        numeric: true,
        value: (m) => m.pointsPerGame,
        render: (m) => fmt1(m.pointsPerGame),
      },
      {
        key: "bestFinish",
        label: "Best",
        numeric: true,
        defaultDir: "asc",
        value: (m) => m.bestFinish,
        render: (m) => (m.bestFinish ? ordinal(m.bestFinish) : "—"),
      },
      {
        key: "seasons",
        label: "Seasons",
        numeric: true,
        value: (m) => m.seasons,
        render: (m) =>
          `${m.seasons}<br><small style="color:var(--text-faint)">${esc(
            m.firstSeason
          )}–${esc(m.lastSeason)}</small>`,
      },
    ],
    rows,
    "avgFinish",
    "asc"
  );
}

function renderSeasons(stats) {
  const rows = stats.seasons.map((season) => {
    const standings = seasonStandings(season);
    const name = (t) =>
      t ? stats.directory.get(t.ownerId)?.name || "Former manager" : "—";

    const champ = standings.find((t) => t.place === 1);
    const runnerUp = standings.find((t) => t.place === 2);
    const last = standings[standings.length - 1];
    const topScorer = [...standings].sort((a, b) => b.pointsFor - a.pointsFor)[0];

    return {
      season: season.season,
      complete: season.complete,
      teams: standings.length,
      champion: season.complete ? name(champ) : null,
      runnerUp: season.complete ? name(runnerUp) : null,
      last: season.complete ? name(last) : null,
      topScorer: name(topScorer),
      topPoints: topScorer?.pointsFor ?? NaN,
    };
  });

  html(
    "#seasons",
    `<div class="table-wrap"><table>
      <thead><tr>
        <th scope="col">Season</th>
        <th scope="col">Champion</th>
        <th scope="col">Runner-up</th>
        <th scope="col">Points title</th>
        <th scope="col">Last place</th>
        <th scope="col" class="num">Teams</th>
      </tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
          <td><strong>${esc(r.season)}</strong>${
              r.complete
                ? ""
                : ' <span class="pill green">in progress</span>'
            }</td>
          <td>${
            r.champion
              ? `<span class="pill gold">🏆 ${esc(r.champion)}</span>`
              : '<span style="color:var(--text-faint)">TBD</span>'
          }</td>
          <td>${r.runnerUp ? esc(r.runnerUp) : "—"}</td>
          <td>${esc(r.topScorer)} <small style="color:var(--text-faint)">${fmt1(
              r.topPoints
            )}</small></td>
          <td>${
            r.last
              ? `<span style="color:var(--text-dim)">${esc(r.last)}</span>`
              : "—"
          }</td>
          <td class="num">${r.teams}</td>
        </tr>`
          )
          .join("")}
      </tbody>
    </table></div>`
  );
}

function renderLeaderboards(stats) {
  const { topWeeks, topSeasons } = stats.records;

  const list = (title, items, render) =>
    `<div class="card">
      <h3 style="font-size:1.05rem;margin-bottom:14px">${esc(title)}</h3>
      <ol style="margin:0;padding-left:0;list-style:none">
        ${items
          .map(
            (item, i) => `<li style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line-soft)">
              <span style="color:var(--text-dim);overflow-wrap:anywhere"><span style="font-family:var(--mono);color:var(--text-faint);font-size:.8rem;margin-right:8px">${
                i + 1
              }</span>${render.who(item)}</span>
              <span style="font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap">${render.val(
                item
              )}</span>
            </li>`
          )
          .join("")}
      </ol>
    </div>`;

  const parts = [];

  if (topWeeks.length) {
    parts.push(
      list("Top 10 single-week scores", topWeeks, {
        who: (w) =>
          `<strong style="color:var(--text)">${esc(w.manager)}</strong> <small style="color:var(--text-faint)">${esc(
            w.season
          )} wk ${w.week}</small>`,
        val: (w) => fmt2(w.points),
      })
    );
  }

  if (topSeasons.length) {
    parts.push(
      list("Top 10 scoring seasons", topSeasons, {
        who: (s) =>
          `<strong style="color:var(--text)">${esc(s.manager)}</strong> <small style="color:var(--text-faint)">${esc(
            s.season
          )}</small>`,
        val: (s) => fmt1(s.points),
      })
    );
  }

  html(
    "#leaderboards",
    parts.length ? `<div class="grid grid-2">${parts.join("")}</div>` : ""
  );
}

/* ------------------------------------------------------------------ boot -- */

async function main() {
  renderChrome("index.html");

  const { league = {}, sleeper = {} } = cfg();
  $("#hero-title").textContent = league.name || "The League";
  if (league.tagline) $("#hero-lede").textContent = league.tagline;

  const content = $("#content");
  const loader = $("#loader");

  if (!sleeper.leagueId) {
    loader.classList.add("hidden");
    html("#notice", setupNotice());
    return;
  }

  const bar = $("#progress-bar");
  const status = $("#progress-status");

  try {
    const { seasons } = await loadHistory(({ done, total, label }) => {
      if (status) status.textContent = label;
      if (bar && total) {
        bar.style.width = `${Math.max(8, Math.round((done / total) * 100))}%`;
      }
    });

    if (!seasons.length) throw new ConfigError("No seasons came back from Sleeper.");

    const stats = buildLeagueStats(seasons);

    renderHeadline(stats);
    renderChampions(stats);
    renderRecords(stats);
    renderManagers(stats);
    renderSeasons(stats);
    renderLeaderboards(stats);

    loader.classList.add("hidden");
    content.classList.remove("hidden");
  } catch (err) {
    loader.classList.add("hidden");
    html("#notice", err instanceof ConfigError ? setupNotice() : errorNotice(err));
    console.error(err);
  }
}

main();
