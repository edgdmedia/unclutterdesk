#!/bin/bash
#
# Nightly database backup, intended for cron.
#
#   ./scripts/backup-database.sh              # dump, verify, upload, prune
#   ./scripts/backup-database.sh --local-only # skip the upload
#   ./scripts/backup-database.sh --check      # report configuration and exit
#
# deploy.sh already backs up before a schema change, but only at deploy time and
# only to this server. A disk failure would take the database and every backup
# with it, so this writes a second copy somewhere else.
#
# Off-host upload targets any S3-compatible store (Cloudflare R2, Backblaze B2,
# AWS S3) via the aws CLI. Configure with:
#
#   BACKUP_S3_BUCKET     e.g. unclutterdesk-backups
#   BACKUP_S3_ENDPOINT   e.g. https://<account>.r2.cloudflarestorage.com
#   BACKUP_ENCRYPTION_PASSPHRASE
#                        Encrypts the dump before it leaves the machine. Keep it
#                        somewhere other than the backup bucket: together, a
#                        thief who takes the bucket has both, and losing the
#                        bucket loses both.
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#
# Without those it keeps local copies and says loudly that they are not off-host.

set -euo pipefail

TARGET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$TARGET_DIR"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/unclutterdesk}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-14}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-90}"

LOCAL_ONLY=false
CHECK_ONLY=false
for arg in "$@"; do
    case "$arg" in
        --local-only) LOCAL_ONLY=true ;;
        --check) CHECK_ONLY=true ;;
        *) echo "Unknown option: $arg" >&2; exit 2 ;;
    esac
done

log() { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

# ── Connection details ───────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ] && [ -f ".env" ]; then
    DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL=' .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
    export DATABASE_URL
fi
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set"

# Prisma accepts parameters libpq rejects; pg_dump fails outright on ?schema=.
PG_URL="${DATABASE_URL%%\?*}"

command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found — install postgresql-client"

UPLOAD_CONFIGURED=false
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
    UPLOAD_CONFIGURED=true

    # R2 uses the region "auto", and the aws CLI refuses to run without one.
    export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}"

    # aws-cli 2.23+ sends a CRC32 full-object checksum by default. R2 supports
    # CRC32 only as a composite checksum (CRC64NVME is its full-object one), so
    # the default makes uploads fail. Sending a checksum only when the API
    # requires one avoids the mismatch.
    export AWS_REQUEST_CHECKSUM_CALCULATION="${AWS_REQUEST_CHECKSUM_CALCULATION:-when_required}"
fi

if [ "$CHECK_ONLY" = true ]; then
    # Actually probe rather than claim: a URL being set says nothing about
    # whether pg_dump can read it, which is the thing that matters at 3am.
    if pg_dump --schema-only --no-owner --no-acl --file=/dev/null "$PG_URL" 2>/dev/null; then
        log "database:        reachable, pg_dump can read it"
    else
        log "database:        UNREACHABLE by pg_dump — backups would fail"
    fi
    log "local dir:       $BACKUP_DIR (keep ${LOCAL_RETENTION_DAYS}d)"
    if [ "$UPLOAD_CONFIGURED" = true ]; then
        log "off-host:        s3://$BACKUP_S3_BUCKET (keep ${REMOTE_RETENTION_DAYS}d)"
    elif [ -n "${BACKUP_S3_BUCKET:-}" ]; then
        log "off-host:        BUCKET SET BUT aws CLI MISSING — backups stay on this host"
    else
        log "off-host:        NOT CONFIGURED — backups stay on this host"
    fi
    exit 0
fi

# ── Dump ─────────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="$BACKUP_DIR/nightly-$STAMP.dump"

log "dumping database"
if ! pg_dump --format=custom --no-owner --no-acl --file="$FILE" "$PG_URL"; then
    rm -f "$FILE"
    fail "pg_dump failed"
fi

[ -s "$FILE" ] || { rm -f "$FILE"; fail "dump is empty"; }

# ── Verify ───────────────────────────────────────────────────────────────────
# A dump that cannot be listed cannot be restored. Checking now means a corrupt
# backup is caught tonight rather than during an incident.
log "verifying dump is readable"
TABLE_COUNT="$(pg_restore --list "$FILE" 2>/dev/null | grep -c 'TABLE DATA' || true)"
[ "${TABLE_COUNT:-0}" -gt 0 ] || { rm -f "$FILE"; fail "dump contains no table data — refusing to keep it"; }

