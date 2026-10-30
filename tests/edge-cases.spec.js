// Casos extremos: um teste para cada problema corrigido na revisão da v1.1.0.
// Rodados contra a v1.0.0 (JETDND_LIB=...), estes testes falham; na v1.1.0, passam
const { test, expect, collectErrors, fixture, center, drag, nextFrames } = require('./helpers');

const errorState = collectErrors();

const TWO_ZONES = `
    <div class="zone jt-dropzone" id="z1">
        <div class="card jt-draggable" id="c1">1</div>
        <div class="card jt-draggable" id="c2">2</div>
        <div class="card jt-draggable" id="c3">3</div>
    </div>
    <div class="zone jt-dropzone" id="z2"></div>`;

test('um segundo ponteiro não move nem solta o card (multi-pointer)', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => JetDnD.init());

    const result = await page.evaluate(() => {
        const card = document.querySelector('#c1');
        const r = card.getBoundingClientRect();
        const x = r.left + 10, y = r.top + 10;
        const fire = (type, pointerId, px, py) => card.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId, isPrimary: pointerId === 1,
            pointerType: pointerId === 1 ? 'mouse' : 'pen', button: 0, buttons: 1, clientX: px, clientY: py,
        }));
        fire('pointerdown', 1, x, y);
        fire('pointermove', 1, x + 20, y);           // Começa o arrasto
        const translate = card.style.translate;
        fire('pointermove', 2, x + 300, y + 300);    // Outro ponteiro se mexe...
        fire('pointerup', 2, x + 300, y + 300);      // ...e é solto
        const out = { dragging: card.classList.contains('jt-dragging'), same: card.style.translate === translate };
        fire('pointerup', 1, x + 20, y);             // O dono solta
        out.after = card.classList.contains('jt-dragging');
        return out;
    });
    expect(result).toEqual({ dragging: true, same: true, after: false });
});

test('card removido durante o arrasto pelo teclado não trava a lib', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => {
        window.ends = 0;
        document.addEventListener('jt-drag-end', () => window.ends++);
        JetDnD.init();
    });

    await page.locator('#c1').focus();
    await page.keyboard.press('Space');
    await page.evaluate(() => document.querySelector('#c1').remove());
    await page.keyboard.press('ArrowDown');

    // Outro card pode ser pego normalmente, e o fim do arrasto anterior foi avisado
    await page.locator('#c2').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#c2')).toHaveClass(/jt-dragging/);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => window.ends)).toBe(2);
    await expect(page.locator('#c1')).toHaveCount(0); // A lib não trouxe de volta o card removido
});

test('Esc pelo teclado volta à posição original mesmo se o vizinho foi removido', async ({ page }) => {
    // Sem espaços entre as tags (como os frameworks costumam gerar): o nó logo depois do c1 é o c2
    await fixture(page, TWO_ZONES.replace(/>\s+</g, '><'));
    await page.evaluate(() => JetDnD.init());
    await page.locator('#c1').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.evaluate(() => document.querySelector('#c2').remove()); // Era o nó logo depois do c1
    await page.keyboard.press('Escape');
    expect(await page.locator('#z1 > .card').evaluateAll(els => els.map(e => e.id))).toEqual(['c1', 'c3']);
});

test('init com seletor inválido falha sem deixar nada na página', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    const result = await page.evaluate(() => {
        const styles = document.querySelectorAll('style').length;
        const tryInit = (opts) => { try { JetDnD.init(opts); return 'ok'; } catch (e) { return e.name; } };
        return {
            invalid: tryInit({ draggable: '[[' }),
            injection: tryInit({ draggable: '.x', handle: '.h} body{display:none' }),
            notString: tryInit({ dropzone: 42 }),
            styles: document.querySelectorAll('style').length - styles,
        };
    });
    expect(result).toEqual({ invalid: 'SyntaxError', injection: 'SyntaxError', notString: 'TypeError', styles: 0 });

    // Nenhum listener órfão: apertar um card não dá erro
    await page.locator('#c1').click();
});

