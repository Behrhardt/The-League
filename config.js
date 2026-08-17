/* ============================================================================
 * THE LEAGUE — SITE CONFIGURATION
 * ----------------------------------------------------------------------------
 * This is the only file you need to edit. Everything on the site reads from it.
 * It is plain JavaScript: keep the quotes, commas, and brackets as they are.
 *
 * QUICK START
 *   1. Set `sleeper.leagueId` below to your MOST RECENT season's league ID.
 *      Find it in the URL when you're on Sleeper in a browser:
 *      https://sleeper.com/leagues/1234567890123456789/team  <-- that number
 *      The site walks backwards through every prior season automatically.
 *   2. Fill in the `dues`, `draft`, and `calendar` sections.
 *   3. Edit the `rules` section to match your league.
 * ==========================================================================*/

window.LEAGUE_CONFIG = {
  /* --------------------------------------------------------------------------
   * 1. IDENTITY
   * ------------------------------------------------------------------------*/
  league: {
    name: "The League",
    tagline: "Est. 2018 · 12 teams · one trophy",
    // Shown in the footer. Leave blank ("") to hide.
    commissioner: "",
    commissionerContact: "", // email or phone, shown on the dues page
  },

  /* --------------------------------------------------------------------------
   * 2. SLEEPER CONNECTION
   * ------------------------------------------------------------------------*/
  sleeper: {
    // REQUIRED. Your most recent season's league ID (see Quick Start above).
    leagueId: "1384912777046417408",

    // How far back to walk. Sleeper links each season to the one before it via
    // `previous_league_id`. Raise this if your league is older than 20 seasons.
    maxSeasons: 20,

    // Minutes to cache the *current* season's data in the browser. Completed
    // seasons never change, so they're cached for a year.
    currentSeasonCacheMinutes: 30,
  },

  /* --------------------------------------------------------------------------
   * 3. DUES & PAYOUTS
   * ------------------------------------------------------------------------*/
  dues: {
    amount: 100,             // per team, in dollars
    currency: "$",
    dueDate: "2026-08-28",   // YYYY-MM-DD. Used for the countdown.
    dueDateNote: "Before the draft. No money, no draft slot — no exceptions.",

    // Where the money goes. Percentages are optional; if you use dollar amounts
    // just write them in the `amount` field as text.
    payouts: [
      { place: "1st — Champion",        amount: "$700", note: "Plus the trophy for the year." },
      { place: "2nd — Runner-up",       amount: "$300", note: "" },
      { place: "3rd",                   amount: "$150", note: "" },
      { place: "Most points, reg. season", amount: "$50", note: "Consolation for the unlucky." },
      { place: "Last place",            amount: "Punishment", note: "See the rules page." },
    ],

    // Payment methods. Delete any you don't use. `handle` is what members type
    // into the app; `link` (optional) makes the card clickable.
    methods: [
      { name: "Venmo",   handle: "@your-venmo",           link: "https://venmo.com/u/your-venmo", note: "Mark it as a purchase of goods? No. Friends and family." },
      { name: "Zelle",   handle: "commissioner@email.com", link: "",                              note: "Fastest — hits the account instantly." },
      { name: "PayPal",  handle: "@your-paypal",          link: "",                              note: "Friends & family only, or the fee comes out of your pot." },
      { name: "Cash",    handle: "In person",             link: "",                              note: "At the draft, exact amount." },
    ],

    memoLine: "Put your team name in the memo. Untagged payments are a nightmare to reconcile.",

    // Optional: track who has paid. Add a line per team and flip `paid` to true
    // as money comes in. While this list is empty the whole "Who's paid"
    // section stays hidden, so it never shows placeholder names to the league.
    //
    //   { team: "Team name", manager: "Manager name", paid: false },
    //
    roster: [],
  },

  /* --------------------------------------------------------------------------
   * 4. DRAFT
   * ------------------------------------------------------------------------*/
  draft: {
    // YYYY-MM-DDTHH:MM in 24h local time. Drives the countdown clock.
    datetime: "2026-08-30T19:00",
    timezoneLabel: "ET",
    location: "Mike's basement — 123 Example St.",
    locationLink: "",           // optional Google Maps URL
    format: "Snake, 12 rounds",
    orderMethod: "Randomized live on Sleeper 30 minutes before we start.",
    pickClock: "90 seconds",
    notes: [
      "Doors open an hour early. Food and drinks are covered by the league.",
      "If you can't make it in person, join the Sleeper room — but you're still on the clock.",
      "Set your queue beforehand. Autodraft is not a strategy anyone will feel bad about.",
    ],
  },

  /* --------------------------------------------------------------------------
   * 5. KEY DATES
   * Anything you want on the calendar. Past dates dim automatically.
   * ------------------------------------------------------------------------*/
  calendar: [
    { date: "2026-08-28", label: "Dues deadline",            detail: "Paid in full or your seat opens up." },
    { date: "2026-08-30", label: "Draft night",              detail: "7:00 PM ET" },
    { date: "2026-09-10", label: "Week 1 kickoff",           detail: "Lineups lock at first game." },
    { date: "2026-10-28", label: "Trade deadline",           detail: "11:59 PM ET, no extensions." },
    { date: "2026-12-16", label: "Playoffs begin",           detail: "Top 6 teams." },
    { date: "2026-12-30", label: "Championship week ends",   detail: "Trophy engraved shortly after." },
  ],

  /* --------------------------------------------------------------------------
   * 6. RULES
   * Each section becomes a card on the rules page. Add, remove, or reorder
   * freely. `items` are bullet points. Keep them short and unambiguous —
   * the whole point is to stop the questions.
   * ------------------------------------------------------------------------*/
  rules: {
    // Shown at the top of the rules page as the "one rule to rule them all".
    preamble:
      "Commissioner decisions are final. Anything not covered here gets settled by a majority vote of active managers. Play to win every week — collusion or tanking gets you removed.",

    // Live league settings (roster slots, scoring, playoff format) are pulled
    // straight from Sleeper and shown above these sections, so you never have
    // to keep two copies of the scoring rules in sync.
    showLiveSettings: true,

    sections: [
      {
        title: "Roster & Lineups",
        icon: "roster",
        items: [
          "Starting lineups lock individually at each player's kickoff.",
          "You are responsible for your own lineup. Forgotten lineups are not reversible and not appealable.",
          "Any team that starts an inactive player two weeks in a row gets a warning; three times and the commissioner may take over lineup duty.",
        ],
      },
      {
        title: "Waivers & Free Agency",
        icon: "waiver",
        items: [
          "Waivers run Wednesday at 3:00 AM ET.",
          "FAAB budget resets each season and does not roll over.",
          "A $0 bid is legal. Ties go to the team with the worse record.",
          "After waivers clear, remaining players are free agents on a first-come basis until the next lock.",
        ],
      },
      {
        title: "Trades",
        icon: "trade",
        items: [
          "Trades process immediately — there is no league-wide veto.",
          "The commissioner will reverse a trade only for clear collusion, never for being lopsided.",
          "Trade deadline is listed on the dues & dates page. Nothing processes after it.",
          "Trading future dues, draft picks for cash, or anything outside the game is prohibited.",
        ],
      },
      {
        title: "Playoffs & Tiebreakers",
        icon: "trophy",
        items: [
          "Seeding: record first, then total points for, then head-to-head.",
          "Regular-season ties in a matchup are broken by bench points; if still tied, it stands as a tie.",
          "Playoff matchups cannot end in a tie — highest bench score advances.",
          "The top two seeds get a first-round bye.",
        ],
      },
      {
        title: "Dues, Payouts & Punishment",
        icon: "money",
        items: [
          "Dues are due before the draft. Unpaid teams do not draft.",
          "Payouts are sent within one week of the championship.",
          "Last place is determined by regular-season standings, not the consolation bracket.",
          "The last-place punishment is decided by league vote at the draft each year and is non-negotiable once set.",
        ],
      },
      {
        title: "Keeping Your Spot",
        icon: "seat",
        items: [
          "Returning managers get first refusal on their spot each offseason.",
          "Abandoning your team mid-season (no lineup changes for three consecutive weeks) forfeits your spot for next year.",
          "Replacement managers are found by the commissioner and approved by majority vote.",
        ],
      },
    ],
  },
};
