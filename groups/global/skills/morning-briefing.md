# Morning Briefing

Assembles a single message covering the day ahead. Sent proactively at 8am weekdays via scheduled task.

## Data Gathering

1. *Calendar:* Fetch today's events via `mcp__gcal__list_events`. For each meeting with attendees, check `/workspace/global/knowledge/people/` for context on who's attending.
2. *Email:* Triage emails per `/workspace/global/skills/email-check.md`. Run the full Check Procedure.
3. *Slack:* Run the Check Procedure in `/workspace/global/skills/slack-check.md`. If Slack tools fail, skip — do not block the briefing.
4. *Tasks:* Read `/workspace/global/TASKS.md`. Flag anything overdue or due today.
5. *Packages:* Read `/workspace/global/knowledge/packages.md`. Note any with tracking updates or expected delivery today.
6. *Pending nudges:* Scan `/workspace/global/knowledge/comms/state.md` surfaced log for action-needed items pending >3 days or with deadline within 3 days.

## Output Format

Send via `mcp__nanoclaw__send_message` as a *single message*:

```
Good morning.

📅 Today:
- HH:MM — Event title (context: attendee role, recent thread, what to prep)
(or "No meetings today.")

📬 Overnight:
N need attention, N FYI

Action Needed:
1. Sender — Full context of what's being asked, who's involved, what to do, and by when.

FYI:
- Sender — What happened, enough context to understand without opening Gmail.

(or "No new email overnight.")

💬 Slack overnight:
[per slack-check.md format]
(omit if nothing)

📋 Tasks:
- [overdue/due today items from TASKS.md]
(or "Nothing due today.")

⏰ Pending:
- Item — surfaced N days ago, still pending.
(only if there are aging items)

📦 Packages:
- Description — status update
(only if active packages with movement)
```

Omit any section with nothing to report. If the entire briefing would be empty, don't send — exit silently.

## State Updates

After sending:
- Update `/workspace/global/knowledge/comms/state.md` per email-check.md state rules
- Update `/workspace/global/knowledge/comms/slack-state.md` per slack-check.md state rules

## Meeting Context

For calendar events, add brief context when available:
- Attendee has a file in `/workspace/global/knowledge/people/` → note their role
- Recent email thread with attendee → note the topic
- Task in TASKS.md relates to the meeting → flag it

One line per meeting — briefing, not dossier.
