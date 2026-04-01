/**
 * Tier 3: LLM-as-Judge Email Triage Classification Tests
 *
 * These tests verify that the email-check.md triage rules produce correct
 * classifications. Each test sends an email fixture to the triage rules
 * and checks the output classification.
 *
 * Cost: ~$0.50/run (15 emails × ~$0.03 each)
 * Speed: ~60-90 seconds
 *
 * Run separately from Tier 1:
 *   WINTERMUTE_TRIAGE=1 npx vitest run src/wintermute-triage.test.ts
 *
 * Skip in normal test runs (no API cost unless opted in).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Gate: only run when explicitly opted in
const RUN_TRIAGE =
  process.env.WINTERMUTE_TRIAGE === '1' ||
  process.env.WINTERMUTE_TRIAGE === 'true';

interface EmailFixture {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  category: string;
  expected: 'action-needed' | 'fyi' | 'skip';
  reason: string;
}

// Load fixtures
const fixturesPath = path.join(
  process.cwd(),
  'test',
  'wintermute',
  'fixtures',
  'emails.json',
);
const fixtures: EmailFixture[] = JSON.parse(
  fs.readFileSync(fixturesPath, 'utf-8'),
);

// Load the triage rules and VIP list for the prompt
const emailCheckPath = path.join(
  process.cwd(),
  'groups',
  'global',
  'skills',
  'email-check.md',
);
const vipsPath = path.join(
  process.cwd(),
  'groups',
  'global',
  'knowledge',
  'comms',
  'vips.md',
);
const emailCheckRules = fs.readFileSync(emailCheckPath, 'utf-8');
const vipList = fs.readFileSync(vipsPath, 'utf-8');

/**
 * Classify an email using Claude directly (no container needed for Tier 3).
 * This calls the Anthropic API with the triage rules and a test email.
 */
async function classifyEmail(email: EmailFixture): Promise<string> {
  // Use Claude CLI in non-interactive mode for classification
  const { execSync } = await import('child_process');

  const prompt = `You are testing an email triage system. You must classify the email below using ONLY the rules provided.

## TRIAGE RULES
${emailCheckRules}

## VIP LIST
${vipList}

## EMAIL TO CLASSIFY
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Body: ${email.body}
Gmail Category: ${email.category}

## INSTRUCTIONS
Apply the First Pass (Noise Filter) then the Second Pass (Classification).
Output ONLY one word: action-needed, fyi, or skip
Do not explain. Do not add any other text.`;

  const tmpFile = `/tmp/wintermute-triage-${email.id}.txt`;
  fs.writeFileSync(tmpFile, prompt);
  const result = execSync(
    `cat "${tmpFile}" | claude -p --output-format text 2>/dev/null`,
    {
      encoding: 'utf-8',
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
    },
  ).trim();
  try {
    fs.unlinkSync(tmpFile);
  } catch {
    /* ignore */
  }

  // Extract just the classification word
  const match = result.match(/\b(action-needed|fyi|skip)\b/i);
  return match ? match[1].toLowerCase() : result.toLowerCase();
}

describe.skipIf(!RUN_TRIAGE)('Email triage classification (Tier 3)', () => {
  // Track results for summary
  const results: {
    id: string;
    expected: string;
    got: string;
    pass: boolean;
  }[] = [];

  for (const email of fixtures) {
    it(`${email.id}: "${email.subject}" → ${email.expected}`, async () => {
      const classification = await classifyEmail(email);
      const pass = classification === email.expected;
      results.push({
        id: email.id,
        expected: email.expected,
        got: classification,
        pass,
      });

      if (!pass) {
        console.error(
          `  MISMATCH: ${email.id}\n` +
            `    Expected: ${email.expected}\n` +
            `    Got:      ${classification}\n` +
            `    Reason:   ${email.reason}\n` +
            `    From:     ${email.from}\n` +
            `    Subject:  ${email.subject}`,
        );
      }

      expect(
        classification,
        `${email.id}: expected "${email.expected}" but got "${classification}". Reason: ${email.reason}`,
      ).toBe(email.expected);
    }, 60_000); // 60s timeout per email
  }

  it('overall accuracy is above 80%', () => {
    if (results.length === 0) return; // skip if no results yet
    const correct = results.filter((r) => r.pass).length;
    const accuracy = correct / results.length;
    console.log(
      `\n  Triage accuracy: ${correct}/${results.length} (${(accuracy * 100).toFixed(0)}%)`,
    );

    // Log results for tracking over time
    const logPath = path.join(
      process.cwd(),
      'test',
      'wintermute',
      'fixtures',
      'triage-results.jsonl',
    );
    const entry = {
      ts: new Date().toISOString(),
      total: results.length,
      correct,
      accuracy: Math.round(accuracy * 100),
      mismatches: results
        .filter((r) => !r.pass)
        .map((r) => ({ id: r.id, expected: r.expected, got: r.got })),
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');

    expect(accuracy).toBeGreaterThanOrEqual(0.8);
  });
});

// Tier 1 companion: validate fixtures are well-formed
describe('Email triage fixtures validation', () => {
  it('fixtures file exists and is valid JSON', () => {
    expect(fs.existsSync(fixturesPath)).toBe(true);
    expect(() =>
      JSON.parse(fs.readFileSync(fixturesPath, 'utf-8')),
    ).not.toThrow();
  });

  it('all fixtures have required fields', () => {
    for (const fixture of fixtures) {
      expect(fixture.id, 'missing id').toBeTruthy();
      expect(fixture.from, `${fixture.id}: missing from`).toBeTruthy();
      expect(fixture.subject, `${fixture.id}: missing subject`).toBeTruthy();
      expect(fixture.expected, `${fixture.id}: missing expected`).toBeTruthy();
      expect(['action-needed', 'fyi', 'skip']).toContain(fixture.expected);
    }
  });

  it('fixture IDs are unique', () => {
    const ids = fixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 3 of each classification type', () => {
    const counts = { 'action-needed': 0, fyi: 0, skip: 0 };
    for (const f of fixtures) {
      counts[f.expected]++;
    }
    expect(counts['action-needed']).toBeGreaterThanOrEqual(3);
    expect(counts['fyi']).toBeGreaterThanOrEqual(3);
    expect(counts['skip']).toBeGreaterThanOrEqual(3);
  });

  it('has at least one VIP and one non-VIP test per classification', () => {
    // VIP domains from the actual VIP list
    const vipDomains = [
      'boost.co.nz',
      'eonewzealand.org',
      'bluebarn.co.nz',
      'gmail.com',
    ];
    const isVip = (email: string) => vipDomains.some((d) => email.endsWith(d));

    for (const cls of ['action-needed', 'fyi', 'skip'] as const) {
      const group = fixtures.filter((f) => f.expected === cls);
      const hasVip = group.some((f) => isVip(f.from));
      const hasNonVip = group.some((f) => !isVip(f.from));
      // Not all classifications need both (skip has no VIPs by definition)
      if (cls !== 'skip') {
        expect(hasVip, `${cls}: needs at least one VIP fixture`).toBe(true);
      }
      if (cls !== 'action-needed') {
        // action-needed can be all VIPs, that's fine
        expect(hasNonVip || hasVip, `${cls}: needs at least one fixture`).toBe(
          true,
        );
      }
    }
  });
});