test('init(null) e números inválidos usam o padrão; opções congeladas', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    const result = await page.evaluate(() => {
        const a = JetDnD.init(null);
        a.destroy();
        const b = JetDnD.init({ scrollSpeed: -1, dragThreshold: NaN });
        b.setMessages({ moved: 'x' }); // As mensagens continuam trocáveis
        return {
            speed: b.options.scrollSpeed, threshold: b.options.dragThreshold,
            frozen: Object.isFrozen(b.options), moved: b.options.messages.moved,
        };
    });
    expect(result).toEqual({ speed: 15, threshold: 4, frozen: true, moved: 'x' });
});

test('segurar o Espaço não solta e pega o card em sequência', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => JetDnD.init());
    await page.locator('#c1').focus();
    await page.keyboard.down('Space'); // Pega
    await page.keyboard.down('Space'); // Repetição (repeat: true): antes, soltava
    await page.keyboard.up('Space');
    await expect(page.locator('#c1')).toHaveClass(/jt-dragging/);
    await page.keyboard.press('Escape');
});

test('duas instâncias vendo o mesmo card: o Espaço que solta não pega de novo', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => {
        JetDnD.init({ draggable: '.card', dropzone: '#z1' });
        JetDnD.init({ draggable: '.card', dropzone: '#z1, #z2' });
    });
    await page.locator('#c1').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#c1')).toHaveClass(/jt-dragging/);
    await page.keyboard.press('Space');
    await expect(page.locator('.jt-dragging')).toHaveCount(0);
});

test('card removido no data-jt-drop: jt-drop e jt-drag-end chegam ao document', async ({ page }) => {
    await fixture(page, TWO_ZONES + '<div class="zone jt-dropzone" id="trash" data-jt-drop="lixo"></div>');
    await page.evaluate(() => {
        window.events = [];
        window.lixo = (detail) => detail.card.remove(); // Uma "lixeira"
        for (const name of ['jt-drop', 'jt-drag-end']) {
            document.addEventListener(name, e => window.events.push(name + ':' + e.detail.card.id));
        }
        JetDnD.init();
    });
    await drag(page, page.locator('#c1'), page.locator('#trash'));
    await expect(page.locator('#c1')).toHaveCount(0);
    expect(await page.evaluate(() => window.events)).toEqual(['jt-drop:c1', 'jt-drag-end:c1']);
});

test('o arrasto devolve os estilos inline que o card já tinha', async ({ page }) => {
    await fixture(page, TWO_ZONES.replace('id="c1"', 'id="c1" style="z-index: 5; width: 50%; translate: 1px 1px"'));
    await page.evaluate(() => JetDnD.init());
    await drag(page, page.locator('#c1'), page.locator('#z2'));
    const style = await page.locator('#c1').evaluate(el => ({
        z: el.style.zIndex, w: el.style.width, t: el.style.translate, pos: el.style.position, box: el.style.boxSizing,
    }));
    expect(style).toEqual({ z: '5', w: '50%', t: '1px 1px', pos: '', box: '' });
});

test('card com box-sizing: content-box não muda de tamanho ao ser pego', async ({ page }) => {
    await fixture(page, TWO_ZONES, '.card { box-sizing: content-box; width: 200px; padding: 10px; border: 3px solid; }');
    await page.evaluate(() => JetDnD.init());
    const before = await page.locator('#c1').boundingBox();
    let during;
    await drag(page, page.locator('#c1'), page.locator('#z2'), {
        beforeUp: async () => { during = await page.locator('#c1').boundingBox(); },
    });
    expect(during.width).toBeCloseTo(before.width, 0);
    expect(during.height).toBeCloseTo(before.height, 0);
});

/**
 - Aperta no card, anda (dx, dy) e devolve quanto o card andou de verdade na tela
 */
async function measureJump(page, dx = 30, dy = 0) {
    const card = page.locator('#c1');
    const before = await card.boundingBox();
    const c = await center(card);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + dx, c.y + dy, { steps: 3 });
    const during = await card.boundingBox();
    await page.keyboard.press('Escape');
    await page.mouse.up();
    return { x: during.x - before.x, y: during.y - before.y };
}

