---
name: boost-website
description: Boost website project — Sanity CMS + Astro + Netlify, managed by Nathan and Steph
---

# Boost Website

## Tech Stack
- **CMS**: Sanity
- **Frontend**: Astro
- **Hosting**: Netlify
- Pipeline: Sanity → Astro → Netlify

## Team
- **Nathan** — technical owner
- **Steph (Stephanie Allen, steph@boost.co.nz)** — content writer, non-technical. Has CMS content guide documentation.

## Key Decisions
- Steph should use **Claude Cowork** for any schema changes — not VS Code, terminal, or manual code editing. Nathan was explicit about this (from chat session on 2026-03-25).
- Content guide docs live at `docs/CONTENT-GUIDE.md` and `docs/Boost-Website-Content-Guide.docx` in the boost-website repo.
- A tech stack diagram Word doc was created for Steph as a visual/non-technical reference.

## Notable Fixes
- Fixed inconsistent text width in `CompoundContent.astro` — removed legacy `isHtmlContent` conditional from Contentful migration that gave HTML blocks full width while markdown blocks got 66% width. All standard text blocks now consistently use `large-8` (from chat session on 2026-03-25).

## Migration & Platform

- Replatformed from Middleman/Contentful/WordPress to Sanity CMS + Astro. Migration (7-12 days, Claude Code) finished Feb 2026.
- Production: boost-remapped.netlify.app | Staging: boost-remapped-staging.netlify.app | Studio: boost-remapped.sanity.studio
- Stack details: Astro 4.x, Sanity v3, Tailwind v4, Netlify
- Migration team: Sean, Shirley, Steph

(from mem0, synced 2026-03-25)

## Architecture

- Homepage renders from Sanity pageBuilder with 5 blocks
- Schema objects: accessibleImage, navItem, navColumn, seo, socialLink
- llms.txt implementation planned: curated `/llms.txt` (5-10 key pages) and `/llms-full.txt` (all Sanity content in Markdown)

(from mem0, synced 2026-03-25)
