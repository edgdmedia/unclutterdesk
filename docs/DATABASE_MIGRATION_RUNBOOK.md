# Database Migration Runbook

Until now `deploy.sh` ran `npx prisma db push` on every API deploy. `db push` is a
schema *sync* command: when the live database disagrees with `schema.prisma`, it
resolves the difference by altering or dropping whatever is in the way, without a
migration history and without a prompt in non-interactive mode. On a database
holding real clinical notes that is one careless field rename away from data loss.

`deploy.sh` now takes a `pg_dump` backup and runs `prisma migrate deploy` instead.

> **Do the one-time baseline below BEFORE the next API deploy.**
> `migrate deploy` will try to apply `0_init` to a database that already has all
> 19 tables and fail with `relation "Tenant" already exists`. The deploy aborts
> safely — nothing is damaged — but the API will not ship until this is done.

---

## One-time baseline (run once, against production)

Run from `/home/unclutterdesk/app` on the production host, on the **current**
`main` checkout, before deploying the branch that changes `deploy.sh`.

### 1. Confirm the live schema matches `schema.prisma`

```bash
cd /home/unclutterdesk/app
# Same extraction deploy.sh uses; handles '=' and '@' inside the password.
export DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL=' .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"

npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected output: `-- This is an empty migration.`**

That means the live database and the checked-in schema agree, so `0_init`
faithfully describes what is already deployed.

If it prints actual SQL, production has drifted. **Stop.** Read the SQL: it is
the change that would be applied. Anything containing `DROP TABLE`, `DROP COLUMN`
or a type narrowing means the drift carries data. Reconcile the schema first —
do not continue with a drifted database, because step 3 would record a baseline
that lies about the live state.

### 2. Take a manual backup

The deploy script backs up automatically from now on, but this step happens
before that code is live.

```bash
mkdir -p "$HOME/backups/unclutterdesk"
pg_dump --format=custom --no-owner --no-acl \
  --file="$HOME/backups/unclutterdesk/pre-baseline-$(date +%Y%m%d-%H%M%S).dump" \
  "$DATABASE_URL"

ls -lh "$HOME/backups/unclutterdesk/"
```

Confirm the file is non-empty before continuing.

### 3. Mark the baseline as already applied

This writes a row to `_prisma_migrations` saying `0_init` is done. It runs **no
DDL** — it does not touch your tables.

```bash
git pull origin main          # must include prisma/migrations/0_init/
npx prisma migrate resolve --applied 0_init
```

### 4. Verify

```bash
npx prisma migrate status
```

**Expected: `Database schema is up to date!`**

Production is now on Prisma Migrate. Deploys will apply only new migration files.

---

## Writing migrations from here on

Never run `db push` against production again. On a local or staging database:

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate the migration and apply it locally
npx prisma migrate dev --name add_session_notes_index

# 3. READ prisma/migrations/<timestamp>_add_session_notes_index/migration.sql
# 4. Commit it alongside the schema change
```

Step 3 is the point of the whole exercise. Review the SQL before committing —
that is where you catch a rename that Prisma has interpreted as a drop plus an
add, which silently discards the column's data.

For a rename, replace the generated `DROP COLUMN` / `ADD COLUMN` pair with an
explicit `ALTER TABLE ... RENAME COLUMN ...`. For a column becoming `NOT NULL`,
add a backfill `UPDATE` ahead of the constraint in the same file.

`deploy.sh` applies whatever is committed, so an unreviewed migration file is
indistinguishable from a reviewed one.

---

## Restoring from a backup

Backups land in `~/backups/unclutterdesk/pre-deploy-*.dump` (custom format,
14-day retention — override with `BACKUP_RETENTION_DAYS`).

```bash
# Inspect what a dump contains before restoring anything
pg_restore --list ~/backups/unclutterdesk/pre-deploy-20260903-141500.dump | head -40

# Single table, into a scratch database first — never straight over production
createdb unclutterdesk_restore
pg_restore --dbname=unclutterdesk_restore --table=ClinicalNote \
  ~/backups/unclutterdesk/pre-deploy-20260903-141500.dump

# Full restore (destructive — the API must be stopped first)
pm2 stop unclutterdesk-api
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="$DATABASE_URL" \
  ~/backups/unclutterdesk/pre-deploy-20260903-141500.dump
pm2 start unclutterdesk-api
```

**A backup you have never restored is not a backup.** Restore one into a scratch
database once and confirm the row counts look right — before you need it in
anger.

## Nightly off-host backups

`deploy.sh` backs up before a schema change, but only at deploy time and only to
this server — so a disk failure takes the database and every backup with it.
`scripts/backup-database.sh` writes a second copy somewhere else.

```bash
cd /home/unclutterdesk/app

# Report configuration without writing anything. Probes the database rather
# than assuming: a URL being set says nothing about whether pg_dump can read it.
./scripts/backup-database.sh --check

# Run one now
./scripts/backup-database.sh
```

It dumps, refuses to keep a dump it cannot read back with `pg_restore --list`,
uploads off-host if configured, and prunes: 14 days locally, 90 days remote.

### Sending backups off the box

Any S3-compatible store works. Cloudflare R2 is the obvious one here, since the
account already exists:

1. Cloudflare dashboard → **R2** → create a bucket, e.g. `unclutterdesk-backups`.
2. **Manage R2 API Tokens** → create a token with **Object Read & Write** on
   that bucket only.
3. Install the CLI: `sudo apt-get install -y awscli`
4. Add to `/home/unclutterdesk/app/.env`:

       BACKUP_S3_BUCKET=unclutterdesk-backups
       BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
       AWS_ACCESS_KEY_ID=<r2 access key>
       AWS_SECRET_ACCESS_KEY=<r2 secret key>

5. Confirm: `./scripts/backup-database.sh --check` should report the bucket
   rather than "NOT CONFIGURED".

Until that is done the script still runs and still verifies, but it says plainly
that the backups are on the same machine as the database.

### Schedule it

```bash
crontab -e
```

```cron
# Nightly at 02:15 UTC
15 2 * * * cd /home/unclutterdesk/app && ./scripts/backup-database.sh >> /home/unclutterdesk/app/logs/backup.log 2>&1
```

`mkdir -p /home/unclutterdesk/app/logs` first if it does not exist.

Cron mails output on failure only if a mail transport is configured, which it
probably is not — so check the log occasionally, or point an uptime monitor at a
heartbeat if you want to be told.

### Restore drill

**A backup you have never restored is not a backup.** Do this once, now, while
nothing is wrong:

```bash
createdb unclutterdesk_restore_test
pg_restore --dbname=unclutterdesk_restore_test --no-owner --no-acl \
  "$HOME/backups/unclutterdesk/$(ls -t "$HOME/backups/unclutterdesk" | head -1)"

psql unclutterdesk_restore_test -c 'SELECT count(*) FROM "Tenant";'
psql unclutterdesk_restore_test -c 'SELECT count(*) FROM "ClinicalNote";'

dropdb unclutterdesk_restore_test
```

The counts should match production. If `pg_restore` errors, the backups have
been failing quietly and now is a much better time to find out.
