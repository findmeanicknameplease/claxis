#!/bin/bash

# =============================================================================
# Gemini Salon AI - Session Initialization Script
# Optimized for Cursor + Sonnet 4 Development Workflow
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project information
PROJECT_NAME="Gemini Salon AI"
VERSION="3.0"
PHASE="n8n Custom Node Development"

echo ""
echo -e "${PURPLE}🚀 Initializing ${PROJECT_NAME} Development Session${NC}"
echo -e "${PURPLE}================================================================${NC}"
echo -e "${CYAN}Version: ${VERSION} | Current Phase: ${PHASE}${NC}"
echo ""

# =============================================================================
# 1. DISPLAY CURRENT STATUS
# =============================================================================
echo -e "${BLUE}📊 CURRENT PROJECT STATUS${NC}"
echo -e "${BLUE}=========================${NC}"

if [[ -f ".claude-context/status.md" ]]; then
    echo -e "${GREEN}✅ Status file found. Current progress:${NC}"
    cat .claude-context/status.md | head -20
    echo ""
else
    echo -e "${RED}❌ Status file not found. Please ensure .claude-context/status.md exists.${NC}"
    echo ""
fi

# =============================================================================
# 2. DISPLAY CURRENT PRIORITIES
# =============================================================================
echo -e "${BLUE}🎯 CURRENT PRIORITIES${NC}"
echo -e "${BLUE}===================${NC}"

if [[ -f ".claude-context/priorities.md" ]]; then
    echo -e "${GREEN}✅ Priorities loaded:${NC}"
    cat .claude-context/priorities.md | head -15
    echo ""
else
    echo -e "${RED}❌ Priorities file not found. Please ensure .claude-context/priorities.md exists.${NC}"
    echo ""
fi

# =============================================================================
# 3. TECHNICAL ARCHITECTURE OVERVIEW
# =============================================================================
echo -e "${BLUE}🏗️ TECHNICAL ARCHITECTURE${NC}"
echo -e "${BLUE}=========================${NC}"
echo -e "${CYAN}Frontend:${NC} Next.js 14 + TypeScript + shadcn/ui + Tailwind CSS"
echo -e "${CYAN}Backend:${NC} n8n (Self-hosted EU-Frankfurt) + Supabase PostgreSQL"
echo -e "${CYAN}AI Stack:${NC} Gemini Flash + DeepSeek R1 + ElevenLabs (Enterprise)"
echo -e "${CYAN}Messaging:${NC} WhatsApp Business API + Instagram Graph API"
echo -e "${CYAN}Deployment:${NC} Render EU (MVP) → Kubernetes (Scale)"
echo -e "${CYAN}Monitoring:${NC} Prometheus + Grafana + Sentry"
echo ""

# =============================================================================
# 4. VALIDATE DEVELOPMENT ENVIRONMENT
# =============================================================================
echo -e "${BLUE}🔧 DEVELOPMENT ENVIRONMENT CHECK${NC}"
echo -e "${BLUE}=================================${NC}"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js: ${NODE_VERSION}${NC}"
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
fi

# Check npm/yarn
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm: ${NPM_VERSION}${NC}"
else
    echo -e "${RED}❌ npm not found${NC}"
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "${GREEN}✅ Docker: ${DOCKER_VERSION}${NC}"
else
    echo -e "${YELLOW}⚠️  Docker not found. Install for local n8n testing${NC}"
fi

# Check Git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✅ Git: ${GIT_VERSION}${NC}"
else
    echo -e "${RED}❌ Git not found${NC}"
fi

echo ""

# =============================================================================
# 5. PROJECT STRUCTURE VALIDATION
# =============================================================================
echo -e "${BLUE}📁 PROJECT STRUCTURE VALIDATION${NC}"
echo -e "${BLUE}===============================${NC}"

# Critical directories
CRITICAL_DIRS=(
    ".claude-context"
    "src/app"
    "src/lib/n8n"
    "custom-nodes"
    "src/components/dashboard"
)

for dir in "${CRITICAL_DIRS[@]}"; do
    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}✅ $dir${NC}"
    else
        echo -e "${RED}❌ $dir (missing)${NC}"
    fi
done

