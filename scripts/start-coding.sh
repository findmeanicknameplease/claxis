#!/bin/bash

# CLAXIS - PERFECT CODING SESSION INITIALIZATION
# ==============================================
# Captures EVERYTHING Claude Code needs for seamless continuity
# Usage: ./scripts/start-coding.sh

set -e

echo "🚀 CLAXIS CODING SESSION START"
echo "=============================="

# Validate we're in the right place
if [ ! -f "CLAUDE.md" ]; then
    echo "❌ ERROR: Run from claxis project root (/home/wsl-murat/code/claxis/)"
    exit 1
fi

# Create session directory
SESSION_ID="session-$(date +%Y%m%d-%H%M%S)"
SESSION_DIR=".claude-$SESSION_ID"
mkdir -p "$SESSION_DIR"

echo "📁 Session: $SESSION_DIR"

# Create symlink for easy access
ln -sf "$SESSION_DIR" .claude-session-current

# ============================================================================
# 1. PROJECT STATE SNAPSHOT
# ============================================================================

echo "🔍 Analyzing project state..."

cat > "$SESSION_DIR/project-state.md" << EOF
# CLAXIS PROJECT STATE
Session: $SESSION_ID
Started: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Phase: 4.4+ Advanced Campaign Intelligence

## CURRENT REALITY vs DOCUMENTATION

### ✅ BACKEND STRENGTHS (Production-Ready):
- **n8n Custom Nodes**: 106/106 tests passing - Enterprise features ready
- **Voice Gateway Service**: Real-time WebSocket orchestration (Twilio ↔ ElevenLabs)  
- **Voice Synthesis Service**: ElevenLabs streaming integration with caching
- **Database Schema**: Enterprise multi-tenant with RLS policies
- **Campaign Engine**: BullMQ job processing with Redis integration

### ❌ FRONTEND GAPS (Blocking Production):
- **Authentication**: 0% implemented - No login/logout system
- **Dashboard UI**: 0% functional - Cannot onboard salons  
- **TypeScript Build**: Failing with 40+ strict mode errors
- **User Management**: Missing completely - Security risk

### 🚧 INTEGRATION ISSUES:
- **WhatsApp → Database**: Persistence code commented out (route.ts:45-60)
- **Frontend → Backend**: No authentication bridge
- **Voice Gateway → UI**: No campaign management interface

## IMMEDIATE SESSION PRIORITIES

### 🔥 CRITICAL (Fix First):
1. **TypeScript Build Issues** - apps/web/tsconfig.json
2. **Authentication System** - apps/web/app/auth/ (empty)
3. **WhatsApp DB Integration** - Uncomment persistence code
4. **Basic Dashboard** - apps/web/app/dashboard/ (empty)

### 📂 TARGET FILES:
- apps/web/tsconfig.json (strict mode config)
- apps/web/app/auth/login/page.tsx (create)
- apps/web/app/auth/register/page.tsx (create)  
- apps/web/app/dashboard/page.tsx (create)
- apps/web/app/api/webhooks/whatsapp/route.ts (fix lines 45-60)
- apps/web/lib/auth/middleware.ts (create)
EOF

# ============================================================================
# 2. TECHNICAL ENVIRONMENT
# ============================================================================

echo "🔧 Checking technical environment..."

cat > "$SESSION_DIR/environment.md" << EOF
# TECHNICAL ENVIRONMENT
Working Directory: $(pwd)
Git Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')
Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')

## GIT STATUS
\`\`\`
$(git status --porcelain 2>/dev/null || echo "No git status available")
\`\`\`

## DEPENDENCIES STATUS
EOF

# Check key package.json files (avoid node_modules)
for pkg in "./package.json" "./apps/web/package.json" "./apps/n8n-nodes/package.json" "./apps/voice-gateway-service/package.json"; do
    if [ -f "$pkg" ]; then
        echo "### $pkg" >> "$SESSION_DIR/environment.md"
        echo '```json' >> "$SESSION_DIR/environment.md"
        head -20 "$pkg" >> "$SESSION_DIR/environment.md"
        echo '```' >> "$SESSION_DIR/environment.md"
        echo "" >> "$SESSION_DIR/environment.md"
    fi
done

# ============================================================================
# 3. BUILD STATUS ANALYSIS
# ============================================================================

echo "🧪 Testing build status..."

cat > "$SESSION_DIR/build-status.md" << EOF
# BUILD STATUS ANALYSIS
Checked: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

EOF

# Get absolute path for session directory
SESSION_DIR_ABS="$(pwd)/$SESSION_DIR"

# Test n8n nodes
if [ -d "apps/n8n-nodes" ]; then
    echo "## n8n Nodes" >> "$SESSION_DIR_ABS/build-status.md"
    cd apps/n8n-nodes
    if timeout 60 npm test > /tmp/n8n-test.log 2>&1; then
        echo "✅ **Tests**: PASSING" >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
        grep -E "(Test Suites|Tests:|✓|passing)" /tmp/n8n-test.log | head -5 >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
    else
        echo "❌ **Tests**: FAILING" >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
        tail -10 /tmp/n8n-test.log >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
    fi
    cd ../..
fi

