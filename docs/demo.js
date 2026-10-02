// ==========================================================================
// Código só da DEMO (não faz parte da lib):
// troca de idioma, painel de eventos e botão de adicionar card.
// ==========================================================================

// Liga a lib com os seletores padrão (.jt-draggable, .jt-dropzone, .jt-handle).
// A demo mostra as três formas de reagir a um drop:
// 1. onDrop (aqui no init): atualiza os contadores das colunas do quadro e
//    desmarca a tarefa como feita quando ela sai da coluna "Feito";
// 2. data-jt-drop="marcarComoFeito" (na coluna "Feito", no HTML): chama a função marcarComoFeito;
// 3. addEventListener('jt-drop') (mais abaixo): escreve no painel de eventos.
const dnd = JetDnD.init({
    // Alças: o ícone ⠿ (.jt-handle) e também títulos marcados com .title-handle.
    // Mostra que a alça pode ser qualquer elemento, com uma classe que já existe no HTML
    handle: '.jt-handle, .title-handle',

    // Regra livre: a coluna "Feito" só aceita tarefas que vieram de "Fazendo".
    // (A coluna de origem sempre aceita o card de volta, então dá para reordenar dentro de "Feito")
    accepts: (card, to, from) => to.dataset.name !== 'col.done' || from?.dataset.name === 'col.doing',
    onDrop: (detail) => {
        let leftDone = detail.from.dataset.name === 'col.done' && detail.to.dataset.name !== 'col.done';
        if (leftDone) detail.card.classList.remove('is-done');
        updateCounts();
    },
});

/**
 - Chamada pelo data-jt-drop da coluna "Feito": risca a tarefa.
 - Precisa ser global (declarada com function) para a lib achar pelo nome, igual ao onclick=""
 - @param {Object} detail - Informações do drop ({ card, from, to, oldIndex, newIndex })
 */
function marcarComoFeito(detail) {
    detail.card.classList.add('is-done');
}

/**
 - Atualiza o número de cards ao lado do título de cada coluna do quadro
 */
function updateCounts() {
    document.querySelectorAll('.kanban .column').forEach(column => {
        column.querySelector('.count').textContent = column.querySelectorAll('.jt-draggable').length;
    });
}

