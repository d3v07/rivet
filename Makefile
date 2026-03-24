.PHONY: dev build test lint typecheck format clean install

# Default target
.DEFAULT_GOAL := help

help:
	@echo "Rivet - Multi-Agent DevSecOps Flow"
	@echo ""
	@echo "Available targets:"
	@echo "  make dev              - Start development server with watch mode"
	@echo "  make build            - Build TypeScript to dist/"
	@echo "  make typecheck        - Run TypeScript type checking"
	@echo "  make test             - Run all tests"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo "  make test-ui          - Run tests with UI"
	@echo "  make lint             - Run ESLint"
	@echo "  make lint-fix         - Run ESLint with --fix"
	@echo "  make format           - Format code with Prettier"
	@echo "  make format-check     - Check code formatting"
	@echo "  make mcp-server       - Run MCP server"
	@echo "  make install          - Install dependencies"
	@echo "  make clean            - Clean build artifacts"
	@echo ""

install:
	npm ci

dev:
	npm run dev

build: typecheck
	npm run build

typecheck:
	npm run typecheck

test:
	npm run test

test-coverage:
	npm run test:coverage

test-ui:
	npm run test:ui

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

mcp-server:
	npm run mcp:server

clean:
	npm run clean

# CI target - run all checks
ci: install typecheck lint test build
	@echo "✓ All checks passed"
