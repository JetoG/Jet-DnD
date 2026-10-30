// Funções compartilhadas pelos testes
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

// Arquivo da lib testado. JETDND_LIB permite rodar os testes contra outra versão
// (ex.: a anterior, para conferir que os testes pegam os bugs que foram corrigidos)
const LIB = process.env.JETDND_LIB || path.join(__dirname, '..', 'jet-dnd.js');
const DEMO_URL = process.env.JETDND_DEMO ? pathToFileURL(process.env.JETDND_DEMO).href : pathToFileURL(path.join(__dirname, '..', 'docs', 'index.html')).href;

/**
 - Liga a coleta de erros da página em cada teste: qualquer erro de JavaScript
 - (ou console.error) que não foi esperado faz o teste falhar no fim
 - @returns {{ errors: string[] }} Lista de erros (o teste pode esvaziá-la se o erro era esperado)
 */
function collectErrors() {
    const state = { errors: [] };
    test.beforeEach(({ page }) => {
        state.errors = [];
        page.on('pageerror', e => state.errors.push('pageerror: ' + e.message));
        page.on('console', msg => { if (msg.type() === 'error') state.errors.push('console.error: ' + msg.text()); });
    });
    test.afterEach(() => {
        expect(state.errors, 'erros na página').toEqual([]);
    });
    return state;
}

/**
 - Monta uma página de teste com o HTML informado e carrega a lib
 - @param {import('@playwright/test').Page} page
 - @param {string} html - Conteúdo do <body>
 - @param {string} [css] - CSS extra
 */
async function fixture(page, html, css = '') {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
        body { margin: 0; padding: 20px; font: 16px sans-serif; }
        .zone { width: 300px; min-height: 150px; padding: 8px; border: 1px solid #999; margin-bottom: 20px; }
        .card { height: 40px; margin: 4px; background: #ddd; }
        ${css}
    </style></head><body>${html}</body></html>`);
    await page.addScriptTag({ path: LIB });
}

/**
 - Centro de um elemento na janela
 - @param {import('@playwright/test').Locator} locator
 */
async function center(locator) {
    const box = await locator.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 - Arrasta com o mouse de um elemento até um ponto (ou até o centro de outro elemento)
 - @param {import('@playwright/test').Page} page
 - @param {import('@playwright/test').Locator} from - Onde apertar
 - @param {{x:number,y:number}|import('@playwright/test').Locator|Function} to - Onde soltar.
 -   Uma função (async () => ponto) é recalculada durante o arrasto, depois que o clone se acomoda
 -   (o clone empurra os cards: um ponto medido antes do arrasto cai em outro lugar).
 -   É o que uma pessoa faz: ajusta o mouse olhando onde o fantasma está
 - @param {Object} [opts]
 - @param {Function} [opts.beforeUp] - Roda com o botão ainda apertado (ex.: conferir o estado durante o arrasto)
 - @param {number} [opts.steps] - Quantos pointermove até o destino
 */
async function drag(page, from, to, { beforeUp, steps = 10 } = {}) {
    const a = await center(from);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 8, a.y + 8, { steps: 2 }); // Passa do dragThreshold: começa o arrasto
    const resolve = async () => typeof to === 'function' ? to() : typeof to.boundingBox === 'function' ? center(to) : to;
    let b = await resolve();
    await page.mouse.move(b.x, b.y, { steps });
    if (typeof to === 'function') {
        for (let i = 0; i < 3; i++) {
            await nextFrames(page);
            b = await resolve();
            await page.mouse.move(b.x, b.y, { steps: 2 });
        }
    }
    if (beforeUp) await beforeUp();
    await page.mouse.up();
}

/**
 - Ponto em cima de um elemento onde o card arrastado entra ANTES dele (canto de cima à esquerda)
 - ou DEPOIS dele (canto de baixo à direita). Os cantos valem para lista (decide pela altura)
 - e para grade (decide pela metade esquerda/direita)
 - @param {import('@playwright/test').Locator} locator
 - @param {'before'|'after'} where
 */
async function edgeOf(locator, where) {
    const box = await locator.boundingBox();
    return where === 'before'
        ? { x: box.x + 10, y: box.y + 4 }
        : { x: box.x + box.width - 10, y: box.y + box.height - 4 };
}

/** Espera dois quadros da tela (o destaque e o clone são atualizados por requestAnimationFrame) */
async function nextFrames(page) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

module.exports = { test, expect, LIB, DEMO_URL, collectErrors, fixture, center, drag, edgeOf, nextFrames };
