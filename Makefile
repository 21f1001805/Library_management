.PHONY: install backend-install frontend-install e2e-install backend-dev frontend-dev db-generate db-migrate lint format test test-backend test-frontend test-e2e clean

install: backend-install frontend-install e2e-install

backend-install:
	cd backend && uv sync

frontend-install:
	bun --cwd frontend install

e2e-install:
	bun install

backend-dev:
	docker compose up -d --wait db
	cd backend && uv run uvicorn app.main:app --app-dir src --reload --host 127.0.0.1 --port 8000

frontend-dev:
	bun --cwd frontend run dev

db-generate:
	cd backend && uv run prisma generate --schema prisma/schema.prisma

db-migrate:
	cd backend && uv run prisma migrate dev --schema prisma/schema.prisma

lint:
	cd backend && uv run ruff check .
	bun --cwd frontend run lint

format:
	cd backend && uv run ruff format .
	bun --cwd frontend run format
	cd frontend && bunx prettier --write ../README.md ../package.json ../playwright.config.ts ../docker-compose.yml ../.prettierrc ../.prettierignore ../.editorconfig ../.gitignore ../.env.example

test: test-backend test-frontend

test-backend: db-generate
	cd backend && uv run pytest

test-frontend:
	bun --cwd frontend run test

test-e2e:
	bun run test:e2e

clean:
	rm -rf frontend/.next playwright-report test-results