test('pai com transform não faz o card pular', async ({ page }) => {
    await fixture(page, `<div style="margin: 40px 0 0 60px; transform: translateX(20px)">${TWO_ZONES}</div>`);
    await page.evaluate(() => JetDnD.init());
    const moved = await measureJump(page, 30, 0);
    expect(moved.x).toBeCloseTo(30, 0);
    expect(moved.y).toBeCloseTo(0, 0);
});

test('card com margin: auto não pula', async ({ page }) => {
    await fixture(page, TWO_ZONES, '.card { width: 120px; margin: 4px auto; }');
    await page.evaluate(() => JetDnD.init());
    const moved = await measureJump(page, 30, 0);
    expect(moved.x).toBeCloseTo(30, 0);
});

test('drop rápido (antes de um quadro da tela) cai no lugar certo', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => JetDnD.init());
    const a = await center(page.locator('#c1'));
    const b = await center(page.locator('#z2'));
    // Tudo num só evaluate: nenhum requestAnimationFrame roda entre o movimento e o drop
    await page.evaluate(({ a, b }) => {
        const card = document.querySelector('#c1');
        const fire = (type, x, y) => card.dispatchEvent(new PointerEvent(type, {
            bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y,
        }));
        fire('pointerdown', a.x, a.y);
        fire('pointermove', a.x + 10, a.y);
        fire('pointermove', b.x, b.y);
        fire('pointerup', b.x, b.y);
    }, { a, b });
    await expect(page.locator('#z2 > #c1')).toHaveCount(1);
});

/**
 - Arrasta #id até o ponto (fx, fy) do card alvo, em frações da largura/altura dele
 - (ex.: 0.9, 0.3 = lado direito, acima do meio).
 - live = true: o ponto é recalculado durante o arrasto (o clone empurra o alvo para baixo, numa lista).
 - live = false: o ponto é medido antes e fica parado. Na grade, o alvo muda de linha quando o clone
 - entra antes dele; "perseguir" o alvo faria o ponteiro passar por espaços vazios, o que ninguém faz
 */
async function dragOnto(page, id, targetId, fx, fy, live = true) {
    const point = async () => {
        const box = await page.locator('#' + targetId).boundingBox();
        return { x: box.x + box.width * fx, y: box.y + box.height * fy };
    };
    return drag(page, page.locator('#' + id), live ? point : await point());
}

const ids = (page, zone) => page.locator(`#${zone} > .card`).evaluateAll(els => els.map(e => e.id));

test('lista: a posição é decidida pela altura, não pelo lado do card', async ({ page }) => {
    await fixture(page, TWO_ZONES, '.card { height: 60px; }');
    await page.evaluate(() => JetDnD.init());

    // Lado DIREITO do c1, acima do meio: entra antes dele (antes, a metade direita mandava para depois)
    await dragOnto(page, 'c3', 'c1', 0.9, 0.3);
    expect(await ids(page, 'z1')).toEqual(['c3', 'c1', 'c2']);

    // Lado ESQUERDO do c2, abaixo do meio: entra depois dele
    await dragOnto(page, 'c3', 'c2', 0.1, 0.7);
    expect(await ids(page, 'z1')).toEqual(['c1', 'c2', 'c3']);
});

test('grade: continua decidindo por esquerda/direita na mesma linha', async ({ page }) => {
    const tiles = [1, 2, 3, 4].map(n => `<div class="card jt-draggable" id="t${n}">${n}</div>`).join('');
    await fixture(page, `<div class="zone jt-dropzone" id="grid">${tiles}</div>`,
        '#grid { display: grid; grid-template-columns: repeat(3, 80px); } .card { height: 80px; }');
    await page.evaluate(() => JetDnD.init());

    // Metade direita do t2, acima do meio: na grade, entra DEPOIS dele
    await dragOnto(page, 't1', 't2', 0.85, 0.3, false);
    expect(await ids(page, 'grid')).toEqual(['t2', 't1', 't3', 't4']);

    // Metade esquerda do t3, abaixo do meio: entra ANTES dele
    await dragOnto(page, 't4', 't3', 0.15, 0.7, false);
    expect(await ids(page, 'grid')).toEqual(['t2', 't1', 't4', 't3']);
});

