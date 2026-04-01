---
name: sync-knowledge
description: Sync knowledge files from the Wintermute project into NanoClaw's global knowledge directory and re-index the RAG search engine. Use when knowledge has been updated in wintermute-claude and needs to be pulled into NanoClaw. Triggers on "sync knowledge", "update knowledge", "pull knowledge from wintermute", "re-index".
---

# Sync Knowledge

Pulls updated knowledge files from the Wintermute project into NanoClaw and re-indexes the RAG semantic search engine.

## Step 1: Pull both repos

```bash
cd /Users/musicmac/Documents/nanoclaw && git pull origin main 2>&1
cd /Users/musicmac/Documents/wintermute-claude && git pull 2>&1
```

If either pull fails, stop and report the error.

## Step 2: Copy knowledge files

```bash
WM="/Users/musicmac/Documents/wintermute-claude/knowledge"
NC="/Users/musicmac/Documents/nanoclaw/groups/global/knowledge"

# Core files
cp "$WM/comms/vips.md" "$NC/comms/vips.md"
cp "$WM/comms/state.md" "$NC/comms/state.md"
cp "$WM/comms/slack-state.md" "$NC/comms/slack-state.md"
cp "$WM/me.md" "$NC/me.md"
cp "$WM/me-leadership.md" "$NC/me-leadership.md" 2>/dev/null
cp "$WM/family.md" "$NC/family.md"
cp "$WM/travel.md" "$NC/travel.md"
cp "$WM/packages.md" "$NC/packages.md"

# Projects
cp "$WM/projects/"*.md "$NC/projects/" 2>/dev/null

# People
[ -d "$WM/people" ] && cp "$WM/people/"* "$NC/people/" 2>/dev/null

# New top-level files
for f in "$WM"/*.md; do
  base=$(basename "$f")
  [ ! -f "$NC/$base" ] && cp "$f" "$NC/$base" && echo "NEW: $base"
done

# New subdirectories (skip chat-summaries — wintermute-internal)
for d in "$WM"/*/; do
  base=$(basename "$d")
  case "$base" in comms|projects|people|chat-summaries) continue ;; esac
  if [ ! -d "$NC/$base" ]; then
    cp -r "$d" "$NC/$base" && echo "NEW DIR: $base"
  else
    cp "$d"*.md "$NC/$base/" 2>/dev/null
  fi
done

echo "---"
find "$NC" -name "*.md" | wc -l | tr -d ' '
echo " markdown files in nanoclaw knowledge"
```

## Step 3: Re-index RAG

Check if the RAG gateway is running:

```bash
lsof -i :8819 2>/dev/null | head -3
```

If not running, start it:

```bash
launchctl load ~/Library/LaunchAgents/com.nanoclaw.rag.plist
sleep 5
```

Re-index via stdio (clears stale chunks and re-indexes all files):

```bash
cd ~/Projects/MCP-Markdown-RAG && (echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"idx","version":"1.0"}}}'; sleep 3; echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}'; sleep 1; echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"index_documents","arguments":{"directory":"/Users/musicmac/Documents/nanoclaw/groups/global/knowledge","recursive":true,"current_working_directory":"/Users/musicmac/Documents/nanoclaw"}}}'; sleep 25) | uv run server.py 2>/dev/null | grep '"id":2'
```

The output should show `insert_count` and `processed_files`. Report the numbers.

## Step 4: Clear sessions and restart

```bash
sqlite3 /Users/musicmac/Documents/nanoclaw/store/messages.db "DELETE FROM sessions"
launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Step 5: Report

Tell the user:
- How many files were copied
- Any new files or directories added
- How many chunks were indexed
- Service restarted with fresh sessions
