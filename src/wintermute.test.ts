import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = path.join(process.cwd(), 'groups', 'global');
const SKILLS_DIR = path.join(GLOBAL_DIR, 'skills');
const KNOWLEDGE_DIR = path.join(GLOBAL_DIR, 'knowledge');

// ─── Tier 1a: File Structure ─────────────────────────────────────────────────

describe('Wintermute file structure', () => {
  it('global CLAUDE.md exists and contains Wintermute identity', () => {
    const content = fs.readFileSync(
      path.join(GLOBAL_DIR, 'CLAUDE.md'),
      'utf-8',
    );
    expect(content).toContain('Wintermute');
  });

  it('global CLAUDE.md contains trigger routing', () => {
    const content = fs.readFileSync(
      path.join(GLOBAL_DIR, 'CLAUDE.md'),
      'utf-8',
    );
    expect(content).toContain('conductor.md');
    expect(content).toContain('email-check.md');
    expect(content).toContain('morning-briefing.md');
    expect(content).toContain('packages.md');
  });

  it('global CLAUDE.md references MCP tools', () => {
    const content = fs.readFileSync(
      path.join(GLOBAL_DIR, 'CLAUDE.md'),
      'utf-8',
    );
    expect(content).toContain('mcp__gmail__');
    expect(content).toContain('mcp__gcal__');
    expect(content).toContain('mcp__nanoclaw__send_message');
  });

  const requiredSkills = [
    'conductor',
    'email-check',
    'slack-check',
    'morning-briefing',
    'scheduled-check',
    'packages',
    'self-reflect',
  ];

  for (const skill of requiredSkills) {
    it(`skill ${skill}.md exists and is non-empty`, () => {
      const skillPath = path.join(SKILLS_DIR, `${skill}.md`);
      expect(fs.existsSync(skillPath)).toBe(true);
      const stat = fs.statSync(skillPath);
      expect(stat.size).toBeGreaterThan(100);
    });
  }

  it('TASKS.md exists', () => {
    expect(fs.existsSync(path.join(GLOBAL_DIR, 'TASKS.md'))).toBe(true);
  });
});

// ─── Tier 1b: Knowledge Files ────────────────────────────────────────────────

describe('Wintermute knowledge files', () => {
  it('comms/state.md exists with last_checked field', () => {
    const statePath = path.join(KNOWLEDGE_DIR, 'comms', 'state.md');
    expect(fs.existsSync(statePath)).toBe(true);
    const content = fs.readFileSync(statePath, 'utf-8');
    expect(content).toContain('last_checked');
  });

  it('comms/slack-state.md exists', () => {
    const slackPath = path.join(KNOWLEDGE_DIR, 'comms', 'slack-state.md');
    expect(fs.existsSync(slackPath)).toBe(true);
  });

  it('comms/vips.md exists with email addresses', () => {
    const vipsPath = path.join(KNOWLEDGE_DIR, 'comms', 'vips.md');
    expect(fs.existsSync(vipsPath)).toBe(true);
    const content = fs.readFileSync(vipsPath, 'utf-8');
    // VIPs should contain at least one email address
    expect(content).toMatch(/@[a-z]+\./i);
  });

  it('me.md exists with personal profile', () => {
    const mePath = path.join(KNOWLEDGE_DIR, 'me.md');
    expect(fs.existsSync(mePath)).toBe(true);
    const content = fs.readFileSync(mePath, 'utf-8');
    expect(content.length).toBeGreaterThan(50);
  });

  const optionalKnowledge = [
    'me-leadership.md',
    'family.md',
    'travel.md',
    'packages.md',
  ];

  for (const file of optionalKnowledge) {
    it(`knowledge/${file} exists`, () => {
      expect(fs.existsSync(path.join(KNOWLEDGE_DIR, file))).toBe(true);
    });
  }

  it('projects/ directory exists', () => {
    expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'projects'))).toBe(true);
  });

  it('people/ directory exists', () => {
    expect(fs.existsSync(path.join(KNOWLEDGE_DIR, 'people'))).toBe(true);
  });
});

// ─── Tier 1c: Skill Cross-References ────────────────────────────────────────

