# Prompt Comparison: Wintermute (original) vs NanoClaw (port)

Side-by-side comparison of every instruction the agent sees when "what's up?" is triggered.

---

## 1. Trigger (how "what's up?" gets routed)

| | Wintermute | NanoClaw |
|---|---|---|
| **Location** | `CLAUDE.md` | `groups/global/CLAUDE.md` |
| **Text** | `"What's up?", "status?", "anything new?" → read and follow skills/conductor.md. Just run it.` | `"What's up?", "status?", "anything new?" → read and follow /workspace/global/skills/conductor.md` |
| **Difference** | "Just run it." — no hesitation | Missing the "Just run it" nudge |

---

## 2. Conductor (orchestration)

### Wintermute (32 lines)

```
1. Check email + calendar per skills/email-check.md. Include learning loop and nudges.
2. SEND email/calendar message immediately. Update knowledge/comms/state.md.
3. THEN check Slack per skills/slack-check.md. Send as a second, separate message.
   If Slack fails, skip — email is already delivered.

Output formats are defined in each skill.
Silent/scheduled mode: only send if there's something to report.
```

Action-Request Flow:
```
- Email: gws gmail +reply uses Gmail message ID (e.g. 19d2d6ae694fd0a0), not MIME Message-ID.
- Slack: look up in slack-state.md surfaced log. Send via slack_send_message. Reply in thread if thread_ts exists.
```

### NanoClaw (85 lines)

```
Step 1: Email + Calendar + Tasks + Packages
  a. Run Learning Loop from email-check.md first
  b. Run Check Procedure from email-check.md — fetch emails, read bodies, classify, fetch calendar
  c. Read TASKS.md for items due today, tomorrow, or overdue
  d. Read packages.md for active shipments

Step 2: SEND email/calendar/tasks message IMMEDIATELY
  [output template with 📬, 📅, ⚠️ sections]

Step 3: Update email state
Step 4: Slack (separate message)

Writing rules:
  - Read before you summarize
  - Thread awareness
  - Skip noise silently
  - Don't ask what to do
  - Calendar and tasks are mandatory sections
```

Action-Request Flow:
```
- Email reply: mcp__gmail__search_messages(query: "from:sender subject:topic")
  Then: mcp__gmail__send_email(to: "recipient", subject: "Re: topic", body: "reply text", threadId: "thread123")
- Slack: curl -s -X POST "https://slack.com/api/chat.postMessage" ...
- Calendar: mcp__gcal__create_event or mcp__gcal__update_event
```

### Key Differences

| Aspect | Wintermute | NanoClaw |
|---|---|---|
| **Length** | 32 lines, terse | 85 lines, verbose |
| **Flow** | 3 numbered steps | 4 steps with sub-steps |
| **Tasks/Packages** | Not in conductor (handled by morning-briefing) | Explicitly gathered in Step 1 |
| **Output template** | Defers to email-check.md format | Defines its own template inline |
| **Writing rules** | None (voice comes from personality.md) | 5 explicit rules about depth, noise, tone |
| **Tool examples** | `gws gmail +reply` with example ID | Full MCP call syntax with parameters |

**Assessment:** NanoClaw conductor is 2.6x longer but more explicit. The risk is that the extra instructions may dilute the core message. Wintermute relies on the personality file for tone; NanoClaw embeds tone rules in the conductor itself.

---

## 3. Email Check (triage rules)

### Wintermute (92 lines)

**Noise Filter:**
```
SKIP only if ALL true:
- Gmail category is PROMOTIONS, or sender matches noise pattern
- Subject and body contain NO urgency signals (fraud, security, deadline, legal, overdue, action required)
- Sender is NOT on VIP list
- Nathan is NOT in To field directly

NEVER skip:
- VIP contacts regardless of content
- Urgency signals regardless of sender
- Nathan in To field directly
- noreply@ senders
```

**Classification questions:**
```
1. Is this person directly asking Nathan to do something, or is he just in the loop?
2. Is there a real deadline with consequences, or manufactured urgency?
3. Could Nathan ignore this for a week with no consequence? If yes, FYI at best.
4. Is Nathan the decision-maker, or is someone else driving?
```

**Output format:**
```
📬 N need attention, N FYI

Action Needed:
1. Sender — Full context...

FYI:
- Sender — What happened...

N skipped (promos, alerts, etc.)

📅 Rest of day:
- HH:MM — Event title (location/link)
```

**Check Procedure:**
```
1. Read state.md for last_checked
2. Fetch in parallel via Bash: bin/fetch-emails + bin/fetch-calendar
3. Dedup: exclude where internalDate ≤ last_checked as epoch ms
4. Read full bodies: gws gmail +read --id <messageId> --headers --format json
5. Classify each email
6. Check pending items — nudge >3 days or deadline <3 days
```

### NanoClaw (89 lines)

**Noise Filter:**
```
SKIP only if ALL true:
- Gmail category is PROMOTIONS, or sender matches noise pattern
- Subject and body contain NO urgency signals (fraud, security, deadline, legal, overdue, action required)
- Sender is NOT on VIP list
- Nathan is NOT in To field directly

NEVER skip (these override category — even PROMOTIONS):
- VIP contacts regardless of content or category
- Urgency signals in subject OR body regardless of sender or category
  (fraud, security, deadline, legal, overdue, action required, shipped, delivery, order confirmed)
- Nathan in To field directly
- noreply@ senders
```

**Classification questions:** Same 4 questions, identical.

**Output format:**
```
Don't split into rigid "Action Needed" / "FYI" sections. Write a natural flow.
Each item is a one-liner with substance.

You must read the email body. Summaries based only on subject lines are not acceptable.
For threads, read full thread and summarize current state.
Skip noise silently. Don't even count them.

Good example:
- GLC stipend thread: Grant asked for dispensation to claim air points...
Bad example:
- GLC stipend thread — 3 replies from Grant, Katie, Shawn
```

