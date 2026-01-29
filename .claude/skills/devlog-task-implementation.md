# Skill: DEVLOG Task Implementation

## Overview
This skill covers reading a development log (DEVLOG), identifying implementable tasks, executing them efficiently, and maintaining good documentation through commits and task tracking.

## When to Use
- User asks to "implement tasks from DEVLOG/TODO"
- User wants to tackle "easy wins" or "quick fixes"
- User requests work on frontend/UI improvements that don't require backend changes

## Workflow

### 1. Locate and Read the Task Source
```
- Search for DEVLOG.md, TODO.md, or similar files in project root or /notes directory
- Common patterns: **/DEVLOG*, **/TODO*, **/tasks*, **/*TODOS*
- Read the entire file to understand scope and priorities
```

### 2. Categorize Tasks by Implementability

**Implementable (Easy Wins):**
- CSS/styling changes (opacity, colors, spacing)
- UI text changes
- Adding/removing HTML elements
- TypeScript type fixes
- Component prop additions
- Form field additions (if data structure allows)
- Whitespace/formatting fixes
- Visual feedback additions (notifications, animations)

**Requires External Changes (Skip):**
- Database schema changes (Supabase migrations)
- New API endpoints requiring backend setup
- Environment variable additions
- Third-party service integrations
- Deployment configuration (Vercel, etc.)

### 3. Create Todo List
Use TodoWrite immediately after identifying tasks:
```typescript
// Example structure
[
  { content: "Fix [specific issue]", status: "pending", activeForm: "Fixing [specific issue]" },
  { content: "Add [feature]", status: "pending", activeForm: "Adding [feature]" },
  // ... more tasks
]
```

### 4. Implementation Pattern for Each Task

**a. Mark task as in_progress**
```typescript
// Update todo status before starting work
```

**b. Search and understand context**
```bash
# Find relevant files
Grep: pattern for the feature/component
Glob: **/*ComponentName*

# Read the files to understand current implementation
Read: /path/to/component.svelte
```

**c. Make targeted changes**
- Use Edit tool for modifications
- Keep changes minimal and focused
- Follow existing code patterns

**d. Verify task is actually needed**
- Some tasks may already be complete
- Check if the issue still exists before implementing

**e. Commit immediately after completing each task**
```bash
git add [specific files] && git commit -m "$(cat <<'EOF'
type: brief description

More detailed explanation if needed.
- Bullet points for multiple changes

https://claude.ai/code/session_[ID]
EOF
)"
```

**f. Mark task as completed and move to next**

### 5. Commit Message Conventions
```
fix: bug fixes, typo corrections
feat: new features, additions
style: CSS/styling changes only
refactor: code restructuring without behavior change
docs: documentation updates
```

### 6. Push Frequency
- Push after every 2-3 commits, or
- Push after completing a logical group of related tasks
- Always push before ending session

### 7. Common Patterns Encountered

**CSS Fixes:**
```svelte
<!-- Typo: space-pre-wrap → whitespace-pre-wrap -->
class="whitespace-pre-wrap"
```

**Opacity/Visual Adjustments:**
```javascript
.attr('stroke-opacity', 0.5)  // Reduced from 1
.attr('stroke-width', 1.5)    // Reduced from 2
```

**Adding Form Fields:**
1. Update type definition (if needed)
2. Add state variable
3. Add UI element
4. Update handlers/reset functions

**Visual Feedback:**
```svelte
let feedback = $state<{message: string, type: string} | null>(null);

function showFeedback(msg, type) {
  feedback = { message: msg, type };
  setTimeout(() => feedback = null, 3000);
}
```

### 8. Verification Steps
- Tasks marked as "already complete" should be verified by:
  1. Searching codebase for the feature
  2. Reading relevant components
  3. Confirming the functionality exists

### 9. Session Summary Template
```markdown
## Completed Tasks
1. **fix: [description]** - [brief explanation]
2. **feat: [description]** - [brief explanation]

## Verified as Already Complete
- [Task] - [reason it was already done]

## Skipped (Requires External Changes)
- [Task] - requires [Supabase/Vercel/etc.]
```

## Example Session Flow

```
1. Read DEVLOG.md
2. Identify 8 tasks, 6 implementable
3. Create TodoWrite with 6 items
4. For each task:
   - Mark in_progress
   - Search codebase for context
   - Implement or verify complete
   - Commit with descriptive message
   - Mark completed
5. Push all changes
6. Provide summary to user
```

## Key Principles
- **Commit often** - Each logical change gets its own commit
- **Verify before implementing** - Task may already be done
- **Stay focused** - Don't scope-creep into unrelated fixes
- **Document clearly** - Commit messages explain the "why"
- **Skip external dependencies** - Note them but don't attempt
