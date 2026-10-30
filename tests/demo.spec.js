// Testes de regressão na demonstração (docs/index.html): o comportamento que já existia
// continua funcionando com mouse, toque e teclado
const { test, expect, DEMO_URL, collectErrors, drag, edgeOf, nextFrames } = require('./helpers');

collectErrors();

// Atalhos para as partes da demo
const col = (page, status) => page.locator(`.column[data-status="${status}"]`);
const card = (page, title) => page.locator('.jt-draggable:not(.jt-clone)', { has: page.locator('.card-title', { hasText: title }) });
const titles = (page, status) => col(page, status).locator('> .jt-draggable .card-title').allTextContents();
const counts = (page) => page.locator('.kanban .count').allTextContents();

test.beforeEach(async ({ page }) => {
    await page.goto(DEMO_URL);
});

test('carrega sem erros, com contadores e cards focáveis', async ({ page }) => {
    expect(await counts(page)).toEqual(['6', '2', '1']);
    const first = card(page, 'Criar tela de login');
    await expect(first).toHaveAttribute('tabindex', '0');
    await expect(first).toHaveAttribute('aria-describedby', /jt-instructions-/);
});

test('arrasta um card para outra coluna', async ({ page }) => {
    const events = [];
    await page.exposeFunction('record', e => events.push(e));
    await page.evaluate(() => {
        for (const name of ['jt-drag-start', 'jt-drop', 'jt-drag-end']) {
            document.addEventListener(name, e => window.record({ name, from: e.detail.from?.dataset.status, to: e.detail.to?.dataset.status, oldIndex: e.detail.oldIndex, newIndex: e.detail.newIndex }));
        }
    });

    await drag(page, card(page, 'Criar tela de login'), () => edgeOf(card(page, 'Modo escuro'), 'after'));

    expect(await titles(page, 'doing')).toEqual(['Arrastar e soltar', 'Modo escuro', 'Criar tela de login']);
    expect(await counts(page)).toEqual(['5', '3', '1']);
    await expect(page.locator('#log-list li')).toHaveCount(1);
    expect(events.map(e => e.name)).toEqual(['jt-drag-start', 'jt-drop', 'jt-drag-end']);
    expect(events[1]).toMatchObject({ from: 'todo', to: 'doing', oldIndex: 0, newIndex: 2 });

    // Nada sobra do arrasto: sem clone, sem estilo inline, sem classes
    await expect(page.locator('.jt-clone')).toHaveCount(0);
    await expect(card(page, 'Criar tela de login')).not.toHaveAttribute('style', /.+/);
    await expect(page.locator('body')).not.toHaveClass(/jt-dragging-active/);
});

test('reordena dentro da mesma coluna', async ({ page }) => {
    await drag(page, card(page, 'Escrever testes'), () => edgeOf(card(page, 'Criar tela de login'), 'before'));
    expect((await titles(page, 'todo')).slice(0, 3)).toEqual(['Escrever testes', 'Criar tela de login', 'Configurar banco de dados']);
});

test('soltar fora de qualquer dropzone devolve o card', async ({ page }) => {
    const before = await titles(page, 'todo');
    await drag(page, card(page, 'Criar tela de login'), { x: 640, y: 10 });
    expect(await titles(page, 'todo')).toEqual(before);
    await expect(page.locator('#log-list li')).toHaveCount(0);
});

test('accepts recusa, data-jt-drop (actions) risca e onDrop desmarca', async ({ page }) => {
    // "Feito" só aceita cards vindos de "Fazendo"
    await drag(page, card(page, 'Criar tela de login'), col(page, 'done'), {
        beforeUp: async () => {
            await nextFrames(page);
            await expect(col(page, 'done')).toHaveClass(/jt-dropzone-refused/);
        },
    });
    expect(await titles(page, 'done')).toEqual(['Publicar a demo']);

    // De "Fazendo" para "Feito": aceita e a action marcarComoFeito risca a tarefa
    await drag(page, card(page, 'Modo escuro'), () => edgeOf(card(page, 'Publicar a demo'), 'after'));
    expect(await titles(page, 'done')).toEqual(['Publicar a demo', 'Modo escuro']);
    await expect(card(page, 'Modo escuro')).toHaveClass(/is-done/);

    // Saindo de "Feito", o onDrop tira a marcação
    await drag(page, card(page, 'Modo escuro'), () => edgeOf(card(page, 'Arrastar e soltar'), 'after'));
    await expect(card(page, 'Modo escuro')).not.toHaveClass(/is-done/);
});

