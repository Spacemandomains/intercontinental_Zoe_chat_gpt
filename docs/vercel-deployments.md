# Vercel deployments

This project deploys to Vercel. A few things worth knowing before you
push.

## Daily deploy cap (Hobby plan)

Vercel's Hobby plan caps automatic deployments at **100 per 24 h, per
account** — across *all* projects on the account, not just this one.
When the cap is hit every subsequent push fails its required
`Vercel – Deployment` check with:

> Deployment rate limited — retry in 24 hours.

There is no way to "unblock" a rate-limited deployment from inside the
repo. Options:

- **Wait.** The window is rolling; as older deploys age out the quota
  frees up. Push a trivial no-op commit (or re-run the check) after the
  window clears to regenerate the preview.
- **Upgrade.** The Pro plan raises the cap substantially. This is an
  account setting, not a code change.

## Avoiding the cap

- **Squash locally.** Prefer one `git commit --amend` + force-push over
  five "fix typo" commits. Each commit that lands on a tracked branch
  spawns a preview build.
- **Use draft PRs.** Previews are still built, but it signals work in
  progress and discourages per-commit review churn.
- **Skip individual commits.** Adding `[skip ci]` or `[vercel skip]`
  anywhere in the commit message tells Vercel not to build that
  commit. Useful for doc-only or config-only commits.

## Which branches deploy

`vercel.json` pins `git.deploymentEnabled` so only `main` produces
automatic deployments. Working branches (e.g. `claude/*`) will no
longer spawn a preview on every push — merge to `main` to trigger a
production deploy, or enable the branch explicitly in `vercel.json` if
you need previews for a specific feature branch.
