#!/bin/bash

# OpenClaw MGS Codec - Diagnostic Script
# Check system health and troubleshoot issues

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🦞 OpenClaw MGS Codec - DIAGNOSTICS                ║
║   FREQUENCY 187.89 MHz - SYSTEM CHECK                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo -e "${CYAN}📍 Running diagnostics from: ${PROJECT_DIR}${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Function to check service
check_service() {
    local name=$1
    local check_cmd=$2
    local expected=$3

    echo -ne "  ${CYAN}Checking $name...${NC} "

    if eval "$check_cmd" &>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# 1. Check Dependencies
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[1/6] Checking Dependencies...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check_service "Python 3" "command -v python3" || ((ERRORS++))
check_service "Node.js" "command -v node" || ((ERRORS++))
check_service "npm" "command -v npm" || ((ERRORS++))
check_service "MongoDB" "command -v mongod" || ((ERRORS++))
check_service "git" "command -v git" || ((WARNINGS++))

echo ""

# 2. Check Services Running
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[2/6] Checking Running Services...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if pgrep -x "mongod" > /dev/null; then
    echo -e "  ${GREEN}✓${NC} MongoDB is running"
else
    echo -e "  ${RED}✗${NC} MongoDB is NOT running"
    echo -e "    ${YELLOW}Try:${NC} sudo systemctl start mongod"
    ((ERRORS++))
fi

if pgrep -f "uvicorn.*server:app" > /dev/null; then
    echo -e "  ${GREEN}✓${NC} Backend (FastAPI) is running"
    BACKEND_RUNNING=true
else
    echo -e "  ${YELLOW}⚠${NC}  Backend is NOT running"
    echo -e "    ${YELLOW}Try:${NC} ./start.sh"
    ((WARNINGS++))
    BACKEND_RUNNING=false
fi

if pgrep -f "npm.*start\|react-scripts start" > /dev/null; then
    echo -e "  ${GREEN}✓${NC} Frontend (React) is running"
    FRONTEND_RUNNING=true
else
    echo -e "  ${YELLOW}⚠${NC}  Frontend is NOT running"
    echo -e "    ${YELLOW}Try:${NC} ./start.sh"
    ((WARNINGS++))
    FRONTEND_RUNNING=false
fi

echo ""

# 3. Check Ports
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[3/6] Checking Network Ports...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v lsof &> /dev/null; then
    if lsof -i :8001 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Port 8001 (Backend) is open"
    else
        echo -e "  ${YELLOW}⚠${NC}  Port 8001 (Backend) is not in use"
        ((WARNINGS++))
    fi

    if lsof -i :3000 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} Port 3000 (Frontend) is open"
    else
        echo -e "  ${YELLOW}⚠${NC}  Port 3000 (Frontend) is not in use"
        ((WARNINGS++))
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  lsof not available, skipping port check"
fi

echo ""