// Textos da página nos dois idiomas. No HTML, cada elemento traduzível tem data-i18n="chave"
const texts = {
    pt: {
        'page.title': 'Jet DnD — Demo',
        'tagline': 'Arraste e solte em JavaScript puro, sem dependências. Funciona com mouse, toque e caneta.',
        'github': 'Ver no GitHub',
        'docs': 'Documentação',

        'kanban.title': 'Quadro de tarefas',
        'kanban.desc': 'Arraste as tarefas entre as colunas ou mude a ordem dentro de uma coluna. A coluna "Feito" só aceita tarefas que vieram de "Fazendo". No celular, segure o card por um instante para pegá-lo.',
        'col.todo': 'A fazer',
        'col.doing': 'Fazendo',
        'col.done': 'Feito',
        'task1.title': 'Criar tela de login',
        'task1.text': 'Formulário com e-mail e senha',
        'task2.title': 'Configurar banco de dados',
        'task2.text': 'Tabelas de usuários e tarefas',
        'task3.title': 'Escrever testes',
        'task3.text': 'Cobrir o fluxo de cadastro',
        'task4.title': 'Revisar textos',
        'task4.text': 'Corrigir erros de digitação',
        'task5.title': 'Ícones novos',
        'task5.text': 'Exportar em SVG',
        'task6.title': 'Página de ajuda',
        'task6.text': 'Perguntas frequentes',
        'task7.title': 'Arrastar e soltar',
        'task7.text': 'Reordenar os cards',
        'task8.title': 'Modo escuro',
        'task8.text': 'Seguir o tema do sistema',
        'task9.title': 'Publicar a demo',
        'task9.text': 'GitHub Pages',
        'newCard.title': 'Nova tarefa {n}',
        'newCard.text': 'Criada depois que a página carregou',

        'log.title': 'Eventos',
        'log.clear': 'Limpar',
        'log.empty': 'Mova um card para ver o evento jt-drop aqui.',
        'log.moved': '{from} → {to}',
        'log.reordered': 'nova ordem em {to}',
        'log.position': 'posição {old} → {new}',
        'addCard': '+ Adicionar card',
        'addCard.hint': 'Cards criados depois que a página carregou também arrastam.',

        'handle.title': 'Cards com alça',
        'handle.desc': 'Só a alça arrasta. O resto do card é texto normal: dá para selecionar e copiar. A alça pode ser qualquer elemento, e um card pode ter mais de uma.',
        'handle.label': 'Arrastar',
        'list.a': 'Lista A',
        'list.b': 'Lista B',
        'note1.title': 'Selecione este texto',
        'note1.text': 'Clique e arraste aqui para selecionar. Para mover o card, use a alça no canto.',
        'note2.title': 'Copie e cole',
        'note2.text': 'Útil quando o card tem informações que a pessoa precisa copiar, como um código ou um endereço.',
        'note3.title': 'No celular',
        'note3.text': 'Arrastando pela alça, o card pega na hora. Deslizando pelo resto do card, a página rola normalmente.',
        'note4.title': 'Arraste pelo título',
        'note4.text': 'Aqui a alça é o próprio título. Este texto continua selecionável.',
        'note5.title': 'Duas alças',
        'note5.text': 'Dá para arrastar pelo ícone ou pelo título.',

        'grid.title': 'Grade',
        'grid.desc': 'A reordenação também funciona com vários itens por linha. Os quadrados formam um grupo: só ficam na grade, e os cards de fora não entram nela.',
        'grid.name': 'Grade',

        'nested.title': 'Dropzone dentro de dropzone',
        'nested.desc': 'O card cai sempre na dropzone mais interna que estiver embaixo do ponteiro.',
        'nested.outer': 'Externa',
        'nested.inner': 'Interna',
        'nest1.title': 'Estou na externa',
        'nest1.text': 'Me arraste para a área tracejada.',
        'nest2.title': 'Estou na interna',
        'nest2.text': 'Me arraste para fora da área tracejada.',

        'footer': 'Feito por Jean / Jeto · Licença MIT',

        'keys': 'Pelo teclado: Tab para focar um card, Espaço para pegar, setas para mover (↑↓ na coluna, ←→ entre colunas), Espaço para soltar e Esc para cancelar.',

        // Mensagens que a lib anuncia para leitores de tela (passadas com dnd.setMessages)
        'a11y.instructions': 'Pressione Espaço para pegar. Use as setas para cima e para baixo para reordenar e as setas para os lados para mudar de lista. Pressione Espaço de novo para soltar, ou Esc para cancelar.',
        'a11y.pickedUp': 'Pego. Posição {position} de {total}.',
        'a11y.moved': 'Posição {position} de {total}.',
        'a11y.movedList': 'Mudou de lista. Posição {position} de {total}.',
        'a11y.dropped': 'Solto. Posição {position} de {total}.',
        'a11y.canceled': 'Cancelado. O card voltou para o lugar original.',
    },
    en: {
        'page.title': 'Jet DnD — Demo',
        'tagline': 'Drag and drop in plain JavaScript, with no dependencies. Works with mouse, touch and pen.',
        'github': 'View on GitHub',
        'docs': 'Documentation',

        'kanban.title': 'Task board',
        'kanban.desc': 'Drag tasks between columns or change their order inside a column. The "Done" column only accepts tasks coming from "Doing". On mobile, press and hold a card for a moment to pick it up.',
        'col.todo': 'To do',
        'col.doing': 'Doing',
        'col.done': 'Done',
        'task1.title': 'Build login screen',
        'task1.text': 'Email and password form',
        'task2.title': 'Set up database',
        'task2.text': 'Users and tasks tables',
        'task3.title': 'Write tests',
        'task3.text': 'Cover the sign-up flow',
        'task4.title': 'Proofread texts',
        'task4.text': 'Fix typos',
        'task5.title': 'New icons',
        'task5.text': 'Export as SVG',
        'task6.title': 'Help page',
        'task6.text': 'Frequently asked questions',
        'task7.title': 'Drag and drop',
        'task7.text': 'Reorder the cards',
        'task8.title': 'Dark mode',
        'task8.text': 'Follow the system theme',
        'task9.title': 'Publish the demo',
        'task9.text': 'GitHub Pages',
        'newCard.title': 'New task {n}',
        'newCard.text': 'Created after the page loaded',

        'log.title': 'Events',
        'log.clear': 'Clear',
        'log.empty': 'Move a card to see the jt-drop event here.',
        'log.moved': '{from} → {to}',
        'log.reordered': 'new order in {to}',
        'log.position': 'position {old} → {new}',
        'addCard': '+ Add card',
        'addCard.hint': 'Cards created after the page loaded can be dragged too.',

        'handle.title': 'Cards with a handle',
        'handle.desc': 'Only the handle drags. The rest of the card is regular text: you can select and copy it. The handle can be any element, and a card can have more than one.',
        'handle.label': 'Drag',
        'list.a': 'List A',
        'list.b': 'List B',
        'note1.title': 'Select this text',
        'note1.text': 'Click and drag here to select. To move the card, use the handle in the corner.',
        'note2.title': 'Copy and paste',
        'note2.text': 'Useful when the card has information people need to copy, like a code or an address.',
        'note3.title': 'On mobile',
        'note3.text': 'Dragging by the handle picks the card up right away. Swiping anywhere else on the card scrolls the page as usual.',
        'note4.title': 'Drag by the title',
        'note4.text': 'Here the handle is the title itself. This text is still selectable.',
        'note5.title': 'Two handles',
        'note5.text': 'You can drag by the icon or by the title.',

        'grid.title': 'Grid',
        'grid.desc': 'Reordering also works with several items per row. The squares form a group: they stay in the grid, and cards from elsewhere cannot enter it.',
        'grid.name': 'Grid',

        'nested.title': 'Dropzone inside a dropzone',
        'nested.desc': 'The card always lands in the innermost dropzone under the pointer.',
        'nested.outer': 'Outer',
        'nested.inner': 'Inner',
        'nest1.title': 'I am in the outer one',
        'nest1.text': 'Drag me into the dashed area.',
        'nest2.title': 'I am in the inner one',
        'nest2.text': 'Drag me out of the dashed area.',

        'footer': 'Made by Jean / Jeto · MIT License',

        'keys': 'With the keyboard: Tab to focus a card, Space to pick it up, arrows to move (↑↓ in the column, ←→ between columns), Space to drop and Esc to cancel.',

        // Messages the library announces to screen readers (passed with dnd.setMessages)
        'a11y.instructions': 'Press Space to pick up. Use the up and down arrows to reorder and the left and right arrows to move to another list. Press Space again to drop, or Escape to cancel.',
        'a11y.pickedUp': 'Picked up. Position {position} of {total}.',
        'a11y.moved': 'Position {position} of {total}.',
        'a11y.movedList': 'Moved to another list. Position {position} of {total}.',
        'a11y.dropped': 'Dropped. Position {position} of {total}.',
        'a11y.canceled': 'Canceled. Back to the original position.',
    },
};