# Test frontend build
if [ -d "apps/web" ]; then
    echo "" >> "$SESSION_DIR_ABS/build-status.md"
    echo "## Frontend" >> "$SESSION_DIR_ABS/build-status.md"
    cd apps/web
    if timeout 60 npm run typecheck > /tmp/web-typecheck.log 2>&1; then
        echo "✅ **TypeScript**: PASSING" >> "$SESSION_DIR_ABS/build-status.md"
    else
        echo "❌ **TypeScript**: FAILING" >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
        tail -15 /tmp/web-typecheck.log >> "$SESSION_DIR_ABS/build-status.md"
        echo '```' >> "$SESSION_DIR_ABS/build-status.md"
    fi
    cd ../..
fi

# ============================================================================
# 4. INTEGRATION MAPPING
# ============================================================================

echo "🔗 Mapping integrations..."

cat > "$SESSION_DIR/integrations.md" << EOF
# INTEGRATION STATUS

## CRITICAL FLOWS

### 1. WhatsApp Message Processing
\`\`\`
WhatsApp API → Webhook (route.ts) → [❌ DB COMMENTED] → n8n → Response
\`\`\`
**Status**: 60% complete - Database persistence disabled
**Fix**: Uncomment lines 45-60 in apps/web/app/api/webhooks/whatsapp/route.ts

### 2. User Authentication Flow  
\`\`\`
[❌ MISSING] Login → Session → Salon Access → Dashboard
\`\`\`
**Status**: 0% implemented
**Fix**: Create auth pages in apps/web/app/auth/

### 3. Voice Agent System
\`\`\`
Call → Twilio → Voice Gateway → ElevenLabs → n8n → [❌ NO UI]
\`\`\`
**Status**: 90% backend, 0% frontend
**Fix**: Create campaign management dashboard

## WORKING INTEGRATIONS
- ✅ n8n nodes ↔ Supabase database
- ✅ Voice Gateway ↔ Twilio ↔ ElevenLabs  
- ✅ Voice Synthesis ↔ ElevenLabs ↔ Supabase storage
- ✅ Campaign Engine ↔ BullMQ ↔ Redis

## BROKEN INTEGRATIONS
- ❌ WhatsApp ↔ Database (commented code)
- ❌ Frontend ↔ Authentication (missing)
- ❌ Dashboard ↔ Backend APIs (missing)
EOF

# ============================================================================
# 5. QUICK REFERENCE
# ============================================================================

cat > "$SESSION_DIR/quick-start.md" << EOF
# QUICK START GUIDE

## 🎯 WHERE WE ARE
**Phase 4.4+**: Advanced backend ready, frontend needs basic implementation

## ⚡ IMMEDIATE ACTIONS (Priority Order)
1. **Fix TypeScript**: \`cd apps/web && npm run typecheck\`
2. **Create Auth Pages**: \`apps/web/app/auth/login/page.tsx\`
3. **Create Dashboard**: \`apps/web/app/dashboard/page.tsx\`  
4. **Fix WhatsApp DB**: Uncomment \`route.ts:45-60\`

## 🔧 DEVELOPMENT COMMANDS
\`\`\`bash
# Check current issues:
cd apps/web && npm run typecheck    # See TypeScript errors
cd apps/n8n-nodes && npm test      # Should pass (106 tests)

# Start development:  
cd apps/web && npm run dev          # Frontend dev server
cd apps/voice-gateway-service && npm start  # Voice service
\`\`\`

## 📂 KEY FILES TO EDIT
- \`apps/web/tsconfig.json\` - Fix strict mode
- \`apps/web/app/auth/login/page.tsx\` - Create login
- \`apps/web/app/dashboard/page.tsx\` - Create dashboard
- \`apps/web/app/api/webhooks/whatsapp/route.ts\` - Fix DB integration

## 🚨 CRITICAL BLOCKERS
- No authentication = Security risk + Cannot test multi-tenancy
- No dashboard = Cannot onboard salons + No user interface
- TypeScript failing = Cannot develop frontend features
- WhatsApp DB commented = Messages not persisted
EOF

# ============================================================================
# 6. SESSION STATE
# ============================================================================

cat > "$SESSION_DIR/session-state.json" << EOF
{
  "session_id": "$SESSION_ID",
  "started_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "working_directory": "$(pwd)",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')",
  "git_commit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "phase": "4.4+ Advanced Campaign Intelligence",
  "priority_issues": [
    "TypeScript build failing (40+ errors)",
    "No authentication system (0% implemented)",
    "No dashboard UI (0% functional)", 
    "WhatsApp DB integration commented out"
  ],
  "ready_components": [
    "n8n nodes (106/106 tests passing)",
    "Voice Gateway (WebSocket orchestration)",
    "Voice Synthesis (ElevenLabs integration)",
    "Database schema (enterprise multi-tenant)",
    "Campaign Engine (BullMQ + Redis)"
  ],
  "target_files": [
    "apps/web/tsconfig.json",
    "apps/web/app/auth/login/page.tsx",
    "apps/web/app/dashboard/page.tsx",
    "apps/web/app/api/webhooks/whatsapp/route.ts"
  ]
}
EOF

echo ""
echo "✅ SESSION INITIALIZED SUCCESSFULLY"
echo ""
echo "📋 CONTEXT READY:"
echo "   📁 Session data: $SESSION_DIR"
echo "   🔗 Quick access: .claude-session-current"
echo ""
echo "🎯 START HERE:"
echo "   1. Review: .claude-session-current/quick-start.md"
echo "   2. Check: .claude-session-current/build-status.md"  
echo "   3. Fix: TypeScript errors first"
echo ""
echo "💬 Ready to code! Tell Claude: 'I've run ./start-coding - what should we fix first?'"
echo ""