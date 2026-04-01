# Wintermute Intelligence Layer

Wintermute is a proactive personal AI layer that runs on top of NanoClaw. It turns a reactive chatbot into a stateful assistant that learns your patterns, triages your communications, and briefs you proactively.

## Architecture

NanoClaw provides the chassis: secure containers, multi-channel messaging (WhatsApp, Telegram, Slack), credential management, and scheduled tasks. Wintermute provides the brain: triage rules, personality, proactive behavior, knowledge state, and a self-improvement loop.

```
┌─────────────────────────────────────────────┐
│  Container Agent                            │
│  ┌───────────────────────────────────────┐  │
│  │ groups/global/CLAUDE.md               │  │
│  │ (personality, triggers, autonomy)     │  │
│  └───────────────┬───────────────────────┘  │
│                  │ reads on demand           │
│  ┌───────────────▼───────────────────────┐  │
│  │ groups/global/skills/                 │  │
│  │ conductor, email-check, slack-check,  │  │
│  │ morning-briefing, scheduled-check,    │  │
│  │ packages, self-reflect                │  │
│  └───────────────┬───────────────────────┘  │
│                  │ reads/writes              │
│  ┌───────────────▼───────────────────────┐  │
│  │ groups/global/knowledge/              │  │
│  │ comms/state.md, comms/vips.md,        │  │
│  │ comms/slack-state.md, packages.md,    │  │
│  │ people/, projects/                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  MCP Tools: Gmail, Calendar, NanoClaw       │
└─────────────────────────────────────────────┘
```

### Why Group Folder, Not Container Skills

Skills live in `groups/global/` (writable) rather than `container/skills/` (read-only inside the container). This enables the self-reflection skill to edit triage rules based on observed patterns. The trade-off: skills aren't auto-synced by NanoClaw's container skill mechanism, but they're accessible to every group via the global mount.

- Main group: `/workspace/global/` is mounted read-write
- Non-main groups: `/workspace/global/` is mounted read-only

## Skills

| Skill | Trigger | What It Does |
|-------|---------|-------------|
| `conductor.md` | "what's up?", "status?", "anything new?" | Routes messages. Runs email check → sends → Slack check → sends. Two-message pattern ensures email is never blocked by Slack failures. |
| `email-check.md` | Called by conductor, scheduled-check, morning-briefing | Two-pass email triage: noise filter → classification (action-needed/fyi/skip). Learning loop tracks which surfaced items Nathan acts on. |
| `slack-check.md` | Called by conductor, scheduled-check, morning-briefing | Slack triage across prioritized channels. Surfaces mentions, DMs, direct asks. Tracks watched threads for 48 hours. |
| `morning-briefing.md` | 8am weekdays (scheduled task) | Single message: calendar with meeting context, email triage, Slack overnight, tasks due, pending nudges, package updates. |
| `scheduled-check.md` | Every 2 hours weekdays (scheduled task) | Silent unless noteworthy. Combined email + Slack triage. Only sends if there's something to report. |
| `packages.md` | "packages", "where is it?" | Scans emails for tracking numbers, checks carrier APIs (Japan Post, USPS, NZ Post), maintains state. |
| `self-reflect.md` | Sundays 7am (scheduled task) | Scores performance on 6 dimensions. Detects 3+ week trends. Edits skill files directly when rules are wrong. Commits changes. |

## Knowledge Files

All state lives in `groups/global/knowledge/`:

| File | Purpose | Updated By |
|------|---------|-----------|
| `comms/state.md` | Email last_checked timestamp, surfaced log (who/what/when/acted_on), classification lessons | email-check, conductor |
| `comms/slack-state.md` | Channel IDs, per-channel watermarks, watched threads, surfaced log | slack-check, conductor |
| `comms/vips.md` | VIP contacts organized by domain (~90 entries). Email address is the primary key. | Manual, self-reflect |
| `packages.md` | Active shipments (order, retailer, tracking, status). Delivered section (pruned after 30 days). | packages skill |
| `me.md` | Personal profile | Manual |
| `me-leadership.md` | DISC, CliftonStrengths, working style | Manual |
| `family.md` | Family context | Manual |
| `travel.md` | Trips and bookings | Manual |
| `people/` | Per-person profiles | Agent learns over time |
| `projects/` | Per-project context (Boost, EO, etc.) | Agent learns over time |