test('linha com um item só: o CSS (flex em linha) indica que é horizontal', async ({ page }) => {
    await fixture(page, `
        <div class="zone jt-dropzone" id="z1"><div class="card jt-draggable" id="c1">1</div></div>
        <div class="zone jt-dropzone" id="row"><div class="card jt-draggable" id="r1">r1</div></div>`,
        '#row { display: flex; flex-direction: row; } #row .card { width: 100px; }');
    await page.evaluate(() => JetDnD.init());

    // À direita do r1 e acima do meio dele: numa linha, entra DEPOIS (numa lista, entraria antes)
    await dragOnto(page, 'c1', 'r1', 0.85, 0.3);
    expect(await ids(page, 'row')).toEqual(['r1', 'c1']);
});

test('auto-scroll rola uma coluna com rolagem', async ({ page }) => {
    const cards = Array.from({ length: 20 }, (_, i) => `<div class="card jt-draggable">${i}</div>`).join('');
    await fixture(page, `<div class="zone jt-dropzone" id="list" style="height: 300px; overflow: auto">${cards}</div>`);
    await page.evaluate(() => JetDnD.init());
    const list = page.locator('#list');
    const box = await list.boundingBox();
    await drag(page, list.locator('.card').first(), { x: box.x + box.width / 2, y: box.y + box.height - 5 }, {
        beforeUp: () => page.waitForTimeout(400),
    });
    expect(await list.evaluate(el => el.scrollTop)).toBeGreaterThan(50);
});

test('destroy de uma instância não mexe no que é de outra', async ({ page }) => {
    await fixture(page, `
        <div class="zone a-zone"><div class="card a" id="a1">a</div></div>
        <div class="zone b-zone"><div class="card b" id="b1">b</div></div>`);
    await page.evaluate(() => {
        window.a = JetDnD.init({ draggable: '.a', dropzone: '.a-zone' });
        JetDnD.init({ draggable: '.b', dropzone: '.b-zone' });
        window.a.destroy();
    });
    await expect(page.locator('#a1')).not.toHaveAttribute('tabindex');
    await expect(page.locator('#a1')).not.toHaveAttribute('aria-describedby');
    await expect(page.locator('#b1')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#b1')).toHaveAttribute('aria-describedby', /jt-instructions-/);
});

test('alça adicionada depois num card existente passa a receber o foco', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => JetDnD.init());
    await expect(page.locator('#c1')).toHaveAttribute('tabindex', '0');
    await page.evaluate(() => {
        const handle = document.createElement('span');
        handle.className = 'jt-handle';
        handle.textContent = '⠿';
        document.querySelector('#c1').append(handle);
    });
    await expect(page.locator('#c1 .jt-handle')).toHaveAttribute('tabindex', '0');
    await expect(page.locator('#c1')).not.toHaveAttribute('tabindex');
});

test('data-jt-drop: actions funcionam, globais perigosas e não permitidas são ignoradas', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.type()); d.dismiss(); });
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

    await fixture(page, `
        <div class="zone jt-dropzone" id="z1">
            <div class="card jt-draggable" id="c1">1</div><div class="card jt-draggable" id="c2">2</div>
            <div class="card jt-draggable" id="c3">3</div>
        </div>
        <div class="zone jt-dropzone" id="danger" data-jt-drop="alert"></div>
        <div class="zone jt-dropzone" id="action" data-jt-drop="minhaAction"></div>`);

    // 1. Com globalDropActions (padrão): "alert" é bloqueado, a action é chamada
    await page.evaluate(() => {
        window.calls = [];
        window.dnd = JetDnD.init({ actions: { minhaAction: d => window.calls.push('action:' + d.card.id) } });
    });
    await drag(page, page.locator('#c1'), page.locator('#danger'));
    await drag(page, page.locator('#c2'), page.locator('#action'));
    expect(dialogs).toEqual([]);
    expect(await page.evaluate(() => window.calls)).toEqual(['action:c2']);

    // 2. globalDropActions: false: uma função global com o nome certo não é chamada
    await page.evaluate(() => {
        window.dnd.destroy();
        window.minhaAction = () => window.calls.push('global');
        window.dnd = JetDnD.init({ globalDropActions: false });
    });
    await drag(page, page.locator('#c3'), page.locator('#action'));
    expect(await page.evaluate(() => window.calls)).toEqual(['action:c2']);
    expect(warnings.some(w => w.includes('data-jt-drop="minhaAction"'))).toBe(true);
});

