# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: open the **Security** tab of this repository and choose **Report a vulnerability**. Do not open a public issue for anything that could be exploited.

Include what you found, how to reproduce it, and what an attacker could do with it. I will reply as soon as I can.

## Scope

- This repository's code, including the read-only demo mode (`DEMO_READONLY`).
- The public demo at https://dashboard-demo.joechamdani.com. Please test it gently: no load testing or automated scanning at volume. It is read-only and resets daily, so there is nothing to gain from trying to fill it with data.

## Running your own copy safely

- Never expose `DEMO_MODE=true` to the internet on its own. Online, a demo must also use `DEMO_READONLY=true`, which blocks every change in the middleware and again at the database layer.
- Set a strong `NEXTAUTH_SECRET` and `DB_PASSWORD`, keep `ALLOWED_EMAILS` to your own accounts, and serve it over HTTPS.
- Keep dependencies up to date (`pnpm update`, then `pnpm audit`).
