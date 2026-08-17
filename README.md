# The League

A three-page website for a Sleeper fantasy league:

| Page | What's on it |
| --- | --- |
| `index.html` | League history — champions by year, all-time records, manager standings |
| `dues.html` | Dues, payment methods, payouts, draft details, key dates |
| `rules.html` | The rulebook, plus live league settings pulled from Sleeper |

It's plain HTML, CSS, and JavaScript. No build step, no dependencies, no server
code, no API keys. League stats are read straight from Sleeper's public API in
the visitor's browser and computed on the fly, so the history page updates
itself every week without anyone touching it.

---

## Setup

### 1. Add your Sleeper league ID

Open `config.js` and set `sleeper.leagueId` to your **most recent** season's
league ID. Find it in the URL when you're viewing your league on Sleeper in a
web browser:

```
https://sleeper.com/leagues/1234567890123456789/team
                            ^^^^^^^^^^^^^^^^^^^ this part
```

```js
sleeper: {
  leagueId: "1234567890123456789",
  ...
}
```

Every earlier season is discovered automatically — Sleeper links each season to
the one before it. **You only update this once a year**, when you start a new
season.

### 2. Fill in the rest of `config.js`

Everything else on the dues and rules pages comes from that one file: dues
amount and deadline, payment handles, payout structure, draft details, key
dates, and the rulebook. It's commented throughout. Nothing else needs editing.

### 3. Preview it locally

The pages use JavaScript modules, so they need to be served over HTTP rather
than opened as files:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Publishing

Any static host works. The site is just files.

**GitHub Pages** — in the repo, go to *Settings → Pages*, set the source to
your branch and `/ (root)`, and save. Your site lands at
`https://<username>.github.io/<repo>/`.

**Netlify or Vercel** — drag the folder onto their dashboard, or connect the
repo. There's no build command and no output directory; leave both blank.

---

## What the history page computes

Everything is derived from Sleeper's data. Nothing is hand-maintained.

- **Champions** come from each season's playoff bracket — the winner of the
  game marked as the championship, along with who they beat.
- **Final standings** use the bracket for playoff teams. Teams that missed the
  playoffs are ranked below them by regular-season record, then points for.
- **Manager careers** are keyed by Sleeper user ID, so renaming your team every
  August doesn't split your history in two.
- **Records** (most and fewest points, highest and lowest weeks, biggest
  blowout, closest game) use regular-season games only, which keeps every
  season comparable no matter how playoff formats changed.
- **The in-progress season** is included in the tables and marked as such, but
  it can't win a title, set a "fewest points" record, or count toward anyone's
  average finish until it's over.

### Average finish

The manager table sorts by average final placement by default. It's the
headline number because it rewards being good every year rather than getting
hot once — but every column is sortable, so titles, win rate, and total points
are one click away.

---

## Notes

- **Caching.** Completed seasons never change, so they're cached in the
  browser for a year; the current season refreshes every 30 minutes (tunable via
  `sleeper.currentSeasonCacheMinutes`). First load fetches a lot; later loads
  are nearly instant, and the site keeps working from cache even if Sleeper is
  down. The **Refresh data** button in the footer clears the cache and refetches.
- **Privacy.** There's no tracking, no analytics, and no backend. The only
  outbound requests are to Sleeper's API and avatar CDN.
- **Config content is escaped**, so an apostrophe or an angle bracket in a team
  name or rule renders as text instead of breaking the page.
- **Sleeper is optional for the rules page.** If the API is unreachable, the
  written rules still render; only the live settings section is hidden.

## Files

```
index.html          League history
dues.html           Dues, payouts, draft, calendar
rules.html          Rulebook + live league settings
config.js           ← the only file you edit
assets/css/style.css
assets/js/sleeper.js   Sleeper API client, caching, season-chain walking
assets/js/stats.js     Standings, careers, and records computation
assets/js/site.js      Shared helpers, nav, footer, dates, icons
assets/js/history.js   Renders index.html
assets/js/dues.js      Renders dues.html
assets/js/rules.js     Renders rules.html
```