# Critical files
CRITICAL_FILES=(
    "package.json"
    "next.config.js"
    "tailwind.config.js"
    ".env.local"
    "docker-compose.yml"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${YELLOW}⚠️  $file (missing or optional)${NC}"
    fi
done

echo ""

# =============================================================================
# 6. QUICK DEVELOPMENT COMMANDS
# =============================================================================
echo -e "${BLUE}⚡ QUICK DEVELOPMENT COMMANDS${NC}"
echo -e "${BLUE}============================${NC}"
echo -e "${CYAN}Development Server:${NC}"
echo -e "  ${GREEN}npm run dev${NC}                 # Start Next.js development server"
echo -e "  ${GREEN}npm run dev:n8n${NC}             # Start local n8n instance"
echo ""
echo -e "${CYAN}Testing & Quality:${NC}"
echo -e "  ${GREEN}npm run test${NC}                # Run test suite"
echo -e "  ${GREEN}npm run test:watch${NC}          # Run tests in watch mode"
echo -e "  ${GREEN}npm run lint${NC}                # Run ESLint"
echo -e "  ${GREEN}npm run type-check${NC}          # TypeScript type checking"
echo ""
echo -e "${CYAN}Building & Deployment:${NC}"
echo -e "  ${GREEN}npm run build${NC}               # Production build"
echo -e "  ${GREEN}npm run build:nodes${NC}         # Build custom n8n nodes"
echo -e "  ${GREEN}npm run deploy:staging${NC}      # Deploy to staging"
echo ""
echo -e "${CYAN}Database & Infrastructure:${NC}"
echo -e "  ${GREEN}npm run db:migrate${NC}          # Run database migrations"
echo -e "  ${GREEN}npm run db:seed${NC}             # Seed development data"
echo -e "  ${GREEN}docker-compose up n8n${NC}      # Start local n8n container"
echo ""

# =============================================================================
# 7. CURRENT SPRINT FOCUS
# =============================================================================
echo -e "${BLUE}🎯 CURRENT SPRINT FOCUS (Week 3-4)${NC}"
echo -e "${BLUE}=================================${NC}"
echo -e "${CYAN}Primary Objective:${NC} Complete n8n custom node development"
echo -e "${CYAN}Key Deliverables:${NC}"
echo -e "  ${GREEN}•${NC} SalonContext Node (Salon settings & business hours)"
echo -e "  ${GREEN}•${NC} ServiceWindow Node (WhatsApp cost optimization)"
echo -e "  ${GREEN}•${NC} AIOrchestrator Node (Multi-model AI routing)"
echo -e "  ${GREEN}•${NC} BookingEngine Node (Calendar integration)"
echo ""
echo -e "${CYAN}Success Criteria:${NC}"
echo -e "  ${GREEN}•${NC} All 4 custom nodes execute without errors"
echo -e "  ${GREEN}•${NC} WhatsApp integration processes messages <3 seconds"
echo -e "  ${GREEN}•${NC} Service window optimization saves >70% template costs"
echo -e "  ${GREEN}•${NC} AI accuracy >85% for intent detection"
echo ""

# =============================================================================
# 8. CURSOR + SONNET 4 OPTIMIZATION TIPS
# =============================================================================
echo -e "${BLUE}💡 CURSOR + SONNET 4 OPTIMIZATION TIPS${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${CYAN}Effective Prompting:${NC}"
echo -e "  ${GREEN}•${NC} Always provide context about current n8n implementation"
echo -e "  ${GREEN}•${NC} Request TypeScript strict mode with comprehensive interfaces"
echo -e "  ${GREEN}•${NC} Ask for EU GDPR compliance in all implementations"
echo -e "  ${GREEN}•${NC} Specify performance requirements (<3s workflow execution)"
echo ""
echo -e "${CYAN}Code Quality Standards:${NC}"
echo -e "  ${GREEN}•${NC} Unit tests with >80% coverage"
echo -e "  ${GREEN}•${NC} JSDoc comments for all public functions"
echo -e "  ${GREEN}•${NC} Error handling with proper logging"
echo -e "  ${GREEN}•${NC} Security-first implementation"
echo ""

# =============================================================================
# 9. ENVIRONMENT VARIABLES CHECK
# =============================================================================
echo -e "${BLUE}🔐 ENVIRONMENT VARIABLES CHECK${NC}"
echo -e "${BLUE}=============================${NC}"

ENV_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "N8N_API_URL"
    "WHATSAPP_ACCESS_TOKEN"
    "GEMINI_API_KEY"
)

if [[ -f ".env.local" ]]; then
    echo -e "${GREEN}✅ .env.local file found${NC}"
    
    for var in "${ENV_VARS[@]}"; do
        if grep -q "^${var}=" .env.local; then
            echo -e "${GREEN}✅ ${var}${NC}"
        else
            echo -e "${YELLOW}⚠️  ${var} (not set)${NC}"
        fi
    done
