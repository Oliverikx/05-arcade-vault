---
description: Create an isolated git worktree under .trees/ and execute the given task inside it
argument-hint: <task instructions>
---

You received this task: $ARGUMENTS

Execute it in an isolated git worktree, separate from the main code.

## Steps

1. Derive a short kebab-case name from the task (2-4 words, e.g. `add-hold-piece`, `fix-rotation-kick`). Do not ask the user for it.
2. Create the worktree from the current branch:
   `git worktree add .trees/<name> -b <name>`
   - If `.trees/<name>` or branch `<name>` already exists, append a suffix (`-2`, ...) and retry.
   - Verify `.trees` is in `.gitignore`; if not, add it.
3. Do ALL work for the task inside `.trees/<name>`. Use absolute paths under that directory for every read, edit and command (`git -C`, etc.). Never modify files in the main working tree.
4. Follow the project CLAUDE.md conventions (read it in the worktree copy).
5. Verify the change works (open/serve the worktree copy of `index.html`).
6. Commit on the worktree branch with a clear message. Do not merge, push, or remove the worktree unless asked.
7. Report concisely: worktree path, branch name, what changed, and how to merge (`git merge <name>`) or remove (`git worktree remove .trees/<name>`).
