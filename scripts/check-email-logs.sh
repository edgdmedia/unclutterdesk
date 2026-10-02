#!/usr/bin/env bash
# Read-only check of why emails fail on the production API.
# Shows recent email errors, which mail settings exist (passwords and keys are
# never printed), and whether the server can reach common mail ports.
#
# Run from your machine:  ssh <user>@<server> 'bash -s' < scripts/check-email-logs.sh
set -u
APP=/home/unclutterdesk/app
PROC=unclutterdesk-api

echo "== API process =="
pm2 describe "$PROC" 2>/dev/null | grep -E "status|uptime|restarts|out log path|error log path" || echo "pm2 process $PROC not found"

echo
echo "== Recent email errors and warnings (last 3000 log lines) =="
pm2 logs "$PROC" --lines 3000 --nostream 2>/dev/null \
  | grep -iE "mail|smtp|resend|sendEmail|email" \
  | grep -iE "error|fail|warn|refused|timeout|auth|invalid|ECONN|ETIMEDOUT|EAUTH|ESOCKET|535|550|553|554" \
  | tail -40

echo
echo "== Last 40 lines of the error log =="
pm2 logs "$PROC" --lines 40 --nostream --err 2>/dev/null

echo
echo "== Mail settings present (secrets hidden) =="
for f in "$APP/.env" "$APP/apps/api/.env"; do
  [ -f "$f" ] || continue
  echo "$f"
  grep -E '^(MAIL|SMTP|RESEND|EMAIL)_[A-Z_]*=' "$f" | while IFS='=' read -r key value; do
    case "$key" in
      *PASS*|*KEY*|*SECRET*|*USER*) echo "  $key = (set, hidden)" ;;
      *) echo "  $key = ${value}" ;;
    esac
  done
done

echo
echo "== Can the server reach mail servers? =="
for hp in smtp.gmail.com:587 smtp.gmail.com:465 smtp.resend.com:587 smtp.resend.com:465; do
  h=${hp%:*}; p=${hp#*:}
  if timeout 5 bash -c "</dev/tcp/$h/$p" 2>/dev/null; then echo "  $hp reachable"; else echo "  $hp BLOCKED"; fi
done
