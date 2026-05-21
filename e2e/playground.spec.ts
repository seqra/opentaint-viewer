import { test, expect } from '@playwright/test';

test('explore a finding, jump cross-file, split, and share', async ({ page }) => {
  await page.goto('/');

  // Finding visible on first paint
  // Scoped to findings-tree because "SQL Injection" also appears in the scenario <option>
  await expect(page.getByTestId('findings-tree').getByText('SQL Injection')).toBeVisible();
  await expect(page.getByText('GET /users/search')).toBeVisible();

  // Code view shows the start file
  await expect(page.getByRole('tab', { name: /UserController.java/ })).toBeVisible();

  // Click the sink step -> active file switches to UserRepository.java
  await page.getByText(/stmt.execute/).click();
  await expect(page.getByRole('tab', { name: /UserRepository.java/ })).toHaveAttribute('aria-selected', 'true');

  // Toggle split -> both Code and Rules render
  await page.getByRole('button', { name: /split/i }).click();
  await expect(page.getByTestId('code-view')).toBeVisible();
  await expect(page.getByTestId('rules-view')).toBeVisible();

  // Share -> URL has a hash
  await page.getByRole('button', { name: /share/i }).click();
  const url = await page.getByTestId('share-url').inputValue();
  expect(url).toContain('#');

  // Reopen the shared URL -> split mode restored
  await page.goto(url);
  await expect(page.getByTestId('rules-view')).toBeVisible();
});