test('clique simples não arrasta nem muda nada', async ({ page }) => {
    const target = card(page, 'Criar tela de login');
    await target.click();
    await expect(target).not.toHaveAttribute('style', /.+/);
    await expect(page.locator('.jt-clone')).toHaveCount(0);
    await expect(page.locator('#log-list li')).toHaveCount(0);
});

test('Esc cancela o arrasto com o mouse', async ({ page }) => {
    const before = await titles(page, 'todo');
    await drag(page, card(page, 'Criar tela de login'), col(page, 'doing'), {
        beforeUp: () => page.keyboard.press('Escape'),
    });
    expect(await titles(page, 'todo')).toEqual(before);
    expect(await titles(page, 'doing')).toEqual(['Arrastar e soltar', 'Modo escuro']);
});

test('teclado: pega, move, muda de coluna e solta; Esc devolve', async ({ page }) => {
    const live = page.locator('[aria-live="assertive"]');
    await card(page, 'Criar tela de login').focus();
    await page.keyboard.press('Space');
    await expect(card(page, 'Criar tela de login')).toHaveClass(/jt-dragging/);
    await expect(live).toHaveText('Pego. Posição 1 de 6.');

    await page.keyboard.press('ArrowDown');
    await expect(live).toHaveText('Posição 2 de 6.');
    await page.keyboard.press('ArrowRight');
    await expect(live).toHaveText('Mudou de lista. Posição 2 de 3.');
    await page.keyboard.press('Space');
    await expect(live).toHaveText('Solto. Posição 2 de 3.');
    expect(await titles(page, 'doing')).toEqual(['Arrastar e soltar', 'Criar tela de login', 'Modo escuro']);
    await expect(card(page, 'Criar tela de login')).toBeFocused();

    // Esc devolve ao lugar de origem
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(live).toHaveText('Cancelado. O card voltou para o lugar original.');
    expect(await titles(page, 'doing')).toEqual(['Arrastar e soltar', 'Criar tela de login', 'Modo escuro']);
});

test('alça: o texto não arrasta, a alça e o título-alça arrastam', async ({ page }) => {
    const note = card(page, 'Selecione este texto');
    await page.locator('.two-lists').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await drag(page, note.locator('.card-text'), page.locator('.column[data-name="list.b"]'));
    expect(await page.locator('.column[data-name="list.a"] > .jt-draggable').count()).toBe(2);

    await drag(page, note.locator('.jt-handle'), () => edgeOf(card(page, 'Duas alças'), 'after'));
    await expect(page.locator('.column[data-name="list.b"] > .jt-draggable').last()).toContainText('Selecione este texto');

    await drag(page, card(page, 'Arraste pelo título').locator('.title-handle'), page.locator('.column[data-name="list.a"]'));
    await expect(page.locator('.column[data-name="list.a"]')).toContainText('Arraste pelo título');
});

test('grade: reordena e o grupo recusa cards de fora', async ({ page }) => {
    const tiles = () => page.locator('.tile-grid > .tile').allTextContents();
    const tile = n => page.locator('.tile', { hasText: new RegExp(`^${n}$`) });

    await tile(1).scrollIntoViewIfNeeded();
    const box3 = await tile(3).boundingBox();
    await drag(page, tile(1), { x: box3.x + box3.width - 4, y: box3.y + box3.height / 2 });
    expect(await tiles()).toEqual(['2', '3', '1', '4', '5', '6', '7', '8']);

    // Um card do quadro não entra na grade (grupo "tiles").
    // Janela alta, para o quadro e a grade aparecerem juntos na tela
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await drag(page, card(page, 'Criar tela de login'), page.locator('.tile-grid'), {
        beforeUp: async () => {
            await nextFrames(page);
            await expect(page.locator('.tile-grid')).toHaveClass(/jt-dropzone-refused/);
        },
    });
    expect(await page.locator('.tile-grid > *').count()).toBe(8);
    expect(await titles(page, 'todo')).toContain('Criar tela de login');
});

test('dropzone aninhada: cai na mais interna', async ({ page }) => {
    const outer = card(page, 'Estou na externa');
    await outer.scrollIntoViewIfNeeded();
    await drag(page, outer, () => edgeOf(card(page, 'Estou na interna'), 'after'));
    await expect(page.locator('.nested-inner > .jt-draggable')).toHaveCount(2);
});

