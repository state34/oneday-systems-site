# One Day Systems website

Public marketing site for One Day Systems LLC.

Static HTML and CSS in `public/`. No build step. The contact form is a Pages Function in `functions/` at the repository root, where Pages expects it. Booking is the Calendly widget on `/contact/#schedule`.

**Tagline:** One Day Systems takes on the tech you keep putting off until “one day.”

Official marks (Leanna Uniak) live in `public/assets/brand/`: color on light backgrounds, white on dark, black for monochrome. Do not redraw the logo.

`fonts/FONTS.md` stays in the repo (it records the upstream font URL) and is not uploaded. `public/fonts/` publishes the woff2 and `OFL.txt`.

## Preview locally

From the repo root:

```bash
npx --yes serve public -p 8080
```

## Cloudflare Pages

Suggested project name: `oneday-systems-site`

Preview expectation: `https://oneday-systems-site.<account>.pages.dev` (or the project’s `*.pages.dev` URL after the first deploy). A branch preview for `slice/site-rebuild` will also appear in the Pages dashboard.

Production branch later = `main`, after Stan signs off on the rebuild.

No `wrangler.toml`. Connect the Git repo; do not add a build.

Direct upload publishes `public/` only. From the repository root:

```bash
wrangler pages deploy public
```

Wrangler uploads that directory as the static site and attaches `functions/` from the repository root. Do not upload the repository root.

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize GitHub and select `state34/oneday-systems-site`.
3. Framework preset: **None**. Build command: empty. Root directory: `/` (repository root, so `functions/` is compiled). Build output directory: `public`.
4. For this review, deploy the branch `slice/site-rebuild`. Do not set the production branch to `main` yet.
5. Do **not** attach `onedaysystems.com` or `www.onedaysystems.com` in this slice. Custom domain stays deferred until Stan signs off. DNS at the registrar is unchanged.

### Existing project

If the Pages project already deploys this repo with output directory `/`, change **Build output directory** to `public` on the deployment of this revision. Leave the build command empty. Leave the root directory as the repository root. Setting the root directory to `public` would hide `functions/`, and `/api/contact` would stop running. This revision is not a valid site while the output directory is still `/` (the pages moved). The previous revision has no `public/` directory, so do not flip the output directory before this revision is what Pages builds.

### Why this branch has no `CNAME`

`main` still contains a `CNAME` file for `onedaysystems.com`. Cloudflare Pages will attach that hostname if it deploys `main`. This branch deletes `CNAME` so a preview of `slice/site-rebuild` does not claim the domain. Leave the custom domain off, and do not promote `main`, until Stan signs off.

## Contact

The public site does not publish email addresses. Notes go through `/contact/`. The privacy page keeps both addresses as plain text, with no mailto link.

Office and remit: De Soto, Kansas.

Public phone: none on the site. Do not invent a number.

### Env and bindings Eng sets in Pages (Preview and Production)

Do not commit values.

- `RESEND_API_KEY` (secret)
- `CONTACT_TO`
- `CONTACT_FROM` (example: `One Day Systems <noreply@onedaysystems.com>`)
- `TURNSTILE_SITE_KEY` (public; the contact page reads it from `/api/form-config`)
- `TURNSTILE_SECRET_KEY` (secret)
- KV namespace binding `CONTACT_RL`
- `sitemap.xml` and `llms.txt` are in `public/` and are served at the site root. `robots.txt` points at the sitemap and does not disallow GPTBot, PerplexityBot, Google-Extended, or OAI-SearchBot.
