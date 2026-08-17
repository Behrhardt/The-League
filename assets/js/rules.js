/* Renders the rules page: hand-written rules from config, plus the live league
 * settings from Sleeper so the scoring table never has to be maintained twice.
 */

import { currentLeague } from "./sleeper.js";
import { $, cfg, esc, html, icon, renderChrome } from "./site.js";

/* ------------------------------------------------- roster slot rendering -- */

const SLOT_LABELS = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "D/ST",
  DL: "DL",
  LB: "LB",
  DB: "DB",
  IDP_FLEX: "IDP Flex",
  FLEX: "Flex (RB/WR/TE)",
  WRRB_FLEX: "Flex (RB/WR)",
  REC_FLEX: "Flex (WR/TE)",
  SUPER_FLEX: "Superflex (QB/RB/WR/TE)",
  BN: "Bench",
  IR: "IR",
  TAXI: "Taxi",
};

function renderSlots(positions = []) {
  if (!positions.length) return "";

  // Collapse repeats: three WR slots read better as "WR ×3".
  const counts = new Map();
  for (const p of positions) counts.set(p, (counts.get(p) || 0) + 1);

  const chip = (pos, n) => {
    const label = SLOT_LABELS[pos] || pos;
    const cls =
      pos === "BN" || pos === "IR" || pos === "TAXI"
        ? "bench"
        : pos.includes("FLEX")
        ? "flex"
        : "start";
    return `<span class="slot ${cls}">${esc(label)}${n > 1 ? ` ×${n}` : ""}</span>`;
  };

  const starters = [...counts].filter(([p]) => !["BN", "IR", "TAXI"].includes(p));
  const reserves = [...counts].filter(([p]) => ["BN", "IR", "TAXI"].includes(p));
  const startCount = starters.reduce((s, [, n]) => s + n, 0);

  return `<div class="card">
    <h3 style="font-size:1.05rem;margin-bottom:4px">Roster</h3>
    <p style="color:var(--text-faint);font-size:.85rem;margin-bottom:14px">${startCount} starters out of ${positions.length} roster spots.</p>
    <div class="slot-row">${starters.map(([p, n]) => chip(p, n)).join("")}</div>
    ${
      reserves.length
        ? `<div class="slot-row" style="margin-top:10px">${reserves
            .map(([p, n]) => chip(p, n))
            .join("")}</div>`
        : ""
    }
  </div>`;
}

/* ----------------------------------------------------- scoring rendering -- */

const SCORING = {
  // Passing
  pass_yd: ["Passing", "Per passing yard"],
  pass_td: ["Passing", "Passing TD"],
  pass_int: ["Passing", "Interception thrown"],
  pass_2pt: ["Passing", "2-pt pass"],
  pass_sack: ["Passing", "Sack taken"],
  bonus_pass_yd_300: ["Passing", "300+ yard game"],
  bonus_pass_yd_400: ["Passing", "400+ yard game"],
  // Rushing
  rush_yd: ["Rushing", "Per rushing yard"],
  rush_td: ["Rushing", "Rushing TD"],
  rush_2pt: ["Rushing", "2-pt rush"],
  rush_att: ["Rushing", "Per carry"],
  bonus_rush_yd_100: ["Rushing", "100+ yard game"],
  bonus_rush_yd_200: ["Rushing", "200+ yard game"],
  // Receiving
  rec: ["Receiving", "Per reception"],
  rec_yd: ["Receiving", "Per receiving yard"],
  rec_td: ["Receiving", "Receiving TD"],
  rec_2pt: ["Receiving", "2-pt reception"],
  bonus_rec_te: ["Receiving", "TE reception bonus"],
  bonus_rec_yd_100: ["Receiving", "100+ yard game"],
  bonus_rec_yd_200: ["Receiving", "200+ yard game"],
  // Misc offense
  fum_lost: ["Misc", "Fumble lost"],
  fum: ["Misc", "Fumble"],
  fum_rec_td: ["Misc", "Fumble recovery TD"],
  st_td: ["Misc", "Special teams TD"],
  st_ff: ["Misc", "Special teams FF"],
  st_fum_rec: ["Misc", "Special teams fumble rec"],
  // Kicking
  xpm: ["Kicking", "Extra point"],
  xpmiss: ["Kicking", "Missed XP"],
  fgm: ["Kicking", "Field goal"],
  fgmiss: ["Kicking", "Missed FG"],
  fgm_0_19: ["Kicking", "FG 0–19"],
  fgm_20_29: ["Kicking", "FG 20–29"],
  fgm_30_39: ["Kicking", "FG 30–39"],
  fgm_40_49: ["Kicking", "FG 40–49"],
  fgm_50p: ["Kicking", "FG 50+"],
  // Defense
  def_td: ["Defense", "Defensive TD"],
  def_st_td: ["Defense", "D/ST TD"],
  def_st_ff: ["Defense", "D/ST forced fumble"],
  def_st_fum_rec: ["Defense", "D/ST fumble recovery"],
  sack: ["Defense", "Sack"],
  int: ["Defense", "Interception"],
  ff: ["Defense", "Forced fumble"],
  fum_rec: ["Defense", "Fumble recovery"],
  safe: ["Defense", "Safety"],
  blk_kick: ["Defense", "Blocked kick"],
  def_2pt: ["Defense", "2-pt return"],
  pts_allow_0: ["Points allowed", "0 points"],
  pts_allow_1_6: ["Points allowed", "1–6"],
  pts_allow_7_13: ["Points allowed", "7–13"],
  pts_allow_14_20: ["Points allowed", "14–20"],
  pts_allow_21_27: ["Points allowed", "21–27"],
  pts_allow_28_34: ["Points allowed", "28–34"],
  pts_allow_35p: ["Points allowed", "35+"],
};

