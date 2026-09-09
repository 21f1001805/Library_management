.PHONY: install frontend-install e2e-install dev jobs db-generate db-migrate lint format test test-frontend test-e2e clean

install: frontend-install e2e-install

frontend-install:
	bun --cwd=frontend install

e2e-install:
	bun install

dev:
	docker compose up -d --wait db redis
	bun --cwd=frontend run dev

jobs:
	docker compose up -d --wait db redis
	bun --cwd=frontend run start:jobs

db-generate:
	bun --cwd=frontend run prisma:generate

db-migrate:
	cd frontend && bunx prisma migrate dev --schema prisma/schema.prisma

lint:
	bun --cwd=frontend run lint

format:
	bun --cwd=frontend run format
	cd frontend && bunx prettier --write ../README.md ../package.json ../playwright.config.ts ../docker-compose.yml ../.prettierrc ../.prettierignore ../.editorconfig ../.gitignore ../.env.example

test: test-frontend

test-frontend:
	bun --cwd=frontend run test

test-e2e:
	bun run test:e2e

clean:
	rm -rf frontend/.next playwright-report test-results
