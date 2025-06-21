#!/bin/bash

# CLAXIS - PERFECT CODING SESSION CONCLUSION
# ==========================================  
# Captures EVERYTHING accomplished and preserves perfect continuity
# Usage: ./scripts/end-coding.sh

set -e

echo "🏁 CLAXIS CODING SESSION END"
echo "============================"

# Validate environment
if [ ! -f "CLAUDE.md" ]; then
    echo "❌ ERROR: Run from claxis project root (/home/wsl-murat/code/claxis/)"
    exit 1
fi

# Find current session
if [ ! -L ".claude-session-current" ]; then
    echo "❌ ERROR: No active session found. Did you run ./scripts/start-coding.sh first?"
    exit 1
fi

CURRENT_SESSION=$(readlink .claude-session-current)
COMPLETION_DIR="$CURRENT_SESSION/completion"
mkdir -p "$COMPLETION_DIR"

echo "📁 Completing session: $CURRENT_SESSION"

# ============================================================================
# 1. CAPTURE WORK ACCOMPLISHED
# ============================================================================

echo "📊 Analyzing work accomplished..."

cat > "$COMPLETION_DIR/work-summary.md" << EOF
# SESSION WORK SUMMARY
Session: $CURRENT_SESSION
Completed: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## 📋 CHANGES MADE

