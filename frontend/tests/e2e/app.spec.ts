import { expect, test } from '@playwright/test';

test('loads the application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Full-stack app scaffold' })).toBeVisible();
  await expect(page.getByText('React + Vite')).toBeVisible();
  await expect(page.getByText('PostgreSQL + Prisma')).toBeVisible();
});
