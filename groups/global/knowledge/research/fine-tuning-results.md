# Fine-Tuning Experiment Results

**Date:** 2026-03-31 / 2026-04-01
**Conclusion:** Fine-tuning improves voice/style but cannot reliably override base model knowledge. RAG + good prompts is the better path.

## Models Trained

| Model | Examples | Test Score | Notes |
|-------|----------|-----------|-------|
| Maverick v1 | 51 (handwritten) | 2/10 | Identity + task capture worked |
| Maverick v2 | 398 (+347 email) | 5/10 | Voice improved, knowledge still wrong |
| Maverick v3 | 689 (+309 domain) | 5/10 | No improvement despite 130 EONZ examples |
| Scout v3 | 689 | Untested (dedicated endpoint) | Same cost issue |
| Qwen 3 235B v3 | 689 | Untested (dedicated endpoint) | Same cost issue |

## Key Findings

1. **Voice/style fine-tunes well** — terse responses, greeting patterns, task capture tone all improved
2. **Domain knowledge does not stick** — "Navigators", "MBO", "EONZ" all have strong priors in the base model that 130+ examples couldn't override
3. **Together AI serverless is unreliable** — v1/v2 got serverless, v3/Scout/Qwen all required dedicated endpoints at $0.50/min ($720/day)
4. **The real wins came from prompt engineering** — slimming NanoClaw's CLAUDE.md, adding the context.md hot cache, and sharpening triage rules improved quality more than fine-tuning did

## Assets Preserved

- `training/wintermute-v1.jsonl` — 51 handwritten examples
- `training/email-replies-v1.jsonl` — 329 email reply examples
- `training/domain-knowledge-v3.jsonl` — 309 domain knowledge examples
- `training/wintermute-combined-v3.jsonl` — 689 combined
- `training/people-from-emails.md` — 105 contacts from email analysis
- `training/build_training_data.py` — reusable corpus builder
- `bin/fine-tune`, `bin/test-model`, `bin/validate-training-data` — pipeline scripts

## When to Revisit

- Local hardware (Strix Halo / DGX Spark) eliminates inference cost
- Together AI fixes serverless for fine-tuned models
- More training data (Telegram export, Slack history) might cross the threshold
- Newer models may be more receptive to domain knowledge via LoRA
