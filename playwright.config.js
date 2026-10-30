// Configuração dos testes (Playwright): rodam num navegador de verdade,
// porque Pointer Events, layout e foco não existem em simuladores como o jsdom
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'tests',
    fullyParallel: true,
    reporter: 'list',
    // Os três motores: Chromium (Chrome, Edge), Firefox e WebKit (Safari).
    // Eles diferem justamente nos detalhes que a lib trata (foco ao remover elementos, click depois do arrasto...)
    projects: ['Desktop Chrome', 'Desktop Firefox', 'Desktop Safari'].map(device => ({
        name: devices[device].defaultBrowserType,
        use: {
            ...devices[device],
            locale: 'pt-BR', // A demo escolhe o idioma pelo navegador: os testes esperam os textos em português
            viewport: { width: 1280, height: 900 },
        },
    })),
});
