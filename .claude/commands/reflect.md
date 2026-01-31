# /reflect - CLAUDE.md Recursive Improvement Command

You are an expert in prompt engineering, specializing in optimizing AI code assistant instructions. Your task is to analyze and improve the instruction files for Claude Code. Follow these steps carefully:

## Claude Instruction Files Scope

```
/CLAUDE.md
/.claude/commands/*
**/CLAUDE.md
.claude/settings.json
.claude/settings.local.json
```

## CLAUDE.md Best Practices

A well-crafted CLAUDE.md is the AI's "constitution" for your project, providing Claude with critical context so it generates code that fits your conventions and tools. It should document only essential project knowledge and rules in a clear, concise way.

### Core Elements

- **Tech Stack & Setup:** Specify language versions, frameworks, and environment setup commands (e.g. Python/pyenv setup, compiler requirements)
- **Project Structure:** Outline important directories/files (e.g. `src/`, `scripts/`) and their purposes. Avoid redundant explanations (if a folder is named `components`, you don't need to say it contains components)
- **Common Commands:** List frequent build/test/deploy commands (e.g. `npm run build`, `npm test`)
- **Code Style & Conventions:** State any linting or style rules (e.g. "Use ES modules, prefer arrow functions")
- **Do/Don't List:** Highlight any "do not touch" rules (e.g. "Do not modify legacy/ files" or "Do not push directly to main"). Mark important rules clearly (using **bold** or "IMPORTANT") so Claude treats them as absolute
- **Terminology:** Define any project-specific jargon or overloaded terms. Ambiguous terms should be explained so Claude interprets them correctly

### Format Requirements

- **Concise Format:** Keep all entries short and to-the-point. Use terse, declarative bullet points (e.g. "- `npm run build`: build project") and clear headings
- **Avoid Verbose Explanations:** Skip paragraphs of narrative and "nice-to-have" explanations
- **Imperative Voice:** Write commands as "Use X", "Avoid Y" to make instructions unmistakable
- **Token Efficiency:** Prioritize essential information that directly impacts code generation

---

## Phase 1: Analysis

### Step 1: Context Review

**Review the complete chat history in your context window.**

### Step 2: Current State Assessment

**Analyze the current claude instruction files against the session evidence:**

- Compare code and actions in this session to existing `<claude_instruction_files>`
- Identify gaps between documented rules and actual workflow needs
- Note any project patterns not captured in current documentation
- **Review custom slash commands in `.claude/commands/`** for improvement opportunities

### Step 3: Error Pattern Analysis

**Summarize mistakes made during the session and identify root causes:**

- Document specific errors that could have been prevented with better instructions
- Identify recurring correction patterns that suggest missing guidelines
- Note any workflow inefficiencies caused by unclear documentation

### Step 4: Coverage Gap Analysis

**Identify missing or problematic instructions:**

- Project workflows not documented
- Commands/tools used but not listed
- Overly wordy or redundant sections
- Ambiguous terminology that caused confusion
- Missing "do not" rules that would prevent common mistakes

---

## Phase 2: Interaction & Approval

**Present findings as a numbered action plan and wait for explicit human approval before implementing changes.**

### Output Format Requirements:

- **Use Claude's plan mode format** with numbered action items
- List each issue with its proposed fix
- Include brief justification for each change
- Use imperative, concise language for all proposals
- **DO NOT** implement changes until explicitly approved

### Required Elements:

1. **Clarifying Questions:** For unclear/missing items, ask specific questions
   - Example: "What is the preferred error handling pattern for API calls?"
   - Focus on workflow-critical details that impact code generation

2. **Concise Rewrites:** For each issue, suggest terse, imperative fixes
   - Format: "- Use X for Y scenarios"
   - Prioritize actionable instructions over explanatory text

3. **Improvement Justifications:** Briefly explain each change's value
   - Examples: "saves tokens", "prevents common error", "clarifies workflow"

---

## Phase 3: Implementation

**After explicit approval:** Make changes directly to the CLAUDE.md file.

### Implementation Standards:

- Apply ALL approved changes to the existing CLAUDE.md file
- Maintain consistent formatting and imperative voice
- Organize sections logically (setup → structure → commands → rules)
- Ensure all critical "do not" rules are clearly marked
- Remove redundant or verbose explanations

### Quality Checklist:

- [ ] All session errors addressed with specific rules
- [ ] Common commands documented with exact syntax
- [ ] Project-specific terminology defined
- [ ] Critical "do not" rules highlighted
- [ ] Verbose sections condensed to essential points
- [ ] Instructions use imperative voice throughout
- [ ] Custom slash commands documented and optimized
