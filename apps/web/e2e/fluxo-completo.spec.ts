import { test, expect } from '@playwright/test';

test.describe('Fluxo completo: login → caso → conferência → cenário → documento', () => {
  test.beforeEach(async ({ page }) => {
    // Login com admin seed
    await page.goto('/login');
    await page.fill('input[name="email"]', 'laura@metodoadvdigital.com.br');
    await page.fill('input[name="senha"]', 'mudar@123');
    await page.click('button[type="submit"]');

    // Se cair na troca de senha, trocar
    if (page.url().includes('trocar-senha')) {
      await page.fill('input[name="nova"]', 'teste@2026');
      await page.fill('input[name="confirma"]', 'teste@2026');
      await page.click('button[type="submit"]');
    }

    // Deve estar na home
    await expect(page).toHaveURL('/');
  });

  test('cria caso e navega pelas abas', async ({ page }) => {
    // Criar caso
    await page.click('a:has-text("Novo caso")');
    await expect(page).toHaveURL('/casos/novo');

    await page.fill('input[name="clienteNome"]', 'DULCIMARA RODRIGUES DOS SANTOS');
    await page.selectOption('select[name="sexo"]', 'F');
    await page.fill('input[name="nascimento"]', '15/02/1971');
    await page.click('button:has-text("Criar caso")');

    // Deve redirecionar para a página do caso
    await expect(page.locator('.page-titulo')).toContainText('DULCIMARA');

    // Verificar abas existem
    await expect(page.locator('.tabs')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Dados")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("CNIS")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Auditoria")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Cenários")')).toBeVisible();
    await expect(page.locator('button.tab:has-text("Documentos")')).toBeVisible();

    // Aba dados mostra info correta
    await expect(page.locator('text=DULCIMARA RODRIGUES DOS SANTOS')).toBeVisible();
    await expect(page.locator('text=Feminino')).toBeVisible();
    await expect(page.locator('text=15/02/1971')).toBeVisible();
  });

  test('inserção manual de dados e conferência', async ({ page }) => {
    // Criar caso
    await page.click('a:has-text("Novo caso")');
    await page.fill('input[name="clienteNome"]', 'TESTE E2E');
    await page.selectOption('select[name="sexo"]', 'M');
    await page.fill('input[name="nascimento"]', '01/01/1965');
    await page.click('button:has-text("Criar caso")');

    await expect(page.locator('.page-titulo')).toContainText('TESTE E2E');

    // Ir para aba CNIS
    await page.click('button.tab:has-text("CNIS")');

    // Escolher entrada manual
    await page.click('button:has-text("Entrada manual")');

    // Preencher períodos
    await page.fill('textarea >> nth=0',
      '01/03/1985 31/05/1995 Empresa A\n01/08/1995 31/12/2010 Empresa B\n01/01/2011 11/06/2026 Contrib. Individual'
    );

    // Preencher salários
    await page.fill('textarea >> nth=1', '07/1994 2.500,00\n08/1994 2.600,00');

    // Prosseguir para conferência
    await page.click('button:has-text("Prosseguir para conferência")');

    // Deve mostrar tabela de vínculos
    await expect(page.locator('text=Vínculos / Períodos (3)')).toBeVisible();

    // Confirmar dados
    await page.click('button:has-text("Confirmar dados")');
    await expect(page.locator('.msg-sucesso')).toBeVisible({ timeout: 10_000 });

    // Ir para aba Auditoria
    await page.click('button.tab:has-text("Auditoria")');
    await expect(page.locator('text=TC em 12/11/2019')).toBeVisible();
    await expect(page.locator('text=Enquadramento nas regras')).toBeVisible();

    // Ir para aba Cenários
    await page.click('button.tab:has-text("Cenários")');
    await page.click('button:has-text("Gerar grade padrão")');

    // Deve gerar cards de cenário
    await expect(page.locator('text=Art. 18 (Idade)')).toBeVisible({ timeout: 10_000 });

    // Ir para aba Documentos
    await page.click('button.tab:has-text("Documentos")');
    await expect(page.locator('text=Doc. 1.0')).toBeVisible();
  });

  test('caso aparece na lista após criação', async ({ page }) => {
    // Criar caso
    await page.click('a:has-text("Novo caso")');
    await page.fill('input[name="clienteNome"]', 'CASO LISTA TEST');
    await page.selectOption('select[name="sexo"]', 'M');
    await page.fill('input[name="nascimento"]', '10/10/1970');
    await page.click('button:has-text("Criar caso")');

    // Voltar para home
    await page.click('a:has-text("Casos")');
    await expect(page).toHaveURL('/');

    // Verificar que o caso aparece
    await expect(page.locator('text=CASO LISTA TEST')).toBeVisible();
  });
});