else
    echo -e "${RED}❌ .env.local file not found${NC}"
    echo -e "${YELLOW}💡 Copy .env.example to .env.local and configure variables${NC}"
fi

echo ""

# =============================================================================
# 10. HEALTH CHECKS
# =============================================================================
echo -e "${BLUE}🏥 SYSTEM HEALTH CHECKS${NC}"
echo -e "${BLUE}======================${NC}"

# Check if development server is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Next.js development server is running (localhost:3000)${NC}"
else
    echo -e "${YELLOW}⚠️  Next.js development server not running${NC}"
    echo -e "${CYAN}   Run: npm run dev${NC}"
fi

# Check if n8n is running
if curl -s http://localhost:5678 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ n8n instance is running (localhost:5678)${NC}"
else
    echo -e "${YELLOW}⚠️  n8n instance not running${NC}"
    echo -e "${CYAN}   Run: docker-compose up n8n${NC}"
fi

# Check database connectivity (if configured)
if [[ -n "$NEXT_PUBLIC_SUPABASE_URL" ]]; then
    echo -e "${GREEN}✅ Supabase configuration detected${NC}"
else
    echo -e "${YELLOW}⚠️  Supabase not configured${NC}"
fi

echo ""

# =============================================================================
# 11. HELPFUL LINKS & RESOURCES
# =============================================================================
echo -e "${BLUE}📚 HELPFUL LINKS & RESOURCES${NC}"
echo -e "${BLUE}===========================${NC}"
echo -e "${CYAN}Documentation:${NC}"
echo -e "  ${GREEN}•${NC} n8n Documentation: https://docs.n8n.io/"
echo -e "  ${GREEN}•${NC} Supabase Documentation: https://supabase.com/docs"
echo -e "  ${GREEN}•${NC} Next.js Documentation: https://nextjs.org/docs"
echo -e "  ${GREEN}•${NC} WhatsApp Business API: https://developers.facebook.com/docs/whatsapp"
echo ""
echo -e "${CYAN}Local Development:${NC}"
echo -e "  ${GREEN}•${NC} Dashboard: http://localhost:3000"
echo -e "  ${GREEN}•${NC} n8n Editor: http://localhost:5678"
echo -e "  ${GREEN}•${NC} Supabase Studio: ${NEXT_PUBLIC_SUPABASE_URL}/project/default"
echo ""

# =============================================================================
# 12. NEXT STEPS REMINDER
# =============================================================================
echo -e "${BLUE}🚀 NEXT STEPS REMINDER${NC}"
echo -e "${BLUE}===================${NC}"
echo -e "${CYAN}Immediate Tasks:${NC}"
echo -e "  ${GREEN}1.${NC} Complete SalonContext node implementation"
echo -e "  ${GREEN}2.${NC} Implement ServiceWindow cost optimization logic"
echo -e "  ${GREEN}3.${NC} Set up WhatsApp webhook integration"
echo -e "  ${GREEN}4.${NC} Test end-to-end workflow execution"
echo ""
echo -e "${CYAN}Week 4 Goals:${NC}"
echo -e "  ${GREEN}•${NC} All custom nodes deployed and functional"
echo -e "  ${GREEN}•${NC} WhatsApp integration processing real messages"
echo -e "  ${GREEN}•${NC} Dashboard showing real-time workflow monitoring"
echo -e "  ${GREEN}•${NC} Beta salon onboarding preparation"
echo ""

# =============================================================================
# 13. FINAL STATUS
# =============================================================================
echo -e "${PURPLE}================================================================${NC}"
echo -e "${GREEN}✅ Session initialization complete!${NC}"
echo -e "${CYAN}Ready for n8n-first development with Cursor + Sonnet 4${NC}"
echo ""
echo -e "${YELLOW}💡 Remember to:${NC}"
echo -e "   ${GREEN}•${NC} Load project context in each new Cursor session"
echo -e "   ${GREEN}•${NC} Update .claude-context/status.md after major progress"
echo -e "   ${GREEN}•${NC} Use security-first prompting for all implementations"
echo -e "   ${GREEN}•${NC} Test all custom nodes thoroughly before deployment"
echo ""
echo -e "${PURPLE}Happy coding! 🎉${NC}"
echo ""

# =============================================================================
# 14. OPTIONAL: START DEVELOPMENT SERVICES
# =============================================================================
read -p "Would you like to start the development server now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}🚀 Starting development server...${NC}"
    npm run dev
else
    echo -e "${CYAN}💡 Run 'npm run dev' when ready to start development${NC}"
fi