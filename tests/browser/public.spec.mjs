import { test, expect } from '@playwright/test';

test('demonstração no celular permite consulta e bloqueia alterações', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('#workspace')).toBeVisible();
  await expect(page.locator('#save-status')).toHaveText('Demonstração em consulta');
  await expect(page.locator('#show-name')).toBeDisabled();
  await expect(page.locator('#new-show')).toBeDisabled();
  await expect(page.locator('#approve')).toBeDisabled();
  await expect(page.locator('#stage')).toBeEnabled();
  const response = await request.post('/api/shows', { data: { name: 'Não deve ser criado', limitSeconds: 1200, marginSeconds: 0, items: [] } });
  expect(response.status()).toBe(403);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.locator('#stage').click();
  await expect(page.locator('#stage-title')).toHaveText('Leans, Pt. 2');
  await page.locator('#stage-next-btn').click();
  await expect(page.locator('#stage-title')).toHaveText('Flashbacks');
});
