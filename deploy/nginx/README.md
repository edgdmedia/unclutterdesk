# Nginx config for api.unclutterdesk.com

Lives on the server at `/etc/nginx/conf.d/api-unclutterdesk.com.conf`. This copy
is the record; edit the server first, then sync it back here.

## The bound-listen rule (learned the hard way, 2026-09-30)

This server is a Virtualmin box: every other site's vhost listens on the
**bound** address `169.58.3.186:443` (+ its IPv6), and `server.stanforteedge.com`
is the `default_server` on that socket.

An nginx vhost that listens on the plain wildcard `443` is **not reachable via
SNI on the bound socket**: Cloudflare connects to the public IP, matches the
bound socket, finds no `server_name` match, falls to the default — and presents
the wrong certificate. Cloudflare (Full strict) then returns **526**, which
browsers surface as a misleading "CORS blocked" error.

So the 443 block here must keep:

```nginx
listen 169.58.3.186:443 ssl;
listen [2a02:c207:2343:4945::1]:443 ssl;
```

Check after any change (from the server):

```bash
echo | openssl s_client -connect 169.58.3.186:443 -servername api.unclutterdesk.com 2>/dev/null | openssl x509 -noout -subject
# must print: CN = api.unclutterdesk.com
```

If a reload appears not to take effect, `systemctl restart nginx` (a stale
master was the second half of the 2026-09-30 incident), and check
`journalctl -u nginx` for failed reloads.
