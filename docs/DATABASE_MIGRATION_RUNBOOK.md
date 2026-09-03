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

## Still outstanding

`deploy.sh` only backs up at deploy time. A database holding clinical records
also needs a scheduled backup independent of deploys — a nightly `pg_dump` cron
writing off-host (object storage, not the same server), with the restore drill
above run against it periodically.
