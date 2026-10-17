# AGENTS.md: The Exchange

Instructions for AI coding agents (Codex and others). The Exchange lives at https://exchange.lasterlab.app and in the GitHub repo `andrerlaster-lgtm/The-exchange-game`.

## What this is

React, TypeScript, Vite, Zustand, GSAP and Three.js.

## Commands

```
npm run dev
npm test        # vitest
npm run sim     # simulation tests
npm run build
```

## This app's specifics

- Don't commit the loose mock-up images, PDFs or the `Coding For Exchange game/` folder; they are working files.
- Saved-game compatibility matters: keep the settings store and save format migrations tested.

## Rules for any AI agent working here (Codex, Claude, or others)

1. **Deploys happen by pushing to GitHub.** A push to `main` on `andrerlaster-lgtm/The-exchange-game` deploys to https://exchange.lasterlab.app automatically. Do NOT run `vercel deploy` or `vercel promote` by hand: the studio's Deploy Check can't verify hand deploys.
2. **Use a branch and a pull request.** Work on a new branch and open a pull request. Don't push to `main` unless the owner (Andre) asked you to. He merges.
3. **Keep the site private.** Login protection on every deployment must stay on. Never add public links, public aliases or shared preview links. Don't change Vercel project settings, domains or environment variables.
4. **No secrets in the repo.** Never commit `.env*`, tokens, API keys or passwords, and never print them. Andre adds keys in Vercel himself.
5. **No new AI features or paid APIs** without Andre's approval of the key and a spending cap.
6. **Test before asking for a merge.** Run the commands below and report what passed and what failed, honestly.
7. **Stay inside this app.** Don't edit other apps' folders or repos. If two apps need to share something, ask first.
8. **Keep notes current.** Update the README or project notes when behavior changes, and say what you didn't verify.
9. **After a merge,** check https://studio.lasterlab.app/deploys. This app should show Live. If it shows Failed or No deploy reported, find out why before doing anything else.
10. **Write commit notes.** End each commit message with the notes described in "Commit messages" below, so Studio's Change History can explain the change.

## Commit messages: notes for Studio's Change History

Studio (Bug Log → Change history) reads this repo's commits so Andre, who is learning to code, can see what changed, why, and where to look if it breaks. Git supplies the facts (files, lines, diff). You supply what only you know, as notes at the end of the commit message, one per line, before any `Co-Authored-By` line:

```
Short title of the change

What changed and why, in a sentence or two.

Feature: Landing space rules
Change-Type: rule-change
Fixes-Bug: 14
Tested: npm test (557 passed), npm run build
Plain English: Landing on a fund space used to charge you a fee. Now it only offers a share.
If-This-Breaks: Look at the 'etf' case in resolveLanding (src/engine/actionResolver.ts). You'd see a fee on a fund space, or a locked Buy button.
```

- **Feature:** the part of the app this belongs to, in plain words. Reuse a name already used in Change history when it fits.
- **Change-Type:** one of `fix`, `feature`, `rule-change`, `ui`, `refactor`, `performance`, `docs`, `tests`, `chore`. Use `fix` only for a real bug fix.
- **Fixes-Bug:** the Bug Log number(s), only when this commit fixes that bug. Leave it out otherwise.
- **Tested:** the commands you actually ran and their results. If you didn't test, write `not tested`.
- **Plain English:** what the change does for someone using the app, without jargon. Required for any change to behaviour.
- **If-This-Breaks:** the file and function to look at, and what someone would notice if this change goes wrong.

Only write what you know from the work you did. Don't guess a reason, and don't call something a bug fix unless it fixes a bug. A small commit (a typo, a version bump) can skip the notes.
