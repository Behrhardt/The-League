/* Sleeper API client.
 *
 * Sleeper's read API is public and unauthenticated, and it sends
 * Access-Control-Allow-Origin: *, so the browser can call it directly. There is
 * no key to leak and nothing to proxy.
 *
 * Responses are cached in localStorage. Completed seasons never change, so they
 * are cached for a year; the in-progress season uses a short TTL from config.
 */

const API = "https://api.sleeper.app/v1";
const CACHE_PREFIX = "league-site:v1:";
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const cfg = () => window.LEAGUE_CONFIG || {};

/* ---------------------------------------------------------------- caching -- */

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.exp !== "number") return null;
    if (Date.now() > entry.exp) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.val;
  } catch {
    return null;
  }
}

function cacheSet(key, val, ttlMs) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ exp: Date.now() + ttlMs, val })
    );
  } catch {
    // Quota exceeded, or storage disabled (private mode / file://).
    // The site works fine uncached, so this is deliberately silent.
  }
}

export function clearCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nothing we can do */
  }
}

/* --------------------------------------------------------------- fetching -- */

async function getJSON(path, ttlMs) {
  const cached = cacheGet(path);
  if (cached !== null) return cached;

  const res = await fetch(`${API}${path}`);
  if (res.status === 404) return null; // Sleeper uses 404 for "no such league"
  if (!res.ok) throw new Error(`Sleeper API ${res.status} on ${path}`);

  const val = await res.json();
  if (val !== null) cacheSet(path, val, ttlMs);
  return val;
}

/** Run async tasks with a concurrency cap so we don't open 60 sockets at once. */
async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------------------------------------- endpoints -- */

export const nflState = () => getJSON("/state/nfl", 60 * 60 * 1000);

const league = (id, ttl) => getJSON(`/league/${id}`, ttl);
const rosters = (id, ttl) => getJSON(`/league/${id}/rosters`, ttl);
const users = (id, ttl) => getJSON(`/league/${id}/users`, ttl);
const winnersBracket = (id, ttl) => getJSON(`/league/${id}/winners_bracket`, ttl);
const matchups = (id, week, ttl) => getJSON(`/league/${id}/matchups/${week}`, ttl);

export const avatarUrl = (id) =>
  id ? `https://sleepercdn.com/avatars/thumbs/${id}` : null;

/** Just the configured season's league object — used by the rules page. */
export async function currentLeague() {
  const { leagueId, currentSeasonCacheMinutes = 30 } = cfg().sleeper || {};
  if (!leagueId) throw new ConfigError("No Sleeper league ID configured.");

  const lg = await league(leagueId, Math.max(1, currentSeasonCacheMinutes) * 60 * 1000);
  if (!lg) {
    throw new ConfigError(
      `Sleeper has no league with ID "${leagueId}". Check the ID in config.js.`
    );
  }
  return lg;
}

/* --------------------------------------------------------- history loader -- */

/**
 * Walk the `previous_league_id` chain back from the configured league and
 * return one hydrated object per season, newest first.
 *
 * onProgress({done, total, label}) is called as work completes so the page can
 * show a real progress bar instead of a spinner that lies.
 */
export async function loadHistory(onProgress = () => {}) {
  const { leagueId, maxSeasons = 20, currentSeasonCacheMinutes = 30 } =
    cfg().sleeper || {};

  if (!leagueId) throw new ConfigError("No Sleeper league ID configured.");

  const shortTtl = Math.max(1, currentSeasonCacheMinutes) * 60 * 1000;

  // Phase 1: follow the chain. Sequential by necessity — each season names the
  // previous one. Uses the short TTL because we don't know yet which seasons
  // are complete.
  const leagues = [];
  let id = leagueId;
  let guard = 0;

  while (id && guard++ < maxSeasons) {
    onProgress({ done: leagues.length, total: maxSeasons, label: "Finding seasons…" });
    let lg;
    try {
      lg = await league(id, shortTtl);
    } catch (e) {
      if (leagues.length === 0) throw e; // couldn't even load the first one
      break; // partial history beats no history
    }
    if (!lg) {
      if (leagues.length === 0) {
        throw new ConfigError(
          `Sleeper has no league with ID "${id}". Check the ID in config.js.`
        );
      }
      break;
    }
    leagues.push(lg);
    id = lg.previous_league_id;
  }

  const state = await nflState().catch(() => null);

  // Phase 2: hydrate each season in parallel.
  let done = 0;
  const total = leagues.length;
  const seasons = await pool(leagues, 3, async (lg) => {
    const season = await hydrateSeason(lg, state, shortTtl);
    onProgress({ done: ++done, total, label: `Loading ${lg.season}…` });
    return season;
  });

  return { seasons, state };
}

async function hydrateSeason(lg, state, shortTtl) {
  const complete = lg.status === "complete";
  const ttl = complete ? YEAR_MS : shortTtl;
  const id = lg.league_id;

  const [rosterList, userList, bracket] = await Promise.all([
    rosters(id, ttl).catch(() => []),
    users(id, ttl).catch(() => []),
    winnersBracket(id, ttl).catch(() => []),
  ]);

  // Regular-season weeks only. Playoff weeks are full of byes and zeroes for
  // eliminated teams, which would poison the weekly high/low records.
  const playoffStart = lg.settings?.playoff_week_start || 15;
  let lastWeek = playoffStart - 1;

  // For a season still in progress, don't request weeks that haven't happened.
  if (!complete && state && String(state.season) === String(lg.season)) {
    lastWeek = Math.min(lastWeek, (state.week || 1) - 1);
  }

  const weeks = [];
  for (let w = 1; w <= lastWeek; w++) weeks.push(w);

  // A finished week is immutable even in a live season, so cache all but the
  // most recent one for a year.
  const weekData = await pool(weeks, 4, (w) =>
    matchups(id, w, complete || w < lastWeek ? YEAR_MS : shortTtl).catch(() => null)
  );

  return {
    leagueId: id,
    season: String(lg.season),
    name: lg.name,
    status: lg.status,
    complete,
    settings: lg.settings || {},
    scoringSettings: lg.scoring_settings || {},
    rosterPositions: lg.roster_positions || [],
    avatar: lg.avatar,
    rosters: rosterList || [],
    users: userList || [],
    bracket: bracket || [],
    playoffStart,
    weeks: weekData
      .map((teams, i) => ({ week: weeks[i], teams: teams || [] }))
      .filter((w) => w.teams.length > 0),
  };
}

export class ConfigError extends Error {}
