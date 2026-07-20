# Outline: Two Weeks with an AI Co-Developer

**Pillar:** agentic-stack
**Target:** 3,000-3,500 words
**Status:** outlined
**Source material:** memory/*.md, memory/reflections/*.md, AGENTS.md, SOUL.md, MEMORY.md, PR history

## Thesis

Two weeks of working with an AI agent as a genuine co-developer, not a chatbot. What actually works, what breaks, and what we learned. Backed by real data: 43 PRs across 3 repos, 16 daily logs, 9 reflections, and the system configuration files that evolved along the way.

## Structure

### Opening: The Setup
What OpenClaw is. An AI agent running on a homeserver, with memory, cron jobs, tool access, and a persistent workspace. Not ChatGPT in a browser tab. A collaborator that wakes up, checks its daily files, and gets to work.

### What Works: The Wins
- Application generation pipeline (full packages in minutes)
- Coffee scraper supplier onboarding (8 suppliers added in one week)
- Blog infrastructure + content (built and shipped 2 posts)
- Codebase refactoring with test coverage (81 unit tests, phased approach)
- Proactive system improvement (found and fixed its own issues)
- The "economy of directors" in practice

### What Breaks: The Failures
- Context loss incidents (root cause: system problem, not personality)
- Factual errors propagating through memory (Gates Foundation vs Corporation)
- Automated content quality (LinkedIn DMs too templated, needed iterations)
- Geographic reasoning (wrong date night suggestions)
- Fixing symptoms before diagnosing root cause (wasted PR cycles)
- Booking errors (wrong dates for Japan trip)

### The Evolution: How the System Improved
- AGENTS.md grew from basic to comprehensive
- Safety rules added reactively (Kaseware → hard military exclusion)
- "No mental notes" rule after context loss incidents
- Git workflow discipline codified after PR mistakes
- Context pruning configured after forgetfulness episodes
- Self-monitoring principle: mistakes → root cause analysis, not apologies

### The Numbers
- 43 PRs across 3 repos in 18 days
- 16 daily logs, 9 reflections
- 12 suppliers in coffee scraper
- 81 unit tests in purveyors app
- ~$1.13 per full application prep

### Closing: Is This the Future?
Honest assessment. The leverage is real but not magic. The system needs constant tuning. The wins compound but so do the failure modes. The interesting question: does this get better faster than the problems multiply?
