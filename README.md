# Delta Multiholding Solution: company website

Static marketing site for **Delta Multiholding Solution Limited**, a civil and building works contractor and general supplier in Mwanza, Tanzania. The content comes from the 2025 company profile.

## Pages

| Path        | Content                                                                 |
|-------------|-------------------------------------------------------------------------|
| `/`         | Hero, services overview, why choose us, project carousel, clients      |
| `/about`    | About, background, vision/mission/values, strategy, policies, team, credentials |
| `/services` | Civil engineering, building construction, M&E, general supply, approach |
| `/projects` | Photo gallery with lightbox                                             |
| `/contact`  | Contact details, enquiry form (opens the visitor's email app), map      |

## Structure

```
public/            static site (HTML, CSS, JS, images)
  assets/css/      styles.css: design tokens, layout, animations
  assets/js/       main.js: scroll effects, menu, carousel, lightbox, form
  assets/img/      company project photos (WebP), icon sprite, favicon, social image
  assets/img/stock/  licensed stock photos (see CREDITS.md)
server.js          zero-dependency Node static server
railway.json       Railway build/deploy settings
```

There is no build step and no database. `server.js` serves `public/` with clean URLs (`/about` → `about.html`), Brotli/gzip compression, caching headers, a custom 404 page and a `/healthz` health check.

## Run locally

```bash
npm start            # http://localhost:3000
```

Node 18 or newer is required. There are no dependencies to install.

## Deploy (Railway)

The Railway service is connected to this GitHub repository and redeploys on every push to `main`. Railway detects Node, runs `node server.js` and checks `/healthz`. The `PORT` variable is provided by Railway.

## Editing content

Each page is a plain HTML file in `public/`. The header and footer are repeated in every page, so a change to the navigation or footer must be made in all six HTML files. When you change `styles.css` or `main.js`, bump the `?v=` query string in the `<link>`/`<script>` tags so returning visitors get the new file.