test('Esc e depois soltar em cima do card-link não abre o link', async ({ page }) => {
    await fixture(page, `
        <div class="zone jt-dropzone" id="z1"><a class="card jt-draggable" id="c1" href="#aberto">link</a></div>
        <div class="zone jt-dropzone" id="z2"></div>`, '.card { display: block; }');
    await page.evaluate(() => JetDnD.init());
    const c = await center(page.locator('#c1'));
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 40, c.y, { steps: 4 });
    await page.keyboard.press('Escape');
    await page.mouse.move(c.x, c.y, { steps: 4 }); // Volta para cima do card e solta
    await page.mouse.up();
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => location.hash)).toBe('');

    // Um clique normal depois disso continua funcionando
    await page.locator('#c1').click();
    expect(await page.evaluate(() => location.hash)).toBe('#aberto');
});

test('o clone não duplica iframe nem vídeo', async ({ page }) => {
    await fixture(page, `
        <div class="zone jt-dropzone" id="z1">
            <div class="card jt-draggable" id="c1" style="height: auto">
                <iframe src="about:blank" width="100" height="30"></iframe><video width="80" height="30"></video>
            </div>
        </div>
        <div class="zone jt-dropzone" id="z2"></div>`);
    await page.evaluate(() => JetDnD.init());
    let inClone;
    await drag(page, page.locator('#c1'), page.locator('#z2'), {
        beforeUp: async () => {
            inClone = await page.locator('.jt-clone').evaluate(el => ({
                media: el.querySelectorAll('iframe, video').length,
                placeholders: [...el.querySelectorAll('.jt-clone-placeholder')].map(p => p.offsetWidth),
            }));
        },
    });
    // O espaço tem o tamanho real do original (o iframe tem 2px de borda padrão de cada lado: 100 + 4)
    const sizes = await page.locator('#c1').evaluate(el => [...el.querySelectorAll('iframe, video')].map(m => m.offsetWidth));
    expect(inClone).toEqual({ media: 0, placeholders: sizes });
    await expect(page.locator('#c1 iframe')).toHaveCount(1); // O card original continua com tudo
});

test('destroy no meio do arrasto devolve o card e deixa a página limpa', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => { window.dnd = JetDnD.init(); });
    await drag(page, page.locator('#c1'), page.locator('#z2'), {
        beforeUp: () => page.evaluate(() => window.dnd.destroy()),
    });
    expect(await page.locator('#z1 > .card').evaluateAll(els => els.map(e => e.id))).toEqual(['c1', 'c2', 'c3']);
    await expect(page.locator('.jt-clone')).toHaveCount(0);
    await expect(page.locator('#c1')).not.toHaveAttribute('style', /.+/);
    await expect(page.locator('#c1')).not.toHaveAttribute('tabindex');
    await expect(page.locator('body')).not.toHaveClass(/jt-dragging-active/);

    // Um init novo funciona normalmente
    await page.evaluate(() => JetDnD.init());
    await drag(page, page.locator('#c1'), page.locator('#z2'));
    await expect(page.locator('#z2 > #c1')).toHaveCount(1);
});

test('erro na função do usuário não quebra a lib', async ({ page }) => {
    await fixture(page, TWO_ZONES);
    await page.evaluate(() => JetDnD.init({
        onDrop: () => { throw new Error('falha de propósito'); },
        accepts: () => { throw new Error('accepts com erro'); },
    }));
    await drag(page, page.locator('#c1'), page.locator('#c3'));
    expect(await page.locator('#z1 > .card').evaluateAll(els => els.map(e => e.id))).toEqual(['c2', 'c3', 'c1']);
    // Os erros foram capturados e registrados pela lib (console.error), como esperado
    expect(errorState.errors.every(e => e.includes('[JetDnD]'))).toBe(true);
    errorState.errors.length = 0;
});