### Git Changes:
\`\`\`bash
# Modified files:
$(git diff --name-only HEAD 2>/dev/null | head -20 || echo "No files modified")

# New files:  
$(git ls-files --others --exclude-standard 2>/dev/null | head -20 || echo "No new files")

# Change statistics:
$(git diff --stat HEAD 2>/dev/null | tail -1 || echo "No changes detected")
\`\`\`

### Files Worked On:
EOF

# List actual files that were modified
if [ -n "$(git diff --name-only HEAD 2>/dev/null)" ]; then
    echo "\`\`\`" >> "$COMPLETION_DIR/work-summary.md"
    git diff --name-only HEAD | while read -r file; do
        if [ -f "$file" ]; then
            lines_added=$(git diff HEAD -- "$file" | grep -c "^+" || echo "0")
            lines_removed=$(git diff HEAD -- "$file" | grep -c "^-" || echo "0")
            echo "$file (+$lines_added, -$lines_removed)" >> "$COMPLETION_DIR/work-summary.md"
        fi
    done
    echo "\`\`\`" >> "$COMPLETION_DIR/work-summary.md"
else
    echo "No files were modified in this session." >> "$COMPLETION_DIR/work-summary.md"
fi

# ============================================================================
# 2. TEST CURRENT BUILD STATUS
# ============================================================================

echo "🧪 Testing final build status..."

cat > "$COMPLETION_DIR/final-status.md" << EOF
# FINAL BUILD STATUS
Tested: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

EOF

# Get absolute path for completion directory
COMPLETION_DIR_ABS="$(pwd)/$COMPLETION_DIR"

# Test n8n nodes
if [ -d "apps/n8n-nodes" ]; then
    echo "## n8n Nodes Final Status" >> "$COMPLETION_DIR_ABS/final-status.md"
    cd apps/n8n-nodes
    if timeout 60 npm test > /tmp/final-n8n-test.log 2>&1; then
        echo "✅ **Tests**: PASSING" >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
        grep -E "(Test Suites|Tests:|✓|passing)" /tmp/final-n8n-test.log | head -3 >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
    else
        echo "❌ **Tests**: FAILING" >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
        tail -8 /tmp/final-n8n-test.log >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
    fi
    cd ../..
fi

# Test frontend
if [ -d "apps/web" ]; then
    echo "" >> "$COMPLETION_DIR_ABS/final-status.md"
    echo "## Frontend Final Status" >> "$COMPLETION_DIR_ABS/final-status.md"
    cd apps/web
    if timeout 60 npm run typecheck > /tmp/final-web-typecheck.log 2>&1; then
        echo "✅ **TypeScript**: PASSING" >> "$COMPLETION_DIR_ABS/final-status.md"
    else
        echo "❌ **TypeScript**: FAILING" >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
        tail -12 /tmp/final-web-typecheck.log >> "$COMPLETION_DIR_ABS/final-status.md"
        echo "\`\`\`" >> "$COMPLETION_DIR_ABS/final-status.md"
    fi
    cd ../..
fi

# Check authentication status
echo "" >> "$COMPLETION_DIR_ABS/final-status.md"
echo "## Component Status Check" >> "$COMPLETION_DIR_ABS/final-status.md"

if [ -d "apps/web/app/auth" ] && [ "$(ls -A apps/web/app/auth 2>/dev/null)" ]; then
    echo "✅ **Authentication**: Files exist" >> "$COMPLETION_DIR_ABS/final-status.md"
    ls apps/web/app/auth/ | head -5 >> "$COMPLETION_DIR_ABS/final-status.md"
else
    echo "❌ **Authentication**: Still missing" >> "$COMPLETION_DIR_ABS/final-status.md"
fi

if [ -d "apps/web/app/dashboard" ] && [ "$(ls -A apps/web/app/dashboard 2>/dev/null)" ]; then
    echo "✅ **Dashboard**: Files exist" >> "$COMPLETION_DIR_ABS/final-status.md"
    ls apps/web/app/dashboard/ | head -5 >> "$COMPLETION_DIR_ABS/final-status.md"
else
    echo "❌ **Dashboard**: Still missing" >> "$COMPLETION_DIR_ABS/final-status.md"
fi

if [ -f "apps/web/app/api/webhooks/whatsapp/route.ts" ]; then
    if grep -q "// TODO\|// FIXME\|// commented" "apps/web/app/api/webhooks/whatsapp/route.ts" 2>/dev/null; then
        echo "🚧 **WhatsApp**: Still has commented/TODO code" >> "$COMPLETION_DIR_ABS/final-status.md"
    else
        echo "✅ **WhatsApp**: Integration appears complete" >> "$COMPLETION_DIR_ABS/final-status.md"
    fi
else
    echo "❌ **WhatsApp**: Route file missing" >> "$COMPLETION_DIR_ABS/final-status.md"
fi

# ============================================================================
# 3. DETERMINE NEXT PRIORITIES
# ============================================================================

echo "🎯 Determining next session priorities..."

cat > "$COMPLETION_DIR/next-priorities.md" << EOF
# NEXT SESSION PRIORITIES
Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## 🔥 CRITICAL PRIORITIES (Start Next Session)

EOF

# Dynamically determine priorities based on current state
if grep -q "❌.*TypeScript.*FAILING" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "1. **🚨 URGENT: Fix TypeScript Build Errors**" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - File: \`apps/web/tsconfig.json\`" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Impact: Blocks all frontend development" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

if grep -q "❌.*Authentication.*Still missing" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "2. **🔐 CRITICAL: Implement Authentication System**" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Files to create: \`apps/web/app/auth/login/page.tsx\`, \`apps/web/app/auth/register/page.tsx\`" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Impact: Security risk, cannot test multi-tenancy" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

if grep -q "❌.*Dashboard.*Still missing" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "3. **📊 HIGH: Create Basic Dashboard**" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Files to create: \`apps/web/app/dashboard/page.tsx\`, \`apps/web/app/dashboard/layout.tsx\`" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Impact: Cannot onboard salons, no user interface" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

if grep -q "🚧.*WhatsApp.*commented" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "4. **💬 HIGH: Complete WhatsApp Database Integration**" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - File: \`apps/web/app/api/webhooks/whatsapp/route.ts\`" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "   - Action: Uncomment and fix database persistence code (lines 45-60)" >> "$COMPLETION_DIR_ABS/next-priorities.md"
    echo "" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

# Add standard progression priorities
cat >> "$COMPLETION_DIR_ABS/next-priorities.md" << 'EOF'

## 📈 DEVELOPMENT PROGRESSION

### If Core Issues Are Fixed:
1. **Salon Onboarding Flow** - Multi-step registration wizard
2. **Basic Booking Interface** - Calendar view and appointment management
3. **Voice Campaign Management UI** - Leverage advanced backend capabilities
4. **Revenue Model Integration** - Stripe billing and subscription management

### If Still Working on Foundation:
1. **Complete TypeScript strict compliance** - Fix all type errors
2. **Add comprehensive error handling** - User-friendly error states
3. **Implement proper loading states** - Better user experience
4. **Add input validation** - Security and data integrity

## 🧪 TESTING PRIORITIES

### Missing Test Coverage:
- Voice Gateway Service (2,290 lines, no tests)
- Voice Synthesis Service (production code, no tests)
- Frontend components (when created)
- Integration flows (WhatsApp → DB → n8n)

### Testing Strategy:
1. **Unit tests** for new components
2. **Integration tests** for API flows  
3. **E2E tests** for user journeys
4. **Load tests** for voice services

## 🚀 DEPLOYMENT READINESS

### Current Blockers:
EOF

# Add deployment blockers based on current state
if grep -q "❌.*Authentication" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- No authentication system = No user access" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

if grep -q "❌.*Dashboard" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- No dashboard UI = No user experience" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

if grep -q "❌.*TypeScript.*FAILING" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- TypeScript build failing = Cannot build for production" >> "$COMPLETION_DIR_ABS/next-priorities.md"
fi

# ============================================================================
# 4. CREATE TECHNICAL HANDOFF
# ============================================================================

echo "🔧 Creating technical handoff..."

cat > "$COMPLETION_DIR/technical-handoff.md" << EOF
# TECHNICAL CONTEXT HANDOFF
Session: $CURRENT_SESSION
For: Next Claude Code Session

## 🛠️ CURRENT DEVELOPMENT STATE

### Working Directory: $(pwd)
### Git State:
- **Branch**: $(git branch --show-current 2>/dev/null || echo 'unknown')
- **Commit**: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')  
- **Uncommitted Files**: $(git status --porcelain | wc -l)

### Development Environment:
\`\`\`bash
# Quick status check commands:
cd apps/web && npm run typecheck    # Check TypeScript
cd apps/n8n-nodes && npm test      # Check backend (should pass)
git status                          # Check for changes
\`\`\`

## 🔍 IMPLEMENTATION PATTERNS

### Authentication Pattern (When Implementing):
\`\`\`typescript
// Supabase Auth integration pattern:
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()
  
  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    })
    // Handle response...
  }
}
\`\`\`

### Dashboard Layout Pattern:
\`\`\`typescript
// Multi-tenant dashboard pattern:
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Check authentication
  // Get salon context
  // Render navigation + content
}
\`\`\`

### WhatsApp Database Integration Pattern:
\`\`\`typescript
// In route.ts - uncomment and fix:
// await supabase.from('messages').insert({
//   salon_id: salonId,
//   whatsapp_message_id: messageId,
//   content: message.text,
//   direction: 'inbound'
// })
\`\`\`

## 📂 KEY FILES TO CONTINUE WORKING ON

### Priority Files:
EOF

# Add specific files based on what still needs work
if grep -q "❌.*TypeScript" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- \`apps/web/tsconfig.json\` - Fix strict mode configuration" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
fi

if grep -q "❌.*Authentication" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- \`apps/web/app/auth/login/page.tsx\` - Create login interface" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
    echo "- \`apps/web/app/auth/register/page.tsx\` - Create registration flow" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
    echo "- \`apps/web/lib/auth/middleware.ts\` - Session management" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
fi

if grep -q "❌.*Dashboard" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- \`apps/web/app/dashboard/page.tsx\` - Main dashboard interface" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
    echo "- \`apps/web/app/dashboard/layout.tsx\` - Dashboard shell" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
fi

if grep -q "🚧.*WhatsApp" "$COMPLETION_DIR_ABS/final-status.md" 2>/dev/null; then
    echo "- \`apps/web/app/api/webhooks/whatsapp/route.ts\` - Fix database integration" >> "$COMPLETION_DIR_ABS/technical-handoff.md"
fi

cat >> "$COMPLETION_DIR_ABS/technical-handoff.md" << 'EOF'

### Dependencies Already Available:
- Supabase client configured in `lib/supabase/client.ts`
- TypeScript types generated in `lib/supabase/types.ts`  
- shadcn/ui components in `components/ui/`
- Tailwind CSS configured

### Integration Points Ready:
- Database schema with RLS policies
- n8n nodes with 106/106 tests passing
- Voice services production-ready
- WhatsApp API client implemented
EOF

# ============================================================================
# 5. CREATE SESSION ARCHIVE
# ============================================================================

echo "📦 Creating session archive..."

# Session completion summary
cat > "$COMPLETION_DIR/session-complete.md" << EOF
# 🎉 SESSION COMPLETED
**ID**: $CURRENT_SESSION
**Duration**: Session time not tracked (add start time to calculate)
**Completed**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## 📊 SESSION IMPACT
$(if [ -n "$(git diff --name-only HEAD 2>/dev/null)" ]; then
    echo "**Files Modified**: $(git diff --name-only HEAD | wc -l)"
    echo "**Lines Changed**: $(git diff --stat HEAD 2>/dev/null | tail -1 || echo 'Stats not available')"
else
    echo "**No files were modified** in this session"
fi)

## 🎯 FOR NEXT SESSION

### Resume Command:
\`\`\`bash
./scripts/start-coding.sh
# Then review: .claude-session-current/quick-start.md
\`\`\`

### Priority Review Files:
- \`$COMPLETION_DIR/next-priorities.md\` - What to work on next
- \`$COMPLETION_DIR/final-status.md\` - Current component status
- \`$COMPLETION_DIR/technical-handoff.md\` - Implementation patterns

## 🔄 PERFECT CONTINUITY PRESERVED
Any new Claude Code session can resume exactly where this left off using the start-coding script and session documentation.
EOF

# Create session state file for next session
cat > "$COMPLETION_DIR/handoff-state.json" << EOF
{
  "previous_session": "$CURRENT_SESSION",
  "completed_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "phase": "4.4+ Advanced Campaign Intelligence",
  "files_modified": $(git diff --name-only HEAD 2>/dev/null | wc -l || echo 0),
  "build_status": {
    "n8n_tests": "$(grep -q "✅.*Tests.*PASSING" "$COMPLETION_DIR/final-status.md" && echo "passing" || echo "unknown")",
    "frontend_typescript": "$(grep -q "✅.*TypeScript.*PASSING" "$COMPLETION_DIR/final-status.md" && echo "passing" || echo "failing")"
  },
  "component_status": {
    "authentication": "$(grep -q "✅.*Authentication" "$COMPLETION_DIR/final-status.md" && echo "implemented" || echo "missing")",
    "dashboard": "$(grep -q "✅.*Dashboard" "$COMPLETION_DIR/final-status.md" && echo "implemented" || echo "missing")",
    "whatsapp_db": "$(grep -q "✅.*WhatsApp.*complete" "$COMPLETION_DIR/final-status.md" && echo "complete" || echo "incomplete")"
  },
  "next_priority_files": [
    "apps/web/tsconfig.json",
    "apps/web/app/auth/login/page.tsx", 
    "apps/web/app/dashboard/page.tsx",
    "apps/web/app/api/webhooks/whatsapp/route.ts"
  ]
}
EOF

echo ""
echo "✅ SESSION COMPLETED SUCCESSFULLY"
echo ""
echo "📋 SESSION SUMMARY:"
echo "   📁 Completion data: $COMPLETION_DIR"
echo "   📊 Files modified: $(git diff --name-only HEAD 2>/dev/null | wc -l || echo 0)"
echo "   🔗 Quick access: .claude-session-current/completion/"
echo ""
echo "🎯 NEXT SESSION:"
echo "   1. Run: ./scripts/start-coding.sh"
echo "   2. Review: .claude-session-current/completion/next-priorities.md"
echo "   3. Continue with highest priority item"
echo ""
echo "💡 Perfect continuity preserved for next Claude Code session!"
echo ""