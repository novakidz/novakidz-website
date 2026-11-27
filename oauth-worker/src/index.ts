interface Env {
  GITHUB_OAUTH_ID: string;
  GITHUB_OAUTH_SECRET: string;
  GITHUB_REPO_PRIVATE?: string;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function signState(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, "0")).join("");
}

async function createState(secret: string): Promise<string> {
  const message = Date.now().toString() + "." + randomNonce();
  return message + "." + await signState(message, secret);
}

async function validState(state: string, secret: string): Promise<boolean> {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [timestamp, nonce, signature] = parts;
  if (!/^\\d+$/.test(timestamp) || !/^[a-f0-9]{32}$/.test(nonce)) return false;
  const age = Date.now() - Number(timestamp);
  if (age < 0 || age > 10 * 60 * 1000) return false;
  const expected = await signState(timestamp + "." + nonce, secret);
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function popup(status: string, token = ""): Response {
  const payload = JSON.stringify({ token });
  const html = '<!doctype html><html><body><p>Completing NovaKidz sign-in…</p><script>window.opener.postMessage("authorization:github:' + status + ':" + JSON.stringify(' + payload + '), "*");window.close();</script></body></html>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("NovaKidz CMS authentication service is running.");

    if (url.pathname === "/auth") {
      if (url.searchParams.get("provider") !== "github") return new Response("Invalid provider", { status: 400 });
      if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) return new Response("GitHub OAuth credentials are not configured.", { status: 500 });
      const state = await createState(env.GITHUB_OAUTH_SECRET);
      const scope = env.GITHUB_REPO_PRIVATE === "1" ? "repo,user" : "public_repo,user";
      const callback = url.origin + "/callback?provider=github";
      const target = new URL("https://github.com/login/oauth/authorize");
      target.searchParams.set("client_id", env.GITHUB_OAUTH_ID);
      target.searchParams.set("redirect_uri", callback);
      target.searchParams.set("scope", scope);
      target.searchParams.set("state", state);
      return Response.redirect(target.toString(), 302);
    }

    if (url.pathname === "/callback") {
      if (url.searchParams.get("provider") !== "github") return new Response("Invalid provider", { status: 400 });
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state || !(await validState(state, env.GITHUB_OAUTH_SECRET || ""))) {
        return new Response("OAuth state check failed. Close this window and retry.", { status: 400 });
      }
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.GITHUB_OAUTH_ID,
          client_secret: env.GITHUB_OAUTH_SECRET,
          code,
          redirect_uri: url.origin + "/callback?provider=github"
        })
      });
      const data = await tokenResponse.json() as { access_token?: string };
      if (!tokenResponse.ok || !data.access_token) return new Response("GitHub authorization failed. Check OAuth app settings and Worker secrets.", { status: 502 });
      return popup("success", data.access_token);
    }

    return new Response("Not found", { status: 404 });
  }
};
