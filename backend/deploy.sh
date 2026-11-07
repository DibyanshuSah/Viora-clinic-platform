#!/usr/bin/env bash
# =============================================================================
# Viora Clinic Platform – Bluehost VPS Deployment Script
# Run this script from the repository root on the VPS:
#   bash backend/deploy.sh
# =============================================================================
set -euo pipefail

# ── Colour helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[PASS]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()    { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ── Config ───────────────────────────────────────────────────────────────────
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/.." && pwd)"
DB_PATH="$BACKEND_DIR/prisma/viora.db"
BACKUP_DIR="$BACKEND_DIR/prisma/backups"
PM2_APP_NAME="viora-backend"
PORT=5000

echo ""
echo "============================================="
echo "   VIORA – Bluehost Production Deployment"
echo "============================================="
echo "  Backend dir : $BACKEND_DIR"
echo "  DB path     : $DB_PATH"
echo "  PM2 app     : $PM2_APP_NAME"
echo "  Port        : $PORT"
echo ""

# ── Step 1: Pre-flight checks ─────────────────────────────────────────────────
info "Step 1: Pre-flight checks..."

command -v node  >/dev/null 2>&1 || fail "Node.js not found. Install Node.js v18+."
command -v npm   >/dev/null 2>&1 || fail "npm not found."
command -v pm2   >/dev/null 2>&1 || fail "PM2 not found. Run: npm install -g pm2"

NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
[[ "$NODE_MAJOR" -ge 18 ]] || fail "Node.js v18+ required. Found: v$NODE_VER"
ok "Node.js v$NODE_VER"

# Check .env exists and has DATABASE_URL set to an absolute path
ENV_FILE="$BACKEND_DIR/.env"
[[ -f "$ENV_FILE" ]] || fail ".env file not found at $ENV_FILE. Copy .env.example and configure."
grep -q "DATABASE_URL" "$ENV_FILE" || fail "DATABASE_URL not set in .env"
DB_URL=$(grep "^DATABASE_URL" "$ENV_FILE" | head -1 | sed 's/DATABASE_URL=//;s/"//g')
info "DATABASE_URL = $DB_URL"

# Validate path resolves to the actual DB
if [[ "$DB_URL" == file:./prisma/* ]]; then
  RESOLVED_DB="$BACKEND_DIR/prisma/viora.db"
elif [[ "$DB_URL" == file:/* ]]; then
  RESOLVED_DB="${DB_URL#file:}"
else
  fail "DATABASE_URL must start with 'file:./prisma/' or 'file:/absolute/path'"
fi

ok "Resolved DB path: $RESOLVED_DB"

# ── Step 2: Backup existing database ─────────────────────────────────────────
info "Step 2: Creating pre-deployment backup..."
mkdir -p "$BACKUP_DIR"

if [[ -f "$RESOLVED_DB" ]]; then
  STAMP=$(date +%Y-%m-%d_%H-%M-%S)
  BACKUP_FILE="$BACKUP_DIR/viora_backup_pre_deploy_${STAMP}.db"
  
  # Checkpoint WAL before backup
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$RESOLVED_DB" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1 || true
    INTEGRITY=$(sqlite3 "$RESOLVED_DB" "PRAGMA integrity_check;" 2>/dev/null | head -1)
    [[ "$INTEGRITY" == "ok" ]] || warn "Integrity check returned: $INTEGRITY"
    cp "$RESOLVED_DB" "$BACKUP_FILE"
    ok "Backup created: $BACKUP_FILE"
  else
    warn "sqlite3 CLI not available – using npm backup script instead"
    cd "$BACKEND_DIR" && NODE_ENV=production npm run db:backup || warn "Backup via npm failed – continuing"
  fi
else
  warn "No existing database found at $RESOLVED_DB – this appears to be a fresh install"
fi

# ── Step 3: Pull latest code ───────────────────────────────────────────────
info "Step 3: Pulling latest code..."
cd "$REPO_ROOT"
git pull origin main
ok "Code updated"

# ── Step 4: Install dependencies ───────────────────────────────────────────
info "Step 4: Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production
ok "Dependencies installed"

# ── Step 5: Generate Prisma client ────────────────────────────────────────
info "Step 5: Generating Prisma client..."
npx prisma generate
ok "Prisma client generated"

# ── Step 6: Run migrations ────────────────────────────────────────────────
info "Step 6: Applying database migrations..."
DATABASE_URL="file:$RESOLVED_DB" npx prisma migrate deploy
ok "Migrations applied"

# Verify migration status
MIGRATE_STATUS=$(DATABASE_URL="file:$RESOLVED_DB" npx prisma migrate status 2>&1 | tail -3)
info "Migration status: $MIGRATE_STATUS"
echo "$MIGRATE_STATUS" | grep -q "up to date" || warn "Migration status check uncertain – verify manually"

# ── Step 7: Verify database schema ───────────────────────────────────────
info "Step 7: Verifying database schema..."
node - <<'EOF'
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dbPath = path.join(__dirname, 'prisma', 'viora.db');
const p = new PrismaClient({ datasources: { db: { url: 'file:' + dbPath } }, log: ['error'] });
async function check() {
  const cols = await p.$queryRawUnsafe('PRAGMA table_info(bills);');
  const hasInvoiceStatus = cols.some(c => c.name === 'invoiceStatus');
  const idSeqTable = await p.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='id_sequences';");
  const clinic = await p.$queryRawUnsafe('SELECT currency FROM clinic_profiles;');
  const currency = clinic[0]?.currency;
  console.log('invoiceStatus column:', hasInvoiceStatus ? 'PRESENT' : 'MISSING');
  console.log('id_sequences table:', idSeqTable.length > 0 ? 'PRESENT' : 'MISSING');
  console.log('currency:', currency);
  if (!hasInvoiceStatus || idSeqTable.length === 0 || currency !== '₹') process.exit(1);
  await p.$disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });
EOF
ok "Schema verified: invoiceStatus ✓  id_sequences ✓  currency=₹ ✓"

# ── Step 8: (Re)start PM2 ────────────────────────────────────────────────
info "Step 8: Restarting PM2..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_APP_NAME" --update-env
  ok "PM2 app reloaded"
else
  pm2 start ecosystem.config.js
  ok "PM2 app started"
fi

pm2 save
ok "PM2 process list saved"

# ── Step 9: Health check ─────────────────────────────────────────────────
info "Step 9: Health check (waiting 3s for startup)..."
sleep 3
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/health" 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  ok "Health check: HTTP 200"
else
  warn "Health check returned HTTP $HEALTH – verify manually: curl http://localhost:$PORT/health"
fi

# ── Step 10: Post-deployment backup ──────────────────────────────────────
info "Step 10: Post-deployment backup..."
cd "$BACKEND_DIR"
NODE_ENV=production npm run db:backup || warn "Post-deploy backup failed – run manually: npm run db:backup"
ok "Post-deployment backup complete"

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "============================================="
echo -e "   ${GREEN}Deployment Complete${NC}"
echo "============================================="
pm2 list
echo ""
echo "  Health:  curl http://localhost:$PORT/health"
echo "  Logs:    pm2 logs $PM2_APP_NAME"
echo "  Status:  pm2 show $PM2_APP_NAME"
echo ""

