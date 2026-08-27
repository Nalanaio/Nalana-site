# Working rules for this repo

## Branch flow

- Branch off `main`, PR back into `main`. Never commit or push directly to `main`.
- Before starting new work: `git checkout main && git pull && git checkout -b <type>/<short-name>`
- One branch = one concern. Don't bundle unrelated changes into a single branch/PR.
- Within a branch, commit in small logical chunks as you go — don't wait until everything is done to make one giant commit.

## Branch & commit naming

Prefix with the type of change, kebab-case, ~6-7 words max after the prefix:

| Prefix | Use for |
|---|---|
| `feat` | a new capability or UI surface |
| `fix` | correcting broken or wrong behavior |
| `chore` | upkeep with no user-facing behavior change |
| `refactor` | restructuring code without changing behavior |
| `style` | formatting / visual-only tweaks, no logic change |

Commit messages are subject line only — no body, no bullet points, no trailers:
```
<type>: <subject, ~6-7 words>
```
Example: `style: adjust hero section spacing`

## Check what's already in flight

Before starting something that might overlap with someone else's work, glance at what's
already open so you're not duplicating or conflicting with it:
```
gh pr list --repo Nalanaio/Nalana-site
```
Or just check the repo's Pull requests tab on GitHub — same information, no terminal needed.

If your change touches a file or section someone else might also be editing, say something
before merging.

## Before opening a PR

- [ ] `npm run dev` used to visually verify the change looks right
- [ ] Branch was cut from up-to-date `main`, and PR base is `main`
- [ ] Pulled `main` again right before opening the PR, so conflicts with others' merged
      work show up on your machine — not mid-merge on GitHub
- [ ] Commit subjects follow the format above
- [ ] No secrets, `.env` values, or unrelated file diffs included
- [ ] PR is scoped to one concern

## No safety net — read this first

**`main` is not branch-protected, and more than one person pushes to this repo.** Nothing
technical stops a direct push, a force-push over someone else's history, or committing
straight to `main` — the rules only hold if everyone follows them on purpose. This isn't
just a solo-project convenience anymore: a careless push can genuinely overwrite or
conflict with a teammate's work.

- Never `git push --force` (even `--force-with-lease`) to `main` or a branch someone
  else might also be pushing to
- Never `git reset --hard`, `git checkout --`, or `git clean` on a branch that isn't
  only yours
- If a merge conflict shows up, stop and read what it actually is before resolving it —
  don't blindly keep "yours" or "theirs"

Always confirm the current branch before committing:
```
git branch --show-current   # should be your feature branch, not main
git status                  # should only show files you meant to touch
```

## Actions that need explicit confirmation

Don't commit, push, or open a PR automatically after making edits — wait to be asked.
When asked to "open a PR," target `main` and use the commit format above by default.

## Local preview

- Stack: Vite + Svelte
- Run `npm install` then `npm run dev` to preview locally
- Verify changes visually in the preview before considering something done

## Design system reference

See `README.md` in this repo for the full brand and design system reference — colors,
typography, spacing, iconography, component patterns. This file covers *how to work*
in the repo; the README covers *what things should look like*.