# 4. Check Backend Health
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[4/6] Checking Backend Health...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$BACKEND_RUNNING" = true ]; then
    HEALTH_CHECK=$(curl -s http://localhost:8001/api/health 2>/dev/null)

    if echo "$HEALTH_CHECK" | grep -q "operational"; then
        echo -e "  ${GREEN}✓${NC} Backend health check passed"
        echo -e "    ${CYAN}Response:${NC} $HEALTH_CHECK"
    else
        echo -e "  ${RED}✗${NC} Backend health check failed"
        echo -e "    ${CYAN}Response:${NC} $HEALTH_CHECK"
        ((ERRORS++))
    fi

    # Check MongoDB connection
    AGENTS=$(curl -s http://localhost:8001/api/agents 2>/dev/null)
    if [ -n "$AGENTS" ] && [ "$AGENTS" != "null" ]; then
        echo -e "  ${GREEN}✓${NC} MongoDB connection working"
        AGENT_COUNT=$(echo "$AGENTS" | grep -o '"id"' | wc -l)
        echo -e "    ${CYAN}Agents loaded:${NC} $AGENT_COUNT"
    else
        echo -e "  ${RED}✗${NC} MongoDB connection failed"
        ((ERRORS++))
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Backend not running, skipping health check"
fi

echo ""

# 5. Check File Structure
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[5/6] Checking File Structure...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

check_file() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file (missing)"
        ((ERRORS++))
    fi
}

check_file "backend/server.py"
check_file "backend/requirements.txt"
check_file "frontend/package.json"
check_file "frontend/src/App.js"
check_file "install.sh"
check_file "start.sh"
check_file "update.sh"

# Check virtual environment
if [ -d "backend/venv" ]; then
    echo -e "  ${GREEN}✓${NC} backend/venv (Python virtual environment)"
else
    echo -e "  ${YELLOW}⚠${NC}  backend/venv (missing - run ./install.sh)"
    ((WARNINGS++))
fi

# Check node_modules
if [ -d "frontend/node_modules" ]; then
    echo -e "  ${GREEN}✓${NC} frontend/node_modules"
else
    echo -e "  ${YELLOW}⚠${NC}  frontend/node_modules (missing - run ./install.sh)"
    ((WARNINGS++))
fi

echo ""

# 6. Test Token Configuration
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}[6/6] Checking Configuration...${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$BACKEND_RUNNING" = true ]; then
    CONFIG=$(curl -s http://localhost:8001/api/config 2>/dev/null)
    HAS_TOKEN=$(echo "$CONFIG" | grep -o '"has_token":[^,}]*' | cut -d':' -f2 | tr -d ' ')

    if [ "$HAS_TOKEN" = "true" ]; then
        echo -e "  ${GREEN}✓${NC} API token is configured"
    else
        echo -e "  ${YELLOW}⚠${NC}  No API token configured"
        echo -e "    ${CYAN}Configure via UI:${NC} Click 🔒 TOKEN button"
        ((WARNINGS++))
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Backend not running, cannot check config"
fi

echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}DIAGNOSTIC SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED!${NC}"
    echo -e "  ${CYAN}System is healthy and ready to use${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS WARNING(S)${NC}"
    echo -e "  ${CYAN}System is functional but has minor issues${NC}"
else
    echo -e "${RED}✗ $ERRORS ERROR(S), $WARNINGS WARNING(S)${NC}"
    echo -e "  ${CYAN}Please fix the errors above${NC}"
fi

echo ""

# Quick fixes
if [ $ERRORS -gt 0 ] || [ $WARNINGS -gt 0 ]; then
    echo -e "${CYAN}💡 Quick Fixes:${NC}"

    if ! pgrep -x "mongod" > /dev/null; then
        echo -e "  ${YELLOW}1.${NC} Start MongoDB:"
        echo -e "     ${GREEN}sudo systemctl start mongod${NC}"
    fi

    if [ "$BACKEND_RUNNING" = false ] || [ "$FRONTEND_RUNNING" = false ]; then
        echo -e "  ${YELLOW}2.${NC} Start all services:"
        echo -e "     ${GREEN}./start.sh${NC}"
    fi

    if [ ! -d "backend/venv" ] || [ ! -d "frontend/node_modules" ]; then
        echo -e "  ${YELLOW}3.${NC} Run full installation:"
        echo -e "     ${GREEN}./install.sh${NC}"
    fi

    echo ""
fi

echo -e "${CYAN}📋 Useful Commands:${NC}"
echo -e "  ${GREEN}./start.sh${NC}      - Start all services"
echo -e "  ${GREEN}./stop.sh${NC}       - Stop all services"
echo -e "  ${GREEN}./logs.sh${NC}       - View logs"
echo -e "  ${GREEN}./update.sh${NC}     - Update from GitHub"
echo -e "  ${GREEN}./diagnose.sh${NC}   - Run this diagnostic again"

echo ""
echo -e "${GREEN}FREQUENCY 187.89 MHz - DIAGNOSTIC COMPLETE${NC} 🦞"
echo ""

exit $ERRORS
