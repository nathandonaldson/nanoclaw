# NanoClaw RAG Setup — MCP-Markdown-RAG

**Date:** 2026-04-01
**Status:** Ready to implement

Set up MCP-Markdown-RAG as a semantic search engine for NanoClaw. Indexes all of Wintermute's knowledge files (markdown) and makes them searchable via MCP tools. The agent inside NanoClaw containers calls `search` to find relevant context instead of having to know which file to read.

## Step 1: Install MCP-Markdown-RAG

```bash
cd ~/Projects  # or wherever you keep tools
git clone https://github.com/Zackriya-Solutions/MCP-Markdown-RAG.git
cd MCP-Markdown-RAG
```

Ensure `uv` (Python package manager) is installed. If not: `brew install uv`

Test it runs: `uv run server.py --help` or just `uv run server.py` (it should start and wait for MCP connections)

## Step 2: Initial index

The RAG server needs to index the NanoClaw knowledge directory. From Claude Code or a terminal, call the `index_documents` tool with:
- directory: the absolute path to `<nanoclaw-project>/groups/global/knowledge/`
- recursive: true

This will chunk all markdown files by headings, generate embeddings locally (~50MB model downloads on first run), and store vectors in a local Milvus file DB.

## Step 3: Configure NanoClaw containers to access it

The RAG server runs on the host via stdio. NanoClaw agent containers need to reach it. Two approaches — try whichever is simpler:

**Approach A: Mount into container**
Add the MCP-Markdown-RAG directory as a mount in the NanoClaw container config, then configure it as a local MCP server in the container's `.claude/settings.json`. This requires Python in the container (the Dockerfile currently only has Node.js — you'd need to add `python3` and `python3-pip` to the apt-get install, and install `uv` in the container).

**Approach B: HTTP proxy**
Run MCP-Markdown-RAG behind a simple HTTP-to-stdio bridge on the host (e.g. `mcp-proxy` or `supergateway`). The container connects via `host.docker.internal:<port>`. This avoids adding Python to the container but adds a network hop.

Pick whichever works. The goal is that the agent inside the container can call `search(query="who handles EONZ accounting?")` and get back relevant markdown chunks.

## Step 4: Update NanoClaw CLAUDE.md

Add the RAG search tool to the Knowledge Retrieval section in `groups/global/CLAUDE.md`. The current instructions tell the agent to read specific files. Add semantic search as the first option:

```markdown
## Knowledge Retrieval

When you don't know something or need to verify a fact:
1. `context.md` has the hot cache — check it first (already loaded)
2. **Semantic search:** call `search(query="your question")` to find relevant knowledge across all files
3. For email history: search via `mcp__gmail__search_messages`

If a question mentions a name, project, or term not in `context.md`, search before answering.
```

## Step 5: Test

Send a message to Wintermute via WhatsApp/Telegram:
- "who handles EONZ accounting?" — should find Clockworx/Katrina from vips.md or context.md
- "what's the arrears policy?" — should find the policy details from projects/eo.md
- "who's Blair?" — should find the WithKnives context

Verify it's using the search tool rather than guessing. Check the container logs for the MCP tool calls.

## Step 6: Auto-reindex

Set up a NanoClaw scheduled task that re-indexes the knowledge directory daily (or whenever files change):

```
schedule_task(
  prompt: "Re-index knowledge files for RAG",
  schedule_type: "cron",
  schedule_value: "0 3 * * *",
  script: "cd ~/Projects/MCP-Markdown-RAG && uv run server.py --index /path/to/groups/global/knowledge/ --recursive"
)
```

Or configure MCP-Markdown-RAG's file watcher if it supports it — check their docs.

## Dependencies

- [MCP-Markdown-RAG](https://github.com/Zackriya-Solutions/MCP-Markdown-RAG)
- `uv` (Python package manager)
- Python 3.x on Mac mini
- Either Python in the container (Approach A) or an HTTP MCP bridge (Approach B)
