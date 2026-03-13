.PHONY: help dev start stop build test lint format clean status typecheck governance governance-stop

# Default target
help:
	@echo "Agent UI Kit - Available Commands"
	@echo "=================================="
	@echo "make dev              - Start development server (demo app)"
	@echo "make build            - Build all packages (core, ui, demo)"
	@echo "make test             - Run all tests"
	@echo "make typecheck        - Run TypeScript type checking"
	@echo "make lint             - Run ESLint checks"
	@echo "make lint-fix         - Fix ESLint issues"
	@echo "make format           - Format code with Prettier"
	@echo "make format-check     - Check code formatting"
	@echo "make clean            - Clean all build artifacts"
	@echo "make install          - Install dependencies"
	@echo "make dev-port         - Start dev server on custom port (PORT=5175)"
	@echo "make stop             - Stop all running development servers"
	@echo "make status           - Show running dev servers"
	@echo "make governance       - Start governance server (port 3005, Phase 5)"
	@echo "make governance-stop  - Stop governance server"

# Start development server
dev:
	@echo "Starting development server..."
	pnpm dev

# Start dev server on custom port (use: make dev-port PORT=5175)
dev-port:
	@if [ -z "$(PORT)" ]; then \
		echo "Usage: make dev-port PORT=5175"; \
		exit 1; \
	fi
	@echo "Starting development server on port $(PORT)..."
	VITE_PORT=$(PORT) pnpm dev

# Build all packages
build:
	@echo "Building all packages..."
	pnpm build
	@echo "✓ Build complete"

# Run tests
test:
	@echo "Running tests..."
	pnpm test

# Run TypeScript type checking
typecheck:
	@echo "Type checking..."
	pnpm typecheck

# Lint code
lint:
	@echo "Linting code..."
	pnpm lint

# Fix lint issues
lint-fix:
	@echo "Fixing lint issues..."
	pnpm lint:fix

# Format code
format:
	@echo "Formatting code..."
	pnpm format

# Check formatting
format-check:
	@echo "Checking code formatting..."
	pnpm format:check

# Install dependencies
install:
	@echo "Installing dependencies..."
	pnpm install
	@echo "✓ Installation complete"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	pnpm clean
	@echo "✓ Clean complete"

# Check status of running servers
status:
	@echo "Checking running dev servers..."
	@if lsof -ti :5173,:5174,:5175 2>/dev/null | xargs ps -o pid,comm= 2>/dev/null; then \
		echo ""; \
		echo "Summary:"; \
		lsof -ti :5173,:5174,:5175 2>/dev/null && echo "✓ Servers running"; \
	else \
		echo "No dev servers currently running"; \
	fi

# Stop all running development servers
stop:
	@echo "Stopping all development servers..."
	@PIDS=$$(lsof -ti :5173,:5174,:5175 2>/dev/null); \
	if [ -n "$$PIDS" ]; then \
		echo "Stopping processes: $$PIDS"; \
		kill $$PIDS 2>/dev/null || true; \
		echo "✓ Servers stopped"; \
	else \
		echo "No running dev servers to stop"; \
	fi

# Full setup (install + build)
setup: install build
	@echo "✓ Setup complete"

# Development workflow (clean + install + dev)
fresh: clean install dev
	@echo "✓ Fresh start complete"

# Phase 5: Start governance server (REST API + WebSocket collaboration hub)
governance:
	@echo "Starting HARI Governance Server on port 3005..."
	@echo "  REST API  →  http://localhost:3005"
	@echo "  Collab WS →  ws://localhost:3005/collaborate"
	GOVERNANCE_PORT=3005 pnpm --filter @hari/dev-services dev:governance

# Stop governance server
governance-stop:
	@echo "Stopping governance server..."
	@PIDS=$$(lsof -ti :3005 2>/dev/null); \
	if [ -n "$$PIDS" ]; then \
		kill $$PIDS 2>/dev/null || true; \
		echo "✓ Governance server stopped"; \
	else \
		echo "No governance server running on port 3005"; \
	fi
