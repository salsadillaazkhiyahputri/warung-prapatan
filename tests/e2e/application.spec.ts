import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('pemilik');
  await page.getByLabel('Password').fill('warung123');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('API terlindungi sebelum sesi dibuat', async ({ page }) => {
  await page.goto('/login');
  const response = await page.context().request.get(new URL('/api/products', page.url()).toString());

  expect(response.status()).toBe(401);
});

test('login menolak password yang salah', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('pemilik');
  await page.getByLabel('Password').fill('password-salah');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();

  await expect(page.getByText('Username atau password salah')).toBeVisible();
});

test('pemilik membuat produk, supplier, mencatat stok, lalu melihat stok dan riwayat', async ({ page }) => {
  await signIn(page);

  const api = page.context().request;
  const endpoint = (path: string) => new URL(path, page.url()).toString();
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const productName = `E2E Produk ${suffix}`;
  const supplierName = `E2E Supplier ${suffix}`;

  await page.goto('/produk');
  await page.getByRole('button', { name: 'Tambah produk' }).click();
  await page.getByPlaceholder('Contoh: Indomie Goreng').fill(productName);
  await page.locator('select.form-select').last().selectOption({ index: 1 });
  await page.locator('input[type="number"]').nth(0).fill('3');
  await page.locator('input[type="number"]').nth(1).fill('1');
  const productRequest = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/products'
  );
  await page.getByRole('button', { name: 'Simpan Produk' }).click();
  const productResponse = await productRequest;
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  await page.goto('/supplier');
  await page.getByRole('button', { name: 'Tambah supplier' }).click();
  await page.getByPlaceholder('Contoh: PT Unilever Indonesia').fill(supplierName);
  await page.locator('select.form-select').last().selectOption('utama');
  const supplierRequest = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/suppliers'
  );
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  const supplierResponse = await supplierRequest;
  expect(supplierResponse.status()).toBe(201);
  const supplier = await supplierResponse.json();
  await expect(page.getByText(supplierName, { exact: true })).toBeVisible();

  const incomingResponse = await api.post(endpoint('/api/transactions'), {
    data: {
      type: 'in', product_id: product.id, supplier_id: supplier.id, qty: 2,
      note: 'E2E restock', idempotency_key: crypto.randomUUID()
    }
  });
  expect(incomingResponse.status()).toBe(201);
  expect(await incomingResponse.json()).toMatchObject({ success: true, stock_after: 5 });

  const outgoingResponse = await api.post(endpoint('/api/transactions'), {
    data: {
      type: 'out', product_id: product.id, qty: 1,
      note: 'E2E sample sale', idempotency_key: crypto.randomUUID()
    }
  });
  expect(outgoingResponse.status()).toBe(201);
  expect(await outgoingResponse.json()).toMatchObject({ success: true, stock_after: 4 });

  const productsResponse = await api.get(endpoint('/api/products'));
  expect(productsResponse.ok()).toBeTruthy();
  const products = await productsResponse.json();
  expect(products).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: product.id, name: productName, stock_current: 4 })
  ]));

  const historyResponse = await api.get(endpoint(`/api/transactions?productId=${product.id}`));
  expect(historyResponse.ok()).toBeTruthy();
  const history = await historyResponse.json();
  expect(history).toHaveLength(2);
  expect(history.map((row: { type: string }) => row.type).sort()).toEqual(['in', 'out']);

  await page.goto('/riwayat');
  await expect(page.getByText('E2E restock')).toBeVisible();
  await expect(page.getByText('E2E sample sale')).toBeVisible();
});
