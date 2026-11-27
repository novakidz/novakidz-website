# NovaKidz website

Responsive static NovaKidz homepage with editable copy stored in `content/home.json`.

## Deploy on Cloudflare Pages

1. Open **Workers & Pages → Create → Pages → Connect to Git**.
2. Connect GitHub and select `novakidz/novakidz-website`.
3. Production branch: `main`.
4. Framework preset: **None**. Build command: leave blank. Build output directory: `/`.
5. Deploy. Cloudflare will assign a `*.pages.dev` address with HTTPS. Commits to `main` trigger redeployments.

## Admin editor

The CMS configuration is in `admin/config.yml`, and the editor URL will be `/admin/`. GitHub's CMS backend requires an OAuth server. The `base_url` in the config is intentionally a placeholder until a Cloudflare OAuth Worker is deployed and its URL is added. Do not put GitHub client secrets in this repository.

Official setup reference: https://decapcms.org/docs/backends-overview/
