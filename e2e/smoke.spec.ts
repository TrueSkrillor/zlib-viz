import { test, expect } from '@playwright/test';

test('loads, picks a built-in example, renders viewer with three panes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'zlib-viz' })).toBeVisible();
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.timeline')).toBeVisible();
  await expect(page.locator('.three-pane .pane')).toHaveCount(3);
  await expect(page.locator('.depth-selector button.active')).toHaveText('L3');
});

test('depth selector gates disabled tabs correctly', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  await page.getByRole('button', { name: 'L1' }).click();
  await expect(page.locator('button:has-text("Bit layout")')).toBeDisabled();
  await expect(page.locator('button:has-text("Huffman trees")')).toBeDisabled();
  await page.getByRole('button', { name: 'L2' }).click();
  await expect(page.locator('button:has-text("Huffman trees")')).toBeEnabled();
  await expect(page.locator('button:has-text("Bit layout")')).toBeDisabled();
  await page.getByRole('button', { name: 'L3' }).click();
  await expect(page.locator('button:has-text("Bit layout")')).toBeEnabled();
});

test('clicking a byte in hex selects a structural node (tree shows an active row)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Dynamic Huffman/i }).click();
  const firstHex = page.locator('.hex-row .hx span').nth(5);
  await firstHex.click();
  await expect(page.locator('.tree-row.active')).toBeVisible();
});
