# NovaKidz CMS OAuth Worker

Deploy this Worker as novakidz-cms-auth.

Add Worker secrets in Cloudflare: GITHUB_OAUTH_ID and GITHUB_OAUTH_SECRET.

Create a GitHub OAuth App with Homepage URL set to the Worker URL and callback URL set to WORKER_URL/callback.

After deployment, set admin/config.yml backend base_url to the Worker URL. Keep auth_endpoint: auth.
