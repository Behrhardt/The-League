/* Renders the dues, payouts, draft, and calendar page — all from config.js. */

import {
  $,
  cfg,
  esc,
  html,
  icon,
  countdown,
  formatDate,
  formatDateTime,
  isPast,
  daysUntil,
  renderChrome,
} from "./site.js";

function renderDues(dues) {
  const symbol = dues.currency || "$";
  $("#dues-amount").textContent =
    dues.amount != null ? `${symbol}${dues.amount}` : "—";

  const deadline = $("#dues-deadline");
  if (dues.dueDate) {
    const days = daysUntil(dues.dueDate);
    const when = formatDate(dues.dueDate, { weekday: true });
    // The countdown next to this owns the exact number, so the sentence just
    // states the date — otherwise the two disagree by a day at odd hours.
    deadline.innerHTML =
      days > 0
        ? `Due <strong>${esc(when)}</strong>.`
        : days === 0
        ? `Due <strong>today</strong>. Go send it.`
        : `Was due <strong>${esc(when)}</strong>. If you haven't paid, you're late.`;
  } else {
    deadline.textContent = "Talk to the commissioner about the deadline.";
  }

  if (dues.dueDateNote) {
    const note = $("#dues-note");
    note.textContent = dues.dueDateNote;
    note.classList.remove("hidden");
  }

  countdown($("#dues-countdown"), dues.dueDate, { onDone: "Deadline passed" });

  if (dues.memoLine) $("#dues-memo").textContent = dues.memoLine;
}

function renderMethods(methods = []) {
  html(
    "#pay-methods",
    methods
      .map((m) => {
        const inner = `
          <div class="pay-name">
            <span>${esc(m.name)}</span>
            ${m.link ? `<span style="color:var(--text-faint);font-size:.8rem">open ↗</span>` : ""}
          </div>
          <div class="pay-handle">${esc(m.handle)}</div>
          ${m.note ? `<div class="pay-note">${esc(m.note)}</div>` : ""}`;

        return m.link
          ? `<a class="pay-card" href="${esc(m.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
          : `<div class="pay-card">${inner}</div>`;
      })
      .join("")
  );
}

function renderTracker(roster) {
  if (!Array.isArray(roster) || roster.length === 0) {
    $("#tracker-section").classList.add("hidden");
    return;
  }

  const paid = roster.filter((r) => r.paid).length;
  $("#tracker-summary").textContent =
    paid === roster.length
      ? "Everyone's square. Nice work."
      : `${paid} of ${roster.length} teams have paid. Chase the rest.`;

  const sorted = [...roster].sort(
    (a, b) => Number(a.paid) - Number(b.paid) || String(a.team).localeCompare(String(b.team))
  );

  html(
    "#tracker",
    `<div class="table-wrap"><table style="min-width:420px">
      <thead><tr>
        <th scope="col">Team</th>
        <th scope="col">Manager</th>
        <th scope="col">Status</th>
      </tr></thead>
      <tbody>
        ${sorted
          .map(
            (r) => `<tr>
              <td><strong>${esc(r.team)}</strong></td>
              <td style="color:var(--text-dim)">${esc(r.manager || "—")}</td>
              <td>${
                r.paid
                  ? '<span class="pill green">Paid</span>'
                  : '<span class="pill red">Outstanding</span>'
              }</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table></div>`
  );
}

function renderPayouts(payouts = []) {
  html(
    "#payouts",
    `<div class="grid grid-3">
      ${payouts
        .map(
          (p, i) => `<div class="stat">
            <span class="stat-label">${esc(p.place)}</span>
            <span class="stat-value ${i === 0 ? "gold" : ""}" style="font-size:1.5rem">${esc(
            p.amount
          )}</span>
            ${p.note ? `<span class="stat-meta">${esc(p.note)}</span>` : ""}
          </div>`
        )
        .join("")}
    </div>`
  );
}

function renderDraft(draft) {
  countdown($("#draft-countdown"), draft.datetime, { onDone: "We're on the clock" });

  if (draft.datetime) {
    $("#draft-when").innerHTML = `${esc(formatDateTime(draft.datetime))}${
      draft.timezoneLabel ? ` ${esc(draft.timezoneLabel)}` : ""
    }`;
  }

  const rows = [
    ["Location", draft.locationLink
      ? `<a href="${esc(draft.locationLink)}" target="_blank" rel="noopener noreferrer">${esc(draft.location)} ↗</a>`
      : esc(draft.location)],
    ["Format", esc(draft.format)],
    ["Pick clock", esc(draft.pickClock)],
    ["Draft order", esc(draft.orderMethod)],
  ].filter(([, v]) => v);

  html(
    "#draft-details",
    `<span class="stat-label">Details</span>
     <div style="margin-top:12px;display:grid;gap:10px">
      ${rows
        .map(
          ([k, v]) => `<div style="display:grid;grid-template-columns:108px 1fr;gap:12px;align-items:baseline">
            <span style="color:var(--text-faint);font-size:.82rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700">${esc(
              k
            )}</span>
            <span>${v}</span>
          </div>`
        )
        .join("")}
     </div>`
  );

  if (Array.isArray(draft.notes) && draft.notes.length) {
    html(
      "#draft-notes",
      `<div class="callout">
        <strong>Before you show up</strong>
        <ul style="margin:10px 0 0;padding-left:20px">
          ${draft.notes.map((n) => `<li style="margin-bottom:6px">${esc(n)}</li>`).join("")}
        </ul>
      </div>`
    );
  }
}

function renderCalendar(events = []) {
  const sorted = [...events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const nextIndex = sorted.findIndex((e) => !isPast(e.date));

  html(
    "#calendar",
    sorted
      .map((e, i) => {
        const past = isPast(e.date);
        const cls = past ? " class=\"past\"" : i === nextIndex ? " class=\"next\"" : "";
        return `<li${cls}>
          <span class="when">${esc(formatDate(e.date))}</span>
          <span>
            <span class="what">${esc(e.label)}</span>
            ${e.detail ? `<span class="detail"> — ${esc(e.detail)}</span>` : ""}
          </span>
        </li>`;
      })
      .join("")
  );
}

function renderContact(league) {
  if (!league.commissioner && !league.commissionerContact) return;

  const contact = league.commissionerContact;
  const link = contact
    ? contact.includes("@")
      ? `<a href="mailto:${esc(contact)}">${esc(contact)}</a>`
      : `<a href="tel:${esc(contact.replace(/[^\d+]/g, ""))}">${esc(contact)}</a>`
    : "";

  html(
    "#contact",
    `<strong>Still stuck?</strong> ${
      league.commissioner ? `Ask ${esc(league.commissioner)}` : "Ask the commissioner"
    }${link ? ` — ${link}` : ""}. Payment problems get sorted faster than roster problems.`
  );
  $("#contact-section").classList.remove("hidden");
}

function main() {
  renderChrome("dues.html");
  const { dues = {}, draft = {}, calendar = [], league = {} } = cfg();

  renderDues(dues);
  renderMethods(dues.methods);
  renderTracker(dues.roster);
  renderPayouts(dues.payouts);
  renderDraft(draft);
  renderCalendar(calendar);
  renderContact(league);
}

main();