## Scheduled Tasks

| Task | Schedule | Behavior |
|------|----------|----------|
| Morning briefing | `0 8 * * 1-5` (8am weekdays NZST) | Always wakes agent. Sends one consolidated message. |
| Scheduled check | `0 */2 7-22 * * 1-5` (every 2h, 7am-11pm weekdays) | Task script gates on last_checked age. Silent if nothing new. |
| Self-reflection | `0 7 * * 0` (Sundays 7am) | Always wakes agent. Edits skills if needed. Only messages Nathan if trend alert or skill modified. |

Tasks are created via `mcp__nanoclaw__schedule_task` from inside the container agent. To recreate them, send: "Set up my scheduled tasks: morning briefing at 8am weekdays, scheduled check every 2 hours from 7am-11pm weekdays, and self-reflection on Sundays at 7am."

## Email Triage Logic

### Pass 1: Noise Filter
SKIP only if ALL true: Gmail category is PROMOTIONS + no urgency signals + sender not VIP + Nathan not in To field. NEVER skip VIPs, urgency signals, direct To, or noreply@ senders.

### Pass 2: Classification
- **action-needed** — directly asked to do something with real consequence for delay
- **fyi** — useful to know, no action required
- **skip** — noise that passed filter

### Learning Loop
Tracks surfaced items. After 48 hours without a reply, logs as "ignored" in Classification Lessons. Self-reflection reviews these patterns and tightens rules.

## MCP Tool Dependencies

| Tool | Used For |
|------|----------|
| `mcp__gmail__search_messages` | Find recent emails |
| `mcp__gmail__read_message` | Read full email content |
| `mcp__gmail__read_thread` | Check if Nathan replied (learning loop) |
| `mcp__gmail__send_email` | Send email replies |
| `mcp__gmail__create_draft` | Draft replies for approval |
| `mcp__gcal__list_events` | Get calendar events for briefings |
| `mcp__gcal__create_event` | Create calendar events |
| `mcp__gcal__update_event` | Modify existing events |
| `mcp__nanoclaw__send_message` | Send messages to channels |
| `mcp__nanoclaw__schedule_task` | Create/manage scheduled tasks |
| Slack Web API (via curl) | Read channel messages for triage |

## Customization

### Adding VIPs
Edit `groups/global/knowledge/comms/vips.md`. Add entries with email address, name, and priority notes, organized by domain (Family, Work, Friends, etc.).

### Changing Triage Rules
Edit `groups/global/skills/email-check.md` or `slack-check.md` directly. The self-reflection skill also edits these automatically based on observed patterns.

### Adding Slack Channels
Edit the Channel Priority table in `groups/global/skills/slack-check.md`.

### Changing Personality
Edit the Voice and Operating Philosophy sections in `groups/global/CLAUDE.md`.

### Adjusting Schedules
From any channel, tell the agent to update the scheduled tasks (e.g., "Change morning briefing to 7:30am").

## Infrastructure Changes from Base NanoClaw

1. **Writable global mount for main group** — `src/container-runner.ts` mounts `groups/global/` as read-write for the main group (enables self-improving skills).
2. **Gmail MCP** — via `/add-gmail` skill (tool-only mode).
3. **Google Calendar MCP** — custom `/add-gcal` skill. OAuth credentials at `~/.gcal-mcp/`, tokens at `~/.config/google-calendar-mcp/`.
4. **Both MCP servers** share the same GCP OAuth project.
