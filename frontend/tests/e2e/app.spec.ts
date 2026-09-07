import { expect, test } from '@playwright/test';

// Pre-existing before the Next.js migration, this test asserted on leftover boilerplate
// scaffold text ('Full-stack app scaffold', 'React + Vite') that never matched the real
// app — fixed here to check the actual landing page instead.
test('loads the application shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Shhh Library' })).toBeVisible();
  await expect(page.getByText('Community Reading Club & Library Platform')).toBeVisible();
});