**Check Procedure:**
```
1. Read state.md for last_checked and surfaced log
2. Read VIP list from vips.md
3. mcp__gmail__search_messages(query: "is:inbox newer_than:1d", maxResults: 20)
4. Dedup: exclude where date ≤ last_checked
5. For each passing email: mcp__gmail__read_message(messageId: "<id>")
6. For threads: mcp__gmail__read_thread(threadId: "<threadId>")
7. Classify each email
8. mcp__gcal__list_events(timeMin: "<now>", timeMax: "<end of today>", timeZone: "Pacific/Auckland")
9. Check pending items — nudge >3 days or deadline <3 days
```

### Key Differences

| Aspect | Wintermute | NanoClaw |
|---|---|---|
| **Urgency signals** | 6 signals | 9 signals (+shipped, delivery, order confirmed) |
| **NEVER skip emphasis** | Bold text | Explicit "override category — even PROMOTIONS" |
| **Output format** | Rigid sections (Action Needed / FYI / skipped count) | Natural flow, no sections, good/bad examples |
| **Body reading** | `gws gmail +read --id <messageId>` | `mcp__gmail__read_message(messageId)` + explicit "you MUST read" |
| **Thread reading** | Not explicit (implied by gws thread get) | Explicit step 6 with `mcp__gmail__read_thread` |
| **Pre-fetching** | `bin/fetch-emails` (parallel bash, ~5s) | Sequential MCP calls (slower) |
| **Dedup** | `internalDate` epoch ms comparison | Date ≤ `last_checked` (less precise) |
| **Calendar** | `bin/fetch-calendar` (parallel with email) | Step 8, sequential after email |
| **VIP loading** | Step 4 (after fetch, before classify) | Step 2 (before fetch) |

**Assessment:** NanoClaw has stronger "read the body" enforcement and better good/bad examples. But it loses the parallel pre-fetch optimization and the structured output format. The "natural flow" instruction may be causing the agent to be too casual about what to include vs skip.

---

## 4. Slack Check (triage rules)

### Wintermute (100 lines)

**Synopsis examples (not in NanoClaw):**
```
Sean in #the-navigators — Asking if you can join the client call at 2pm tomorrow.
Gus in #the-navigators — No huddle today, moving async.
Tiana (DM) — Can you review the shareholder agreement changes by Thursday?
Clarisa (DM) — Office supplies order needs your approval.
```

**Check procedure uses:** `slack_read_channel` MCP with `oldest` set to 5-min lookback.

**Surfaced Log fields (explicit):**
```
timestamp (ISO 8601), channel, from (display name), user_id, synopsis,
message_ts, thread_ts (if threaded), permalink, acted_on: pending
```

### NanoClaw (84 lines)

**Synopsis examples:** None (removed).

**Check procedure uses:** `curl` with Slack bot token.

**Surfaced Log fields (explicit, with example row):**
```
| timestamp | channel | from | user_id | synopsis | message_ts | thread_ts | acted_on |
| 2026-03-31T09:00:00Z | #the-navigators | Sean | U012345 | Asking... | 1711861200.000100 | | pending |
```

### Key Differences

| Aspect | Wintermute | NanoClaw |
|---|---|---|
| **Synopsis examples** | 4 concrete examples showing format and depth | None |
| **Output format** | Rigid (Action Needed / FYI / N skipped) | Natural flow |
| **Fetch method** | `slack_read_channel` MCP tool | `curl` with bot token |
| **Permalink** | Included in surfaced log | Missing from surfaced log |
| **Channel init** | `slack_search_channels` + `slack_search_users` | `conversations.list` API |

**Assessment:** NanoClaw loses the synopsis examples which showed the depth/format expected. The curl approach works but is less elegant than MCP tools. Missing permalink means the agent can't link Nathan to the original message.

---

## 5. Summary: What NanoClaw Does Better

- Explicit "read the body" enforcement with good/bad examples
- More urgency signals (shipped, delivery, order confirmed)
- Concrete MCP tool call syntax with parameters
- Tasks and packages integrated into status check (not just morning briefing)
- "Don't ask what to do" rule (anti-chatbot)

## 6. Summary: What Wintermute Does Better

- **Terse instructions** — 32-line conductor vs 85-line conductor. Less dilution.
- **Parallel pre-fetch** — bash scripts fetch email + calendar simultaneously in ~5s
- **Synopsis examples** — 4 concrete Slack examples showing expected depth
- **Structured output** — "N need attention, N FYI" gives Nathan a count before the details
- **Epoch ms dedup** — more precise than date string comparison
- **Personality separation** — personality.md as a separate file the agent can reference and update
- **"Just run it"** — trigger says don't hesitate, just execute

## 7. Likely Causes of Underwhelming Output

1. **No synopsis examples in NanoClaw email-check** — the "good example / bad example" helps, but the original's classification questions are doing more work. The 4 questions are identical, but Wintermute's structured output format (Action Needed / FYI) forces the agent to commit to a classification. NanoClaw's "natural flow" lets the agent be vague.

2. **"Natural flow" removes the forcing function** — when you must label something "Action Needed" or "FYI", you must decide. When you write a "natural flow", you can hedge. The original's structure is a feature, not a bug.

3. **NanoClaw conductor is too verbose** — 85 lines of instructions may cause the agent to skim. Wintermute's 32 lines are all signal.

4. **Missing the count** — "N need attention, N FYI" immediately tells Nathan the volume. NanoClaw's "Several new since this morning" is vague.

5. **NanoClaw may not be reading bodies** — despite the instruction, the agent may still be summarizing from search results metadata if it's trying to minimize tool calls.