const GROUP_ORDER = [
  "Passing",
  "Rushing",
  "Receiving",
  "Kicking",
  "Defense",
  "Points allowed",
  "Misc",
];

function renderScoring(scoring = {}) {
  const groups = new Map();

  for (const [key, raw] of Object.entries(scoring)) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) continue; // zeroed rules are noise

    const [group, label] = SCORING[key] || ["Other", key];
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ label, value });
  }

  if (!groups.size) return "";

  const ordered = [...groups.entries()].sort(
    (a, b) =>
      (GROUP_ORDER.indexOf(a[0]) + 1 || 99) - (GROUP_ORDER.indexOf(b[0]) + 1 || 99)
  );

  const num = (v) => {
    const s = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
    return v > 0 ? `+${s}` : s;
  };

  return `<div class="card">
    <h3 style="font-size:1.05rem;margin-bottom:14px">Scoring</h3>
    ${ordered
      .map(
        ([group, items]) => `
      <div style="margin-bottom:18px">
        <div class="stat-label" style="margin-bottom:8px">${esc(group)}</div>
        <div class="scoring-grid">
          ${items
            .map(
              (i) =>
                `<div class="scoring-item"><span class="k">${esc(
                  i.label
                )}</span><span class="v ${i.value > 0 ? "pos" : "neg"}">${esc(
                  num(i.value)
                )}</span></div>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("")}
  </div>`;
}

/* ------------------------------------------------------ format rendering -- */

const LEAGUE_TYPES = { 0: "Redraft", 1: "Keeper", 2: "Dynasty" };

function renderFormat(lg) {
  const s = lg.settings || {};
  const facts = [];

  const add = (label, value) => {
    if (value != null && value !== "") facts.push([label, value]);
  };

  add("Season", lg.season);
  add("Teams", lg.total_rosters);
  add("League type", LEAGUE_TYPES[s.type]);
  add("Playoff teams", s.playoff_teams);
  add("Playoffs start", s.playoff_week_start ? `Week ${s.playoff_week_start}` : null);
  add("Trade deadline", s.trade_deadline ? `Week ${s.trade_deadline}` : null);
  add("FAAB budget", s.waiver_budget ? `$${s.waiver_budget}` : null);
  add(
    "Waivers clear",
    s.waiver_clear_days ? `${s.waiver_clear_days} day${s.waiver_clear_days === 1 ? "" : "s"}` : null
  );
  add("Max keepers", s.max_keepers > 1 ? s.max_keepers : null);

  if (!facts.length) return "";

  return `<div class="card">
    <h3 style="font-size:1.05rem;margin-bottom:14px">Format</h3>
    <div style="display:grid;gap:9px">
      ${facts
        .map(
          ([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;border-bottom:1px solid var(--line-soft);padding-bottom:8px">
            <span style="color:var(--text-dim)">${esc(k)}</span>
            <strong style="font-variant-numeric:tabular-nums">${esc(v)}</strong>
          </div>`
        )
        .join("")}
    </div>
  </div>`;
}

/* -------------------------------------------------------- written rules -- */

function renderWrittenRules(rules) {
  const sections = rules.sections || [];

  if (!sections.length) {
    html("#rules", `<div class="card">No rules configured yet. Add them in <code>config.js</code>.</div>`);
    return;
  }

  html(
    "#rules",
    sections
      .map(
        (s) => `<section class="card rule-card">
        <h3><span class="ico">${icon(s.icon || "book", 17)}</span>${esc(s.title)}</h3>
        <ol>${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ol>
      </section>`
      )
      .join("")
  );

  if (rules.preamble) {
    html(
      "#preamble",
      `<strong>Before anything else.</strong> ${esc(rules.preamble)}`
    );
    $("#preamble-section").classList.remove("hidden");
  }
}

/* ------------------------------------------------------------------ boot -- */

async function main() {
  renderChrome("rules.html");

  const { rules = {}, sleeper = {} } = cfg();
  renderWrittenRules(rules);

  // Live settings are a bonus: if Sleeper is unreachable or unconfigured, the
  // written rules above still stand on their own.
  if (rules.showLiveSettings === false || !sleeper.leagueId) return;

  try {
    const lg = await currentLeague();
    const cards = [
      renderFormat(lg),
      renderSlots(lg.roster_positions),
      renderScoring(lg.scoring_settings),
    ].filter(Boolean);

    if (!cards.length) return;

    html("#settings", `<div class="grid grid-3 grid-start">${cards.join("")}</div>`);
    $("#settings-section").classList.remove("hidden");
  } catch (err) {
    console.warn("Live league settings unavailable:", err);
  }
}

main();
