#!/bin/sh
# Certbot deploy hook: without this, nginx keeps serving the OLD certificate
# after a renewal until something reloads it — which is how api.unclutterdesk.com
# can go dark 60 days after a working deploy.
#
# Install on the server:
#   sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
#   sudo install -m 755 reload-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl reload nginx
