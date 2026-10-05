import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const tracks = await (await request.get('/api/tracks')).json();
  const order = ['leans-pt2', 'flashbacks', 'amiri', 'safety', 'viciar', 'fim'];
  const plan = {
    name: 'Festival fictício · QA', limitSeconds: 1200, marginSeconds: 120,
    items: order.map((id, index) => {
      const t = tracks.find(t => t.id === id);
      return { entryId: `qa-${index}`, trackId: t.id, title: t.title, album: t.album, studioSeconds: t.studioSeconds,
        liveSeconds: null, introSeconds: 0, pauseSeconds: index < 5 ? 20 : 0, energy: '', cue: '' };
    })
  };
  const response = await request.post('/api/shows', { data: plan });
  expect(response.status()).toBe(201);
  await page.goto('/');
  await expect(page.locator('#show-name')).toHaveValue(plan.name);
});

test('limite de tempo bloqueia aprovação; ajuste libera o palco', async ({ page }) => {
  await expect(page.locator('#total')).toHaveText('18:58');
  await expect(page.locator('#remaining')).toContainText('00:58 acima');
  await expect(page.locator('#approve')).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Tempo do show em minutos', exact: true }).fill('30');
  await page.locator('#approve').click();
  await expect(page.locator('#approved-status')).toHaveText('R02 aprovado');
  await page.locator('#stage').click();
  await expect(page.locator('#stage-title')).toHaveText('Leans, Pt. 2');
  await page.locator('#stage-next-btn').click();
  await expect(page.locator('#stage-title')).toHaveText('Flashbacks');
});

test('novo rascunho mantém o snapshot usado no palco', async ({ page }) => {
  await page.locator('#limit').fill('30');
  await page.locator('#approve').click();
  await expect(page.locator('#approved-status')).toHaveText('R02 aprovado');
  const row = page.locator('#set-items li').filter({ hasText: 'Leans, Pt. 2' });
  await row.locator('summary').click();
  await row.getByRole('textbox', { name: 'Duração ao vivo de Leans, Pt. 2', exact: true }).fill('02:30');
  await row.getByRole('spinbutton', { name: 'Intro de Leans, Pt. 2', exact: true }).fill('10');
  await row.getByRole('textbox', { name: 'Sinais de palco de Leans, Pt. 2', exact: true }).fill('DEMONSTRAÇÃO: aguardar sinal de entrada.');
  await expect(page.locator('#total')).toHaveText('18:46');
  await page.locator('#save').click();
  await expect(page.locator('#revision-label')).toHaveText('R03');
  await expect(page.locator('#approved-status')).toHaveText('R02 aprovado');
  await page.locator('#stage').click();
  await expect(page.locator('#stage-duration')).toHaveText('02:52 · estimativa');
  await page.locator('#close-stage').click();
  await page.locator('#approve').click();
  await expect(page.locator('#approved-status')).toHaveText('R03 aprovado');
  await page.locator('#stage').click();
  await expect(page.locator('#stage-duration')).toHaveText('02:30');
  await expect(page.locator('#stage-cue')).toContainText('DEMONSTRAÇÃO');
});

test('conflito entre duas sessões preserva a edição local', async ({ page, context }) => {
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('#show-name')).toHaveValue('Festival fictício · QA');
  await page.locator('#show-name').fill('Primeira edição fictícia');
  await page.locator('#save').click();
  await expect(page.locator('#revision-label')).toHaveText('R02');
  await second.locator('#show-name').fill('Segunda edição local');
  await second.locator('#save').click();
  await expect(second.locator('#notice')).toContainText('Outra alteração foi salva');
  await expect(second.locator('#show-name')).toHaveValue('Segunda edição local');
  await expect(second.locator('#save-status')).toHaveText('Alterações não salvas');
});

test('adição, remoção e reordenação preservam o cálculo', async ({ page }) => {
  await page.getByRole('button', { name: 'Adicionar Viciar ao repertório', exact: true }).click();
  await expect(page.locator('#total')).toHaveText('22:13');
  await page.locator('#set-items li').last().getByRole('button', { name: 'Remover Viciar', exact: true }).click();
  await expect(page.locator('#total')).toHaveText('18:58');
  await page.getByRole('button', { name: 'Mover Leans, Pt. 2 para baixo', exact: true }).click();
  await expect(page.locator('#set-items li').first()).toContainText('Flashbacks');
  await page.getByRole('button', { name: 'Mover Leans, Pt. 2 para cima', exact: true }).click();
  await expect(page.locator('#set-items li').first()).toContainText('Leans, Pt. 2');
  await expect(page.locator('#total')).toHaveText('18:58');
});

test('exportação contém a revisão aprovada e gera PDF', async ({ page }, testInfo) => {
  await page.addInitScript(() => { window.print = () => {}; });
  await page.reload();
  await expect(page.locator('#show-name')).toHaveValue('Festival fictício · QA');
  await page.locator('#limit').fill('30');
  await page.locator('#approve').click();
  await expect(page.locator('#approved-status')).toHaveText('R02 aprovado');
  await page.locator('#show-name').fill('Rascunho ainda não aprovado');
  await page.locator('#save').click();
  await expect(page.locator('#revision-label')).toHaveText('R03');
  await page.locator('#export').click();
  await expect(page.locator('#print-view h1')).toHaveText('Festival fictício · QA');
  await expect(page.locator('#print-view tbody tr')).toHaveCount(6);
  await expect(page.locator('#print-view p')).toContainText('revisão 2');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#print-view h1')).toBeVisible();
  const pdf = await page.pdf({ path: testInfo.outputPath('roteiro.pdf'), format: 'A4', printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});
