# Email & Calendar Rules

Canonical reference for email classification and calendar output. The conductor, scheduled-check, and morning-briefing all read from here.

## First Pass: Noise Filter

*SKIP only if ALL true:*
- Gmail category is PROMOTIONS, or sender matches a noise pattern in VIP Learned Patterns
- Subject and body contain NO urgency signals (fraud, security, deadline, legal, overdue, action required, shipped, delivery, order confirmed)
- Sender is NOT on the VIP list
- Nathan is NOT in the To field directly

*NEVER skip (these override category — even PROMOTIONS):*
- Emails from VIP contacts regardless of content or category
- Emails with urgency signals in subject OR body regardless of sender or category
- Emails where Nathan is in the To field directly
- `noreply@` senders — can carry fraud alerts, security notifications, compliance deadlines

Default: *pass through*. False positives over false negatives.

## Second Pass: Classification

For each email that passes the noise filter, classify using these questions:

1. Is this person **directly asking Nathan** to do something, or is he just in the loop?
2. Is there a **real deadline with consequences**, or manufactured urgency?
3. Could Nathan ignore this for a week with no consequence? If yes, FYI at best.
4. Is Nathan the **decision-maker**, or is someone else driving?

**action-needed** — someone is directly asking Nathan to do or decide something, and delay has real consequences. The bar is high: a vague "thoughts?" is FYI, not action-needed.

**fyi** — useful to know, no action required now. This includes:
- Opportunities with deadlines (co-investment offers, event RSVPs) — unless Nathan specifically asked to be reminded
- Team members doing expected work (adding tokens, deploying, updating content)
- Informational updates where Nathan is CC'd or in the loop
- Status updates on processes others are driving

**skip** — noise that passed first pass but doesn't warrant surfacing. This includes:
- Agent/system notifications (fine-tuning jobs, CI/CD, automated alerts from tools Nathan built)
- Service notifications for services Nathan doesn't personally manage
- Marketing from SaaS tools

Synopses must contain full context — Nathan should be able to act from the synopsis without opening Gmail. Include: who's asking, what they want, any deadline, and what Nathan needs to do.

## Output Format

```
📬 N need attention, N FYI

Action Needed:
1. Sender — Full context of what's being asked, who's involved, what to do, and by when.

FYI:
- Sender — What happened, enough context to understand without opening Gmail.

N skipped (promos, alerts, etc.)

📅 Remaining today:
- HH:MM — Event title (location/link)
(or "No more meetings today.")

⚠️ Due today/tomorrow:
- [overdue or upcoming tasks/commitments from TASKS.md]
- [pending items aging >3 days or deadline within 3 days]
(omit if nothing due)

📦 Packages:
- [active shipments with movement]
(omit if no updates)
```

You MUST read the email body (via `mcp__gmail__read_message`) for every email that passes triage. For threads, read via `mcp__gmail__read_thread` and summarize who said what, where it landed. Summaries based only on subject lines are not acceptable.

## Check Procedure

1. Read `/workspace/global/knowledge/comms/state.md` for `last_checked` and the surfaced log.
2. Read VIP list from `/workspace/global/knowledge/comms/vips.md`.
3. Fetch recent emails:
   ```
   mcp__gmail__search_messages(query: "is:inbox newer_than:1d", maxResults: 20)
   ```
4. Dedup: exclude any email whose date ≤ `last_checked`.
5. For each remaining email, run the noise filter. If it passes, read the full message:
   ```
   mcp__gmail__read_message(messageId: "<id from search results>")
   ```
6. For threads (threadId with multiple messages), read the full thread:
   ```
   mcp__gmail__read_thread(threadId: "<threadId>")
   ```
7. Classify each email per the rules above.
8. Fetch remaining calendar events:
   ```
   mcp__gcal__list_events(timeMin: "<now in RFC3339>", timeMax: "<end of today>", timeZone: "Pacific/Auckland")
   ```
9. Check pending items in surfaced log — nudge action-needed items pending >3 days or with deadline within 3 days.

## Learning Loop

Runs before email fetch on status checks. For each `pending` item in the surfaced log:
- Check thread for Nathan's reply via `mcp__gmail__read_thread`
- Replied → `replied`. No reply after 48h → `ignored`. Under 48h → stays `pending`.
- Log ignored action-needed patterns under Classification Lessons in `state.md`.

## State Updates

After sending, update `/workspace/global/knowledge/comms/state.md`:
- Set `last_checked` to newest email's timestamp (ISO 8601)
- Add new surfaced items with: timestamp, classification, from, subject, threadId, synopsis, acted_on: pending
- Prune resolved rows (replied, ignored) older than 7 days. Keep all `pending` rows regardless of age.