// ---------- Idioma ----------

// Idioma inicial: o que a pessoa escolheu da última vez; senão, o do navegador (pt-* → PT, o resto → EN).
// localStorage pode falhar (aba anônima, cookies bloqueados), por isso o try/catch
let lang;
try {
    lang = localStorage.getItem('jt-demo-lang');
} catch {}
// (navigator.language pode vir vazio em alguns ambientes, por isso o || '')
if (!texts[lang]) lang = (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en';

/**
 - Busca um texto no idioma atual e troca as {variáveis} pelos valores
 - @param {string} key - Chave do texto (ex.: 'col.todo')
 - @param {Object} vars - Valores das variáveis (ex.: { n: 3 })
 - @returns {string} O texto traduzido
 */
function t(key, vars = {}) {
    let text = texts[lang][key] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => vars[name] ?? match);
}

/**
 - Aplica o idioma atual em todos os elementos com data-i18n (texto) e data-i18n-title (dica do mouse)
 */
function applyLanguage() {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
    document.title = t('page.title');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n, { n: el.dataset.i18nN });
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });

    // O link da documentação abre o README no idioma atual
    document.getElementById('docs-link').href = lang === 'pt'
        ? 'https://github.com/JetoG/Jet-DnD#readme'
        : 'https://github.com/JetoG/Jet-DnD/blob/main/README.en.md';

    // Marca qual botão de idioma está ativo
    document.querySelectorAll('[data-lang]').forEach(button => {
        button.setAttribute('aria-pressed', button.dataset.lang === lang);
    });

    renderLog(); // As mensagens do painel também mudam de idioma

    // As mensagens da lib para leitores de tela também mudam de idioma.
    // ({position} e {total} passam intactos pelo t(), porque não são variáveis dele: quem troca é a lib)
    dnd.setMessages({
        instructions: t('a11y.instructions'),
        pickedUp: t('a11y.pickedUp'),
        moved: t('a11y.moved'),
        movedList: t('a11y.movedList'),
        dropped: t('a11y.dropped'),
        canceled: t('a11y.canceled'),
    });
}

