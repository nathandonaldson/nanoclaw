# Wintermute Testing Harness

## The Challenge

Wintermute's intelligence is prompt-driven markdown skills running inside containers. Traditional unit tests don't apply — the "code" is natural language instructions that Claude interprets. We need to test that:

1. The infrastructure delivers the right files to the agent
2. The agent can read skills and knowledge files
3. Triage classification matches expected outcomes
4. Scheduled tasks fire and produce correct output
5. Self-reflection edits are valid and reversible

## Testing Tiers

### Tier 1: Infrastructure Tests (deterministic, free, fast)

These verify the plumbing works without invoking Claude.

```bash
# Run all Tier 1 tests
npx vitest run test/wintermute/
```

#### 1a. Mount Verification

Test that the container gets the right mounts with the right permissions.

```typescript
// test/wintermute/mounts.test.ts
import { describe, it, expect } from 'vitest';

describe('Wintermute mounts', () => {
  it('main group gets writable global mount', () => {
    // Simulate buildVolumeMounts for a main group
    // Assert /workspace/global is mounted read-write
  });

  it('non-main groups get read-only global mount', () => {
    // Assert /workspace/global is mounted read-only
  });

  it('Gmail credentials mounted when present', () => {
    // Assert /home/node/.gmail-mcp is mounted
  });

  it('Calendar credentials mounted when present', () => {
    // Assert /home/node/.gcal-mcp is mounted
    // Assert /home/node/.config/google-calendar-mcp is mounted
  });
});
```

#### 1b. File Structure Validation

Test that all required files exist and have valid structure.

```typescript
// test/wintermute/files.test.ts
describe('Wintermute file structure', () => {
  it('global CLAUDE.md contains trigger routing', () => {
    const content = fs.readFileSync('groups/global/CLAUDE.md', 'utf-8');
    expect(content).toContain('conductor.md');
    expect(content).toContain('email-check.md');
    expect(content).toContain('morning-briefing.md');
  });

  it('all skills exist and are non-empty', () => {
    const skills = [
      'conductor', 'email-check', 'slack-check',
      'morning-briefing', 'scheduled-check', 'packages', 'self-reflect'
    ];
    for (const skill of skills) {
      const path = `groups/global/skills/${skill}.md`;
      expect(fs.existsSync(path)).toBe(true);
      expect(fs.statSync(path).size).toBeGreaterThan(100);
    }
  });

  it('knowledge state files have required fields', () => {
    const state = fs.readFileSync('groups/global/knowledge/comms/state.md', 'utf-8');
    expect(state).toContain('last_checked');
  });

  it('VIP list has email addresses', () => {
    const vips = fs.readFileSync('groups/global/knowledge/comms/vips.md', 'utf-8');
    expect(vips).toMatch(/@[a-z]+\./); // at least one email address
  });
});
```

#### 1c. Skill Cross-Reference Validation

Test that skills reference files that actually exist.

```typescript
// test/wintermute/references.test.ts
describe('Skill cross-references', () => {
  it('conductor references existing skills', () => {
    const conductor = fs.readFileSync('groups/global/skills/conductor.md', 'utf-8');
    const refs = conductor.match(/\/workspace\/global\/skills\/[\w-]+\.md/g) || [];
    for (const ref of refs) {
      const localPath = ref.replace('/workspace/global/', 'groups/global/');
      expect(fs.existsSync(localPath)).toBe(true);
    }
  });

  it('morning-briefing references existing knowledge files', () => {
    const briefing = fs.readFileSync('groups/global/skills/morning-briefing.md', 'utf-8');
    const refs = briefing.match(/\/workspace\/global\/knowledge\/[\w/.-]+/g) || [];
    for (const ref of refs) {
      const localPath = ref.replace('/workspace/global/', 'groups/global/');
      // Directory refs are OK even if empty
      const isDir = !ref.includes('.');
      if (!isDir) {
        expect(fs.existsSync(localPath)).toBe(true);
      }
    }
  });
});
```

### Tier 2: Container Smoke Tests (deterministic, free, ~30s)

Test that a container can start, read global files, and access MCP tools.