test('card criado depois do carregamento arrasta e é focável', async ({ page }) => {
    await page.locator('#add-card').click();
    const created = card(page, 'Nova tarefa 1');
    await expect(created).toHaveAttribute('tabindex', '0');
    expect(await counts(page)).toEqual(['7', '2', '1']);

    await created.scrollIntoViewIfNeeded();
    await drag(page, created, col(page, 'doing'));
    expect(await titles(page, 'doing')).toContain('Nova tarefa 1');
});

test('troca de idioma muda também as mensagens dos leitores de tela', async ({ page }) => {
    await page.locator('[data-lang="en"]').click();
    await card(page, 'Build login screen').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('[aria-live="assertive"]')).toHaveText('Picked up. Position 1 of 6.');
    await page.keyboard.press('Escape');
});

test.describe('toque', () => {
    // Os toques são disparados pelo protocolo do Chrome (CDP), que só existe no Chromium
    test.skip(({ browserName }) => browserName !== 'chromium', 'toque simulado só no Chromium');
    test.use({ hasTouch: true });

    /** Dispara toques pelo protocolo do Chrome (gera Pointer Events de toque de verdade) */
    async function touch(page) {
        const cdp = await page.context().newCDPSession(page);
        return (type, points) => cdp.send('Input.dispatchTouchEvent', {
            type, touchPoints: points.map(([x, y, id]) => ({ x, y, id })),
        });
    }

    test('toque longo pega um card sem alça; deslizar rápido não pega', async ({ page }) => {
        const send = await touch(page);
        const box = await card(page, 'Criar tela de login').boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const target = await edgeOf(card(page, 'Modo escuro'), 'after');

        // Deslizar antes do tempo do toque longo: não é arrasto
        await send('touchStart', [[x, y, 1]]);
        await send('touchMove', [[x, y + 30, 1]]);
        await send('touchEnd', []);
        await expect(page.locator('.jt-dragging')).toHaveCount(0);

        // Segurar parado e depois arrastar
        await send('touchStart', [[x, y, 1]]);
        await page.waitForTimeout(550);
        await expect(card(page, 'Criar tela de login')).toHaveClass(/jt-dragging/);
        for (let i = 1; i <= 10; i++) {
            await send('touchMove', [[x + (target.x - x) * i / 10, y + (target.y - y) * i / 10, 1]]);
        }
        // Ajusta o dedo depois que o clone se acomodou (ele empurra os cards da coluna)
        for (let i = 0; i < 3; i++) {
            await nextFrames(page);
            const p = await edgeOf(card(page, 'Modo escuro'), 'after');
            await send('touchMove', [[p.x, p.y, 1]]);
        }
        await send('touchEnd', []);
        expect(await titles(page, 'doing')).toEqual(['Arrastar e soltar', 'Modo escuro', 'Criar tela de login']);
    });

    test('um segundo dedo não solta nem move o card', async ({ page }) => {
        const send = await touch(page);
        const handle = card(page, 'Selecione este texto').locator('.jt-handle');
        await handle.scrollIntoViewIfNeeded();
        const h = await handle.boundingBox();
        const x = h.x + h.width / 2, y = h.y + h.height / 2;
        const listB = await page.locator('.column[data-name="list.b"]').boundingBox();
        const tx = listB.x + listB.width / 2, ty = listB.y + listB.height - 10;

        await send('touchStart', [[x, y, 1]]);
        await send('touchMove', [[x + 20, y, 1]]); // Pela alça, o arrasto começa na hora
        await expect(card(page, 'Selecione este texto')).toHaveClass(/jt-dragging/);

        // Segundo dedo encosta, mexe e sai em outro lugar
        await send('touchStart', [[x + 20, y, 1], [100, 100, 2]]);
        await send('touchMove', [[x + 20, y, 1], [150, 150, 2]]);
        // No protocolo do Chrome, os dedos que somem da lista são os que saíram da tela
        // (o touchEnd tira todos): este touchMove tira só o segundo dedo
        await send('touchMove', [[x + 20, y, 1]]);
        await expect(card(page, 'Selecione este texto')).toHaveClass(/jt-dragging/);

        // O primeiro dedo continua mandando
        await send('touchMove', [[tx, ty, 1]]);
        await send('touchEnd', []);
        await expect(page.locator('.column[data-name="list.b"] > .jt-draggable').last()).toContainText('Selecione este texto');
    });
});