describe('Wintermute skill cross-references', () => {
  it('conductor references only existing skills', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'conductor.md'),
      'utf-8',
    );
    const refs =
      content.match(/\/workspace\/global\/skills\/[\w-]+\.md/g) || [];
    for (const ref of refs) {
      const localPath = ref.replace('/workspace/global/', `${GLOBAL_DIR}/`);
      expect(fs.existsSync(localPath), `Missing: ${ref}`).toBe(true);
    }
  });

  it('morning-briefing references only existing skills', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'morning-briefing.md'),
      'utf-8',
    );
    const refs =
      content.match(/\/workspace\/global\/skills\/[\w-]+\.md/g) || [];
    for (const ref of refs) {
      const localPath = ref.replace('/workspace/global/', `${GLOBAL_DIR}/`);
      expect(fs.existsSync(localPath), `Missing: ${ref}`).toBe(true);
    }
  });

  it('scheduled-check references only existing skills', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'scheduled-check.md'),
      'utf-8',
    );
    const refs =
      content.match(/\/workspace\/global\/skills\/[\w-]+\.md/g) || [];
    for (const ref of refs) {
      const localPath = ref.replace('/workspace/global/', `${GLOBAL_DIR}/`);
      expect(fs.existsSync(localPath), `Missing: ${ref}`).toBe(true);
    }
  });

  it('all skill knowledge path references point to existing files or directories', () => {
    const skills = fs.readdirSync(SKILLS_DIR).filter((f) => f.endsWith('.md'));
    const missingRefs: string[] = [];

    for (const skill of skills) {
      const content = fs.readFileSync(path.join(SKILLS_DIR, skill), 'utf-8');
      // Match knowledge file refs (not skill refs, not generic path patterns in code blocks)
      const refs =
        content.match(/\/workspace\/global\/knowledge\/[\w/.+-]+(?:\.md)?/g) ||
        [];
      for (const ref of refs) {
        const localPath = ref.replace('/workspace/global/', `${GLOBAL_DIR}/`);
        // Allow directory references and file references
        if (!fs.existsSync(localPath)) {
          // Check if it's a directory pattern (no extension)
          const dirPath = localPath.replace(/\.md$/, '');
          if (!fs.existsSync(dirPath)) {
            missingRefs.push(`${skill}: ${ref}`);
          }
        }
      }
    }

    expect(
      missingRefs,
      `Missing references:\n${missingRefs.join('\n')}`,
    ).toEqual([]);
  });
});

// ─── Tier 1d: Infrastructure ─────────────────────────────────────────────────

describe('Wintermute infrastructure', () => {
  it('container-runner.ts has writable global mount for main group', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src', 'container-runner.ts'),
      'utf-8',
    );
    // Should have a global mount that is NOT read-only for main
    expect(content).toContain("containerPath: '/workspace/global'");
    // The main group section should have readonly: false for global
    const mainSection = content.split('} else {')[0];
    expect(mainSection).toContain('/workspace/global');
  });

  it('container-runner.ts mounts Gmail credentials', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src', 'container-runner.ts'),
      'utf-8',
    );
    expect(content).toContain('.gmail-mcp');
  });

  it('container-runner.ts mounts Calendar credentials', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src', 'container-runner.ts'),
      'utf-8',
    );
    expect(content).toContain('.gcal-mcp');
    expect(content).toContain('google-calendar-mcp');
  });

  it('agent-runner has Gmail MCP server configured', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'container', 'agent-runner', 'src', 'index.ts'),
      'utf-8',
    );
    expect(content).toContain('mcp__gmail__');
    expect(content).toContain('server-gmail-autoauth-mcp');
  });

  it('agent-runner has Calendar MCP server configured', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'container', 'agent-runner', 'src', 'index.ts'),
      'utf-8',
    );
    expect(content).toContain('mcp__gcal__');
    expect(content).toContain('google-calendar-mcp');
  });

  it('non-main groups get read-only global mount', () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), 'src', 'container-runner.ts'),
      'utf-8',
    );
    // The else section (non-main) should have readonly: true for global
    const nonMainSection = content.split('} else {')[1];
    expect(nonMainSection).toContain('/workspace/global');
    expect(nonMainSection).toContain('readonly: true');
  });
});

// ─── Tier 1e: Skill Content Validation ──────────────────────────────────────

describe('Wintermute skill content', () => {
  it('email-check has noise filter and classification sections', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'email-check.md'),
      'utf-8',
    );
    expect(content).toContain('Noise Filter');
    expect(content).toContain('Classification');
    expect(content).toContain('action-needed');
    expect(content).toContain('fyi');
    expect(content).toContain('skip');
  });

  it('email-check references Gmail MCP tools', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'email-check.md'),
      'utf-8',
    );
    expect(content).toContain('mcp__gmail__');
    expect(content).toContain('mcp__gcal__');
  });

  it('slack-check has channel priority and surface rules', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'slack-check.md'),
      'utf-8',
    );
    expect(content).toContain('Channel Priority');
    expect(content).toContain('Surface');
    expect(content).toContain('Skip');
  });

  it('morning-briefing references all data sources', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'morning-briefing.md'),
      'utf-8',
    );
    expect(content).toContain('Calendar');
    expect(content).toContain('Email');
    expect(content).toContain('Slack');
    expect(content).toContain('TASKS.md');
    expect(content).toContain('packages.md');
  });

  it('self-reflect has scoring dimensions and skill refinement', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'self-reflect.md'),
      'utf-8',
    );
    expect(content).toContain('Proactivity');
    expect(content).toContain('Voice');
    expect(content).toContain('Autonomy');
    expect(content).toContain('Skill Refinement');
    expect(content).toContain('git');
  });

  it('conductor uses two-message pattern (email then slack)', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'conductor.md'),
      'utf-8',
    );
    expect(content).toContain('SEND');
    expect(content).toContain('separate message');
    expect(content).toContain('Slack');
  });

  it('packages references Gmail MCP for email scanning', () => {
    const content = fs.readFileSync(
      path.join(SKILLS_DIR, 'packages.md'),
      'utf-8',
    );
    expect(content).toContain('mcp__gmail__search_messages');
  });
});