```typescript
// test/wintermute/container-smoke.test.ts
describe('Container smoke tests', () => {
  it('agent can read global CLAUDE.md', async () => {
    const result = await runContainerAgent({
      prompt: 'Read /workspace/global/CLAUDE.md and output the first line.',
      groupFolder: 'whatsapp_main',
      chatJid: 'test',
      isMain: true,
    });
    expect(result.result).toContain('Wintermute');
  });

  it('agent can read skill files', async () => {
    const result = await runContainerAgent({
      prompt: 'List files in /workspace/global/skills/ and output their names.',
      groupFolder: 'whatsapp_main',
      chatJid: 'test',
      isMain: true,
    });
    expect(result.result).toContain('conductor.md');
    expect(result.result).toContain('email-check.md');
  });

  it('agent can write to global folder (main only)', async () => {
    const result = await runContainerAgent({
      prompt: 'Write "test" to /workspace/global/test-write.txt, then read it back.',
      groupFolder: 'whatsapp_main',
      chatJid: 'test',
      isMain: true,
    });
    expect(result.result).toContain('test');
    // Clean up
    fs.unlinkSync('groups/global/test-write.txt');
  });

  it('Gmail MCP tools are available', async () => {
    const result = await runContainerAgent({
      prompt: 'List your available MCP tools that start with mcp__gmail. Just list the tool names.',
      groupFolder: 'whatsapp_main',
      chatJid: 'test',
      isMain: true,
    });
    expect(result.result).toContain('gmail');
  });

  it('Calendar MCP tools are available', async () => {
    const result = await runContainerAgent({
      prompt: 'List your available MCP tools that start with mcp__gcal. Just list the tool names.',
      groupFolder: 'whatsapp_main',
      chatJid: 'test',
      isMain: true,
    });
    expect(result.result).toContain('gcal');
  });
});
```

### Tier 3: LLM-as-Judge Classification Tests (~$0.50/run)

Test that the email triage logic produces correct classifications on known inputs. Uses a second Claude call to judge the agent's output.

```typescript
// test/wintermute/triage-eval.test.ts

const TEST_EMAILS = [
  {
    from: 'tiana@boost.co.nz',    // VIP
    subject: 'Need your approval on the Q2 budget',
    body: 'Hi Nathan, can you review and approve the Q2 budget by Friday?',
    expected: 'action-needed',
    reason: 'VIP, direct ask, real deadline',
  },
  {
    from: 'promotions@shopify.com',
    subject: '50% off Shopify Plus',
    body: 'Upgrade your plan today...',
    expected: 'skip',
    reason: 'Promotional, not VIP, no urgency',
  },
  {
    from: 'noreply@anz.co.nz',
    subject: 'Unusual activity on your account',
    body: 'We detected unusual activity...',
    expected: 'action-needed',
    reason: 'noreply@ with urgency signal (fraud)',
  },
  {
    from: 'sean@boost.co.nz',     // VIP
    subject: 'FYI: Sprint retro notes',
    body: 'Here are the notes from today\'s retro...',
    expected: 'fyi',
    reason: 'VIP but informational, no action required',
  },
  {
    from: 'updates@linkedin.com',
    subject: 'You have 5 new notifications',
    body: 'See what\'s happening in your network...',
    expected: 'skip',
    reason: 'Social/promotional, not VIP',
  },
];

describe('Email triage classification', () => {
  for (const email of TEST_EMAILS) {
    it(`classifies "${email.subject}" as ${email.expected}`, async () => {
      const prompt = `
        You are testing the email triage system.
        Read /workspace/global/skills/email-check.md for the triage rules.
        Read /workspace/global/knowledge/comms/vips.md for the VIP list.

        Classify this email using ONLY the rules in email-check.md:
        From: ${email.from}
        Subject: ${email.subject}
        Body: ${email.body}

        Output ONLY one word: action-needed, fyi, or skip.
      `;

      const result = await runContainerAgent({
        prompt,
        groupFolder: 'whatsapp_main',
        chatJid: 'test',
        isMain: true,
      });

      const classification = result.result?.trim().toLowerCase();
      expect(classification).toBe(email.expected);
    });
  }
});
```

### Tier 4: End-to-End Flow Tests (~$2-3/run)

Test complete flows: "what's up?" trigger → conductor → email-check → output.

```typescript
// test/wintermute/e2e-flow.test.ts

describe('Status check flow', () => {
  it('responds to "what\'s up?" with email and calendar summary', async () => {
    const result = await runContainerAgent({
      prompt: "what's up?",
      groupFolder: 'whatsapp_main',
      chatJid: '6421339114@s.whatsapp.net',
      isMain: true,
    });

    // Should contain email triage markers
    expect(result.result).toMatch(/📬|email|inbox/i);
    // Should contain calendar section
    expect(result.result).toMatch(/📅|calendar|meeting|no more meetings/i);
  });

  it('morning briefing produces structured output', async () => {
    const result = await runContainerAgent({
      prompt: '[SCHEDULED TASK] Read /workspace/global/skills/morning-briefing.md and follow it.',
      groupFolder: 'whatsapp_main',
      chatJid: '6421339114@s.whatsapp.net',
      isMain: true,
      isScheduledTask: true,
    });

    expect(result.result).toContain('Good morning');
  });
});
```

