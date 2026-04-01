# Slack Triage Rules

Canonical reference for Slack message classification. The conductor, scheduled-check, and morning-briefing all read from here.

## Channel Priority

| Channel | Priority | Notes |
|---------|----------|-------|
| All DMs | high | All DMs are signal — always surface |
| #the-navigators | high | Core team channel |
| #general | high | Company-wide |
| #nav-learning | low | Surface only if Nathan is asked something directly |

## Surface Rules

*Surface if ANY true:*
- Nathan is directly mentioned (@nathan or by name)
- It's a DM (all DMs are signal by definition)
- Message contains a direct ask or decision that affects Nathan
- Something Nathan is involved in is changing (schedule changes, project shifts, blockers, cancellations)

*Skip if ALL true:*
- General chatter with no ask or state change
- Reactions, emoji-only messages, bot/integration messages
- Thread replies in channels unless Nathan is mentioned or the parent message is in Watched Threads
- #nav-learning sharing links/resources with no question directed at Nathan

Default: *surface*. False positives over false negatives.

## Classifications

- *action-needed* — Nathan is directly asked to do or decide something
- *fyi* — state change or information relevant to Nathan, no action required
- *skip* — general chatter, not relevant

## Synopsis Format

Synopses must contain full context — Nathan should be able to act from the synopsis without opening Slack.

Format: `Sender in #channel — What's being asked/communicated, with enough context to act.`
DM format: `Sender (DM) — What's being asked/communicated.`

Examples:
```
Sean in #the-navigators — Asking if you can join the client call at 2pm tomorrow.
Gus in #the-navigators — No huddle today, moving async.
Tiana (DM) — Can you review the shareholder agreement changes by Thursday?
Clarisa (DM) — Office supplies order needs your approval.
```

## Output Format

```
💬 Slack:
Action Needed:
1. Sender in #channel — Full context of what's being asked.

FYI:
- Sender in #channel — What happened.

N skipped.
```

Omit the entire Slack section if nothing to report. Omit Action Needed or FYI subsection if empty.

## Thread Handling

When a parent message is surfaced, it gets added to Watched Threads in `slack-state.md` with a 48-hour watch window. On subsequent checks, thread replies are fetched and surfaced if they mention Nathan or contain a direct ask.

## Token Budget

- Max 20 messages per channel per fetch
- Triage immediately after fetching each channel — do not accumulate raw messages across channels

## Check Procedure

1. Read `/workspace/global/knowledge/comms/slack-state.md` for channel IDs and `last_message_ts` per channel.
2. *First run:* If channel IDs are empty, populate them:
   ```bash
   curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
     "https://slack.com/api/conversations.list?types=public_channel,private_channel,im&limit=100"
   ```
   Match channel names to the Channel Priority table above. Write IDs to `slack-state.md`.
3. *For each channel with a channel_id:*
   - Fetch via curl with `oldest` set to 5 minutes before `last_message_ts`:
     ```bash
     curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
       "https://slack.com/api/conversations.history?channel=CHANNEL_ID&oldest=LOOKBACK_TS&limit=20"
     ```
   - Deduplicate: skip any message whose `ts` already appears in the Surfaced Log.
   - Triage each new message per the rules above.
   - For surfaced messages, add to Surfaced Log with: timestamp, channel, from, user_id, synopsis, message_ts, thread_ts, permalink, acted_on: pending.
   - Update `last_message_ts` to the newest `ts` seen.
4. *Watched Threads:* For each entry where `watch_until` is future, fetch thread replies via `conversations.replies`. Surface replies that mention Nathan or contain a direct ask. Remove expired entries.
5. *Compose output* using the Output Format above.
6. *Update* `/workspace/global/knowledge/comms/slack-state.md`. Prune surfaced items older than 7 days that are not `pending`.

*If any Slack API call fails, stop the Slack check. Do not retry. Leave slack-state.md unchanged — the next run picks up where it left off.*
