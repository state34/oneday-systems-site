# One Day Systems website

Public marketing site for One Day Systems LLC.

Static HTML and CSS at the repository root. No framework and no build step. Booking uses Google Calendar:

https://calendar.app.google/HEjFgm7BNRwYn7HL8

**Tagline:** One Day Systems takes on the tech you keep putting off until “one day.”

Official marks (Leanna Uniak) live in `assets/brand/`: color on light backgrounds, white on dark, black for monochrome. Do not redraw the logo.

## Preview locally

From the repo root:

```bash
npx --yes serve . -p 8080
```

## Cloudflare Pages

Suggested project name: `oneday-systems-site`

Preview expectation: `https://oneday-systems-site.<account>.pages.dev` (or the project’s `*.pages.dev` URL after the first deploy). A branch preview for `slice/site-rebuild` will also appear in the Pages dashboard.

Production branch later = `main`, after Stan signs off on the rebuild.

No `wrangler.toml`. Connect the Git repo; do not add a build.

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub and select `state34/oneday-systems-site`.
3. Framework preset: **None**. Build command: empty. Output directory: `/` (repository root).
4. For this review, deploy the branch `slice/site-rebuild`. Do not set the production branch to `main` yet.
5. Do **not** attach `onedaysystems.com` or `www.onedaysystems.com` in this slice. Custom domain stays deferred until Stan signs off. DNS at the registrar is unchanged.

### Why this branch has no `CNAME`

`main` still contains a `CNAME` file for `onedaysystems.com`. Cloudflare Pages will attach that hostname if it deploys `main`. This branch deletes `CNAME` so a preview of `slice/site-rebuild` does not claim the domain. Leave the custom domain off, and do not promote `main`, until Stan signs off.

## Contact

- stan@onedaysystems.com
- expert@onedaysystems.com
- Office and remit: De Soto, Kansas
