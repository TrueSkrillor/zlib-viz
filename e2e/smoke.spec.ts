import { test, expect } from '@playwright/test';

test('loads, picks a built-in example, renders viewer with three panes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'zlib-viz' })).toBeVisible();
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.timeline')).toBeVisible();
  await expect(page.locator('.three-pane .pane')).toHaveCount(3);
});

test('all Structure tabs are enabled and switchable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  for (const name of ['Bit layout', 'Huffman trees', 'Code-len alphabet', 'Tree']) {
    const btn = page.locator('.three-pane .pane:nth-child(2) .tabs button', { hasText: new RegExp(`^${name}$`) });
    await expect(btn).toBeEnabled();
    await btn.click();
  }
});

test('clicking a byte in hex selects a structural node (tree shows an active row)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  const firstHex = page.locator('.hex-row .hx span').nth(5);
  await firstHex.click();
  await expect(page.locator('.tree-row.active')).toBeVisible();
});
