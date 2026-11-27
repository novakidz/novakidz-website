interface Env {
  GITHUB_OAUTH_ID: string;
  GITHUB_OAUTH_SECRET: string;
  GITHUB_REPO_PRIVATE?: string;
}
function randomState(): string {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
}
function popup(status: string, token = ""): Response {
  const payload = JSON.stringify({ token });
  const html = '<!doctype html><html><body><p>Completing NovaKidz sign-in…</p><script>window.opener.postMessage("authorization:github:' + status + ':" + JSON.stringify(' + payload + '), window.location.origin);window.close();</script></body></html>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("NovaKidz CMS authentication service is running.");
    if (url.pathname === "/auth") {
      if (url.searchParams.get("provider") !== "github") return new Response("Invalid provider", { status: 400 });
      const state = randomState();
      const scope = env.GITHUB_REPO_PRIVATE === "1" ? "repo,user" : "public_repo,user";
      const callback = url.origin + "/callback?provider=github";
      const target = new URL("https://github.com/login/oauth/authorize");
      target.searchParams.set("client_id", env.GITHUB_OAUTH_ID);
      target.searchParams.set("redirect_uri", callback);
      target.searchParams.set("scope", scope);
      target.searchParams.set("state", state);
      const headers = new Headers({ Location: target.toString() });
      headers.append("Set-Cookie", "novakidz_oauth_state=" + state + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600");
      return new Response(null, { status: 302, headers });
    }
    if (url.pathname === "/callback") {
      if (url.searchParams.get("provider") !== "github") return new Response("Invalid provider", { status: 400 });
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookie = request.headers.get("Cookie") || "";
      const expected = cookie.match(/(?:^|; )novakidz_oauth_state=([^;]+)/)?.[1];
      if (!code || !state || !expected || state !== expected) return new Response("OAuth state check failed. Close this window and retry.", { status: 400 });
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
      const response = popup("success", data.access_token);
      const headers = new Headers(response.headers);
      headers.append("Set-Cookie", "novakidz_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
      return new Response(response.body, { status: 200, headers });
    }
    return new Response("Not found", { status: 404 });
  }
};
