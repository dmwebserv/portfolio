# dmwebservices portfolio

This is Danny's portfolio site for **dmwebservices**, showcasing affordable
website builds for local trades, sole traders and small businesses. It
features two client case studies: **LWP Painting** and **KCM Cleaning**.

## Stack

Static HTML and CSS. No build step, no framework, no dependencies. Each page
is self-contained with its own inline `<style>` block.

## Pages

- `index.html` - the main portfolio/landing page
- `order-received.html` - confirmation page shown after a payment
- `privacy-policy.html` - privacy policy
- `thanks.html` - confirmation page shown after the contact form is submitted

## Deployment

The site is deployed via **GitHub Pages**. The custom domain
(`dmwebservices.co.uk`) is set via the `CNAME` file in the repo root, with DNS
managed through **Cloudflare**.

Pushing to the default branch and letting GitHub Pages rebuild is the normal
deploy path. There is no separate build or bundling step, so what's committed
is what gets served.

## Previewing changes locally

Since this is plain static HTML/CSS, you can preview it with any local static
file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.

## Making changes

- Keep changes minimal and page-scoped where possible, since styles are
  currently duplicated per page rather than shared in a single stylesheet.
- Update `sitemap.xml` if you add, remove, or rename a page.
- Favicon and touch icon assets live in `images/` (`favicon.png`,
  `images/apple-touch-icon.png`) and are referenced from the `<head>` of
  every page.