SIZE="$(du -h "$FILE" | cut -f1)"
log "dump ok: $FILE ($SIZE, $TABLE_COUNT tables)"

# ── Encrypt ──────────────────────────────────────────────────────────────────
# A pg_dump is the whole database in one file: every client, every note, every
# amount. Off-host means it lands in a bucket, and a bucket is one
# misconfiguration away from being readable. Encrypt before it leaves, not
# after.
#
# Verified by decrypting before the plaintext is removed — an encrypted backup
# nobody has ever opened is not a backup.
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
    command -v openssl >/dev/null 2>&1 || fail "openssl not found — needed to encrypt the backup"
    log "encrypting dump"
    if ! printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 \
            -salt -in "$FILE" -out "$FILE.enc" -pass stdin; then
        rm -f "$FILE.enc"
        fail "encryption failed — refusing to ship an unencrypted dump"
    fi

    # Decrypted to a file rather than piped: a custom-format archive is read by
    # seeking, so pg_restore cannot take one on stdin and reports every backup
    # as unreadable if you try. Removed immediately either way — it is the
    # whole database in the clear while it exists.
    VERIFY_FILE="$FILE.verify"
    if ! printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
            -in "$FILE.enc" -out "$VERIFY_FILE" -pass stdin 2>/dev/null \
            || ! pg_restore --list "$VERIFY_FILE" >/dev/null 2>&1; then
        rm -f "$FILE.enc" "$VERIFY_FILE"
        fail "encrypted dump did not decrypt back to a readable dump — refusing to keep it"
    fi
    rm -f "$VERIFY_FILE"

    rm -f "$FILE"
    FILE="$FILE.enc"
    log "encrypted ok: $FILE"
else
    log "WARNING: BACKUP_ENCRYPTION_PASSPHRASE is not set, so this dump is stored"
    log "WARNING: in the clear. It contains every clinical note in the database."
fi

# ── Off-host copy ────────────────────────────────────────────────────────────
if [ "$LOCAL_ONLY" = true ]; then
    log "skipping upload (--local-only)"
elif [ "$UPLOAD_CONFIGURED" = true ]; then
    ENDPOINT_ARG=""
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && ENDPOINT_ARG="--endpoint-url $BACKUP_S3_ENDPOINT"

    log "uploading to s3://$BACKUP_S3_BUCKET/"
    # shellcheck disable=SC2086
    if aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/$(basename "$FILE")" $ENDPOINT_ARG >/dev/null; then
        log "upload ok"
    else
        # Keep the local copy: a failed upload is not a reason to have nothing.
        fail "upload failed — local copy retained at $FILE"
    fi
else
    log "WARNING: no off-host target configured. This backup lives on the same"
    log "WARNING: machine as the database it protects, so a disk failure loses both."
fi

# ── Prune ────────────────────────────────────────────────────────────────────
# Matches both .dump and .dump.enc: encrypted backups still need pruning, and
# any unencrypted ones left from before encryption was added need it too. With
# the narrower glob they would have accumulated until the disk filled, while the
# count below cheerfully reported none.
find "$BACKUP_DIR" -name 'nightly-*.dump*' -type f -mtime "+$LOCAL_RETENTION_DAYS" -delete 2>/dev/null || true
log "local backups: $(find "$BACKUP_DIR" -name 'nightly-*.dump*' -type f | wc -l | tr -d ' ') kept"

if [ "$UPLOAD_CONFIGURED" = true ] && [ "$LOCAL_ONLY" = false ]; then
    CUTOFF="$(date -u -d "-${REMOTE_RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -u -v-"${REMOTE_RETENTION_DAYS}"d +%Y%m%d)"
    ENDPOINT_ARG=""
    [ -n "${BACKUP_S3_ENDPOINT:-}" ] && ENDPOINT_ARG="--endpoint-url $BACKUP_S3_ENDPOINT"
    # shellcheck disable=SC2086
    aws s3 ls "s3://$BACKUP_S3_BUCKET/" $ENDPOINT_ARG 2>/dev/null | awk '{print $4}' | grep '^nightly-' | while read -r name; do
        stamp="${name#nightly-}"; stamp="${stamp%%-*}"
        if [ -n "$stamp" ] && [ "$stamp" -lt "$CUTOFF" ] 2>/dev/null; then
            # shellcheck disable=SC2086
            aws s3 rm "s3://$BACKUP_S3_BUCKET/$name" $ENDPOINT_ARG >/dev/null && log "pruned remote $name"
        fi
    done
fi

log "done"
