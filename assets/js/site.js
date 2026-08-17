/* Shared helpers: DOM building, escaping, dates, icons, chrome. */

export const cfg = () => window.LEAGUE_CONFIG || {};

/* ------------------------------------------------------------------- DOM -- */

export const $ = (sel, root = document) => root.querySelector(sel);

/** Escape anything headed for innerHTML. Team names are user-supplied. */
export function esc(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function html(target, markup) {
  const el = typeof target === "string" ? $(target) : target;
  if (el) el.innerHTML = markup;
  return el;
}

/* ----------------------------------------------------------------- dates -- */

/** Parse YYYY-MM-DD (or with THH:MM) as *local* time, not UTC. */
export function parseLocal(value) {
  if (!value) return null;
  const m = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/
  );
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0"] = m;
  const date = new Date(+y, +mo - 1, +d, +h, +mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, opts = {}) {
  const d = parseLocal(value);
  if (!d) return String(value ?? "");
  return d.toLocaleDateString(undefined, {
    weekday: opts.weekday ? "long" : undefined,
    month: "short",
    day: "numeric",
    year: opts.year === false ? undefined : "numeric",
  });
}

export function formatDateTime(value) {
  const d = parseLocal(value);
  if (!d) return String(value ?? "");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const isPast = (value) => {
  const d = parseLocal(value);
  return d ? d < startOfToday() : false;
};

export function daysUntil(value) {
  const d = parseLocal(value);
  if (!d) return null;
  return Math.ceil((d - startOfToday()) / 86400000);
}

/* -------------------------------------------------------------- countdown -- */

/** Live countdown to a target date. Returns a stop() function. */
export function countdown(el, target, { onDone } = {}) {
  const date = parseLocal(target);
  if (!el || !date) return () => {};

  const units = [
    ["days", 86400000],
    ["hours", 3600000],
    ["minutes", 60000],
    ["seconds", 1000],
  ];

  const tick = () => {
    let remaining = date - Date.now();
    if (remaining <= 0) {
      el.innerHTML = `<div class="cd-unit" style="min-width:auto"><div class="cd-num" style="font-size:1.15rem">${esc(
        onDone || "It's here."
      )}</div></div>`;
      clearInterval(timer);
      return;
    }
    el.innerHTML = units
      .map(([label, ms]) => {
        const v = Math.floor(remaining / ms);
        remaining -= v * ms;
        return `<div class="cd-unit"><div class="cd-num">${v}</div><div class="cd-label">${label}</div></div>`;
      })
      .join("");
  };

  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

/* ----------------------------------------------------------------- icons -- */

const ICONS = {
  trophy: `<path d="M6 3h12v4a6 6 0 0 1-12 0V3Z"/><path d="M6 5H3.5A2.5 2.5 0 0 0 6 9.5M18 5h2.5A2.5 2.5 0 0 1 18 9.5"/><path d="M12 13v4M8.5 21h7M10 17h4l.5 4h-5l.5-4Z"/>`,
  roster: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/>`,
  waiver: `<path d="M3 6h18M3 12h12M3 18h6"/><path d="m17 14 4 4-4 4"/>`,
  trade: `<path d="m17 2 4 4-4 4"/><path d="M3 6h18"/><path d="m7 22-4-4 4-4"/><path d="M21 18H3"/>`,
  money: `<circle cx="12" cy="12" r="9"/><path d="M14.5 9.5a2.5 2.5 0 0 0-2.5-1.5c-1.4 0-2.5.7-2.5 2s1.1 1.8 2.5 2 2.5.6 2.5 2-1.1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5M12 6.5v11"/>`,
  seat: `<path d="M7 3h10v7H7zM5 10h14v6H5zM7 16v5M17 16v5"/>`,
  calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
  scale: `<path d="M12 3v18M7 21h10"/><path d="m5 7 -3 7h6l-3-7ZM19 7l-3 7h6l-3-7Z"/><path d="M5 7h14"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  book: `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>`,
};

export function icon(name, size = 24) {
  const body = ICONS[name] || ICONS.trophy;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

/* ---------------------------------------------------------------- chrome -- */

const PAGES = [
  { href: "index.html", label: "League History" },
  { href: "dues.html", label: "Dues & Dates" },
  { href: "rules.html", label: "Rules" },
];

export function renderChrome(activeHref) {
  const { league = {} } = cfg();
  const name = league.name || "The League";

  document.title = document.title.replace("{league}", name);

  html(
    "#site-header",
    `<div class="wrap nav">
      <a class="brand" href="index.html">
        <span class="brand-mark">${icon("trophy", 18)}</span>
        <span>${esc(name)}</span>
      </a>
      <nav class="nav-links" aria-label="Main">
        ${PAGES.map(
          (p) =>
            `<a href="${p.href}"${
              p.href === activeHref ? ' aria-current="page"' : ""
            }>${esc(p.label)}</a>`
        ).join("")}
      </nav>
    </div>`
  );

  const commish = league.commissioner
    ? `Commissioner: ${esc(league.commissioner)}`
    : "";

  html(
    "#site-footer",
    `<div class="wrap">
      <div>${esc(name)}${commish ? ` · ${commish}` : ""}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span>Stats via the Sleeper API</span>
        <button class="ghost-btn" id="refresh-data" type="button" title="Clear the local cache and reload from Sleeper">Refresh data</button>
      </div>
    </div>`
  );

  const btn = $("#refresh-data");
  if (btn) {
    btn.addEventListener("click", async () => {
      const { clearCache } = await import("./sleeper.js");
      clearCache();
      location.reload();
    });
  }
}

/** Shown on every page when config.js has no league ID yet. */
export function setupNotice() {
  return `<div class="notice">
    <h3>Almost there — add your Sleeper league ID</h3>
    <p>This site reads your league history straight from Sleeper. It needs to know which league is yours.</p>
    <ol>
      <li>Open your league on Sleeper in a web browser.</li>
      <li>Copy the long number out of the address bar: <code>sleeper.com/leagues/<strong>1234567890123456789</strong>/team</code></li>
      <li>Paste it into <code>config.js</code> as <code>sleeper.leagueId</code>, using your most recent season.</li>
    </ol>
    <p style="margin-top:12px">Every earlier season is found automatically from there — you only ever set this once a year.</p>
  </div>`;
}

export function errorNotice(err) {
  return `<div class="notice error">
    <h3>Couldn't load league data</h3>
    <p>${esc(err?.message || String(err))}</p>
    <p>Check the league ID in <code>config.js</code>, confirm you're online, then hit <strong>Refresh data</strong> in the footer.</p>
  </div>`;
}