### Tier 5: Self-Reflection Safety Tests (~$1/run)

Test that self-reflection produces valid edits and commits.

```typescript
// test/wintermute/self-reflect-safety.test.ts

describe('Self-reflection safety', () => {
  it('produces valid markdown in self-reflection.md', async () => {
    const result = await runContainerAgent({
      prompt: '[SCHEDULED TASK] Read /workspace/global/skills/self-reflect.md and follow it.',
      groupFolder: 'whatsapp_main',
      chatJid: '6421339114@s.whatsapp.net',
      isMain: true,
      isScheduledTask: true,
    });

    const reflection = fs.readFileSync('groups/global/self-reflection.md', 'utf-8');
    // Should have date header
    expect(reflection).toMatch(/## \d{4}-\d{2}-\d{2}/);
    // Should have score table
    expect(reflection).toMatch(/\| .+ \| \d\/5 \|/);
  });

  it('skill edits are committed to git', async () => {
    // After self-reflection, check git log for commit
    const log = execSync('cd groups/global && git log --oneline -1 2>/dev/null || echo "no commits"');
    // If a commit exists, it should mention self-reflect
    if (!log.toString().includes('no commits')) {
      expect(log.toString()).toContain('self-reflect');
    }
  });

  it('skill edits preserve required sections', async () => {
    // After self-reflection, verify no skill lost its core sections
    const emailCheck = fs.readFileSync('groups/global/skills/email-check.md', 'utf-8');
    expect(emailCheck).toContain('First Pass: Noise Filter');
    expect(emailCheck).toContain('Second Pass: Classification');
    expect(emailCheck).toContain('Check Procedure');
  });
});
```

## Running Tests

```bash
# Tier 1: Infrastructure (free, <2s)
npx vitest run test/wintermute/mounts.test.ts
npx vitest run test/wintermute/files.test.ts
npx vitest run test/wintermute/references.test.ts

# Tier 2: Container smoke (free, ~30s)
npx vitest run test/wintermute/container-smoke.test.ts

# Tier 3: Classification eval (~$0.50)
npx vitest run test/wintermute/triage-eval.test.ts

# Tier 4: E2E flows (~$2-3)
npx vitest run test/wintermute/e2e-flow.test.ts

# Tier 5: Self-reflection safety (~$1)
npx vitest run test/wintermute/self-reflect-safety.test.ts

# All tiers
npx vitest run test/wintermute/
```

## Test Fixtures

### Email Fixtures (`test/wintermute/fixtures/emails.json`)

A corpus of test emails with expected classifications. Categories:
- VIP emails (action-needed and fyi variants)
- Promotional noise (should be skipped)
- Urgency signals from unknown senders (should pass through)
- noreply@ senders with fraud/security alerts
- Edge cases: VIP in CC but not To, thread replies, forwarded messages

### VIP Fixture (`test/wintermute/fixtures/vips-test.md`)

A subset of the real VIP list for deterministic testing. Tests should use this fixture rather than the live `vips.md` to avoid flaky results when VIPs are added.

## Continuous Validation

### On Every Commit
- Tier 1 runs in the pre-commit hook (via husky, already configured)
- Catches: missing files, broken cross-references, invalid structure

### Weekly (alongside self-reflection)
- Tier 3 classification eval runs after self-reflection
- Compares current triage accuracy against baseline
- If accuracy drops below threshold, flags for manual review

### On Skill Edits
- When self-reflection edits a skill file, Tier 1 file validation runs immediately
- Ensures the edit didn't break required sections or cross-references

## Proposed Implementation Order

1. **Tier 1 tests first** — validate what we just built, catch structural issues now
2. **Email fixtures** — build the test corpus from real-world examples
3. **Tier 3 classification eval** — baseline triage accuracy before self-reflection starts changing rules
4. **Tier 2 container smoke** — verify mount and MCP access patterns
5. **Tier 4-5 later** — after the system has run for a week and we have real data

## Cost Estimate

| Tier | Per Run | Frequency | Monthly Cost |
|------|---------|-----------|-------------|
| Tier 1 | Free | Every commit | $0 |
| Tier 2 | Free | Daily CI | $0 |
| Tier 3 | ~$0.50 | Weekly | ~$2 |
| Tier 4 | ~$2.50 | Weekly | ~$10 |
| Tier 5 | ~$1.00 | Weekly | ~$4 |
| **Total** | | | **~$16/month** |