document.querySelectorAll('[data-lang]').forEach(button => {
    button.addEventListener('click', () => {
        lang = button.dataset.lang;
        try {
            localStorage.setItem('jt-demo-lang', lang);
        } catch {}
        applyLanguage();
    });
});

// ---------- Painel de eventos ----------

const logList = document.getElementById('log-list');
const logEmpty = document.getElementById('log-empty');
const logStatus = document.getElementById('log-status');
const MAX_LOG_ENTRIES = 20;

// Guarda os dados de cada evento (e não o texto pronto), para dar para redesenhar em outro idioma
let logEntries = [];

/**
 - Nome de um card para mostrar no painel: o título, ou o próprio texto (nos tiles da grade)
 - @param {HTMLElement} card - Elemento do card
 - @returns {string}
 */
function cardName(card) {
    return (card.querySelector('.card-title') ?? card).textContent.trim();
}

/**
 - Desenha o painel de eventos a partir de logEntries (o mais recente em cima)
 */
function renderLog() {
    logList.innerHTML = '';
    logEmpty.hidden = logEntries.length > 0;

    logEntries.forEach(entry => {
        let from = t(entry.from.dataset.name);
        let to = t(entry.to.dataset.name);
        let what = entry.from === entry.to ? t('log.reordered', { to }) : t('log.moved', { from, to });

        // textContent (e não innerHTML) para o texto dos cards nunca ser interpretado como HTML
        let item = document.createElement('li');
        let title = document.createElement('strong');
        title.textContent = cardName(entry.card);
        let detail = document.createElement('span');
        detail.className = 'log-detail';
        detail.textContent = what + ' · ' + t('log.position', { old: entry.oldIndex + 1, new: entry.newIndex + 1 });

        item.append(title, detail);
        logList.append(item);
    });
}

// Exemplo de uso do evento jt-drop da lib: cada card movido vira uma linha no painel.
// Num projeto real, aqui entraria o fetch() para salvar a mudança no servidor
document.addEventListener('jt-drop', (e) => {
    logEntries.unshift(e.detail); // unshift = coloca no começo da lista
    logEntries = logEntries.slice(0, MAX_LOG_ENTRIES);
    renderLog();

    // Para leitores de tela: anuncia só o evento novo (e não a lista inteira, que é redesenhada)
    let first = logList.firstElementChild;
    logStatus.textContent = first ? first.textContent : '';
});

document.getElementById('log-clear').addEventListener('click', () => {
    logEntries = [];
    renderLog();
});

// ---------- Botão de adicionar card ----------

let newCardCount = 0;

// Cria um card novo no fim da coluna "A fazer".
// Ele arrasta sem nenhum código extra, por causa da delegação de eventos da lib (item 4.5)
document.getElementById('add-card').addEventListener('click', () => {
    newCardCount++;

    let card = document.createElement('div');
    card.className = 'card jt-draggable';

    let title = document.createElement('div');
    title.className = 'card-title';
    title.dataset.i18n = 'newCard.title';
    title.dataset.i18nN = newCardCount; // Vira o {n} do texto
    title.textContent = t('newCard.title', { n: newCardCount });

    let text = document.createElement('div');
    text.className = 'card-text';
    text.dataset.i18n = 'newCard.text';
    text.textContent = t('newCard.text');

    card.append(title, text);

    let column = document.querySelector('[data-name="col.todo"]');
    column.append(card);
    updateCounts();
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); // Rola a coluna até o card novo
});

applyLanguage();
updateCounts();
