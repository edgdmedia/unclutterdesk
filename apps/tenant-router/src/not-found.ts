/**
 * The 404 body served when a practice address does not exist.
 *
 * Self-contained on purpose: it must render even when the origin or the API is
 * the thing that is unavailable, so it inlines its own styles and loads nothing.
 */
export function practiceNotFoundResponse(host: string): Response {
  const safeHost = host.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Practice not found &middot; Unclutter Desk</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px; background: #EFF3F7; color: #0F172A;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: 100%; max-width: 520px; background: #fff; border: 1px solid #E2E8F0;
    border-radius: 24px; padding: 40px; text-align: center;
    box-shadow: 0 24px 80px rgba(15,23,42,.14);
  }
  .eyebrow {
    margin: 0 0 12px; font-size: 11px; font-weight: 800; letter-spacing: .14em;
    text-transform: uppercase; color: #64748B;
  }
  h1 { margin: 0 0 12px; font-size: 22px; line-height: 1.3; }
  p { margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #475569; }
  .host {
    display: inline-block; margin: 4px 0 18px; padding: 6px 12px; border-radius: 8px;
    background: #F1F5F9; border: 1px solid #E2E8F0; font-size: 13px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #0F172A;
    word-break: break-all;
  }
  a.btn {
    display: inline-block; margin-top: 8px; padding: 13px 24px; border-radius: 14px;
    background: #0F3A53; color: #fff; font-size: 15px; font-weight: 700;
    text-decoration: none;
  }
</style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">Error 404</p>
    <h1>We couldn't find that practice</h1>
    <div class="host">${safeHost}</div>
    <p>No practice is using this address. The link may be out of date, or the address may have a typo in it.</p>
    <a class="btn" href="https://unclutterdesk.com">Go to Unclutter Desk</a>
  </main>
</body>
</html>`;

  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
      // Short: a practice may be created at this address at any time.
      'cache-control': 'public, max-age=30',
    },
  });
}
