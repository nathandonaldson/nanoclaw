---
name: add-telegram-reactions
description: Add context-aware emoji reactions to incoming Telegram messages. The bot reacts instantly before processing, giving visual feedback. Triggers on "telegram reactions", "add reactions", "emoji reactions".
---

# Add Telegram Reactions

Adds context-aware emoji reactions to incoming Telegram messages. The bot reacts immediately when a message arrives, before the agent starts processing.

## Implementation

Edit `src/channels/telegram.ts`.

### Step 1: Add reaction function

Add this after the `sendTelegramMessage` function:

```typescript
/**
 * Pick a context-aware emoji reaction based on message content.
 */
function pickReaction(text: string): string {
  const lower = text.toLowerCase();

  // Questions
  if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('how') ||
      lower.startsWith('why') || lower.startsWith('when') || lower.startsWith('where') ||
      lower.startsWith('who') || lower.startsWith('can you') || lower.startsWith('could you'))
    return '🤔';

  // Status checks
  if (/what'?s up|status|anything new/i.test(lower)) return '👀';

  // Urgency
  if (/urgent|asap|emergency|deadline|overdue/i.test(lower)) return '⚡';

  // Gratitude
  if (/thanks|thank you|cheers|ta|legend/i.test(lower)) return '❤️';

  // Greetings
  if (/^(hey|hi|hello|morning|gm|yo)\b/i.test(lower)) return '👋';

  // Approval / positive
  if (/nice|great|awesome|perfect|love it|ship it|lgtm/i.test(lower)) return '🔥';

  // Tasks / requests
  if (/remind|schedule|set up|create|send|draft|reply to/i.test(lower)) return '👍';

  // Packages
  if (/package|tracking|shipped|delivery|where is/i.test(lower)) return '📦';

  // Default — acknowledge receipt
  return '👀';
}

/**
 * React to a message with a context-aware emoji. Non-blocking — failures are silent.
 */
async function reactToMessage(
  api: { setMessageReaction: any },
  chatId: string | number,
  messageId: number,
  emoji: string,
): Promise<void> {
  try {
    await api.setMessageReaction(chatId, messageId, [
      { type: 'emoji', emoji },
    ]);
  } catch {
    // Reactions may fail in some chat types or if bot lacks permission — ignore silently
  }
}
```

### Step 2: Add reaction call to message handler

In the `bot.on('message:text')` handler, add the reaction call right after the registered group check (after `if (!group) { ... return; }`), before `this.opts.onMessage`:

```typescript
// React with context-aware emoji before processing
reactToMessage(
  this.bot!.api,
  ctx.chat.id,
  ctx.message.message_id,
  pickReaction(content),
);
```

This is intentionally not awaited — fire and forget so it doesn't delay message processing.

### Step 3: Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

### Testing

Send these messages in Telegram and verify the reactions:

- "what's up?" → 👀
- "can you check my email?" → 🤔
- "thanks!" → ❤️
- "hey" → 👋
- "ship it" → 🔥
- "urgent: need this done" → ⚡
- "where's my package?" → 📦
- "set up a meeting" → 👍
- "hello world" → 👋

## Removal

Remove the `pickReaction`, `reactToMessage` functions and the `reactToMessage` call in the message handler from `src/channels/telegram.ts`. Rebuild and restart.
