/**
 - Jet DnD v1.1.0 — arraste e solte em JavaScript puro, sem dependências.
 - Funciona com mouse, toque e caneta.
 - https://github.com/JetoG/Jet-DnD · Licença MIT · Feito por Jean / Jeto
 -
 - Uso:
 -   const dnd = JetDnD.init();      // com as opções padrão
 -   const dnd = JetDnD.init({ ... }); // com opções (veja DEFAULTS abaixo)
 -   dnd.setMessages({ ... });       // troca as mensagens dos leitores de tela (ex.: outro idioma)
 -   dnd.destroy();                  // desliga tudo
 */

// IIFE (função que se executa imediatamente): tudo que está aqui dentro fica PRIVADO.
// Nenhuma variável ou função vaza para a página; só o window.JetDnD fica visível lá fora.
// Assim a lib não briga com outros scripts que tenham, por exemplo, uma variável "isDragging"
(function () {
    'use strict'; // Modo estrito: o navegador avisa erros que normalmente passariam calados

    // Fora do navegador (ex.: renderização no servidor com Node) não existe window nem DOM:
    // a lib não faz nada, em vez de quebrar o import com ReferenceError
    if (typeof window === 'undefined') return;

    // Se a lib for incluída duas vezes na página, a segunda não faz nada
    // (sem isso, os listeners seriam registrados de novo e cada arrasto rodaria duas vezes)
    if (window.JetDnD) return;

    // Opções padrão. Quem usa a lib pode trocar qualquer uma delas no init
    const DEFAULTS = {
        draggable: '.jt-draggable', // Elementos que podem ser arrastados
        dropzone: '.jt-dropzone',   // Onde eles podem ser soltos
        handle: '.jt-handle',       // Alça (opcional): se o card tiver, só ela arrasta. Pode ter mais de uma por card e aceita vários seletores (ex.: '.alca, .titulo')
        dragThreshold: 4,           // Distância mínima (em px) que o ponteiro precisa andar para o clique virar arrasto
        longPressDelay: 400,        // Tempo (em ms) segurando o dedo parado para começar o arrasto no toque, em cards sem alça

        // Auto-scroll: com o ponteiro perto da borda de uma área com rolagem (ou da janela), ela rola sozinha
        autoScroll: true,
        scrollEdge: 40,  // Tamanho (em px) da faixa perto da borda que faz rolar
        scrollSpeed: 15, // Velocidade máxima (em px por quadro), quando o ponteiro está bem na borda

        // Teclado: Tab foca o card (ou a alça), Espaço pega, setas movem, Espaço/Enter solta, Esc cancela
        keyboard: true,

        // Mensagens para leitores de tela (anunciadas durante o arrasto pelo teclado).
        // {position} e {total} são trocados pela posição do card e pelo total de cards na dropzone
        messages: {
            instructions: 'Press Space to pick up. Use the up and down arrows to reorder and the left and right arrows to move to another list. Press Space again to drop, or Escape to cancel.',
            pickedUp: 'Picked up. Position {position} of {total}.',
            moved: 'Position {position} of {total}.',
            movedList: 'Moved to another list. Position {position} of {total}.',
            dropped: 'Dropped. Position {position} of {total}.',
            canceled: 'Canceled. Back to the original position.',
        },

        // Regra livre para decidir se um card pode cair numa dropzone: (card, dropzone, from) => true/false.
        // Soma-se aos grupos (data-jt-group). A dropzone de origem sempre aceita o card de volta
        accepts: null,

        // Funções que o data-jt-drop da dropzone pode chamar, pelo nome: { marcarComoFeito }.
        // É uma lista do que é permitido: um atributo HTML só chama o que estiver aqui
        actions: {},

        // O data-jt-drop também procura funções globais (window)? true mantém o jeito da v1.0.
        // Use false quando o HTML puder ter conteúdo vindo de usuários: aí só valem as "actions"
        globalDropActions: true,

        // Funções chamadas nos momentos do arrasto (cada uma recebe um objeto "detail" com as informações)
        onDragStart: null, // Começou a arrastar:        { card, from, index }
        onDrop: null,      // Soltou e o card mudou de lugar: { card, from, to, oldIndex, newIndex }
        onDragEnd: null,   // Terminou (sempre, mesmo sem mudança ou cancelado): { card, from, to, oldIndex, newIndex, changed }
    };

    // Elementos interativos: apertar neles não começa o arrasto (senão botões, links e campos param de funcionar)
    const INTERACTIVE_ELEMENTS = 'input, textarea, select, button, a, label, [contenteditable]:not([contenteditable="false"])';

    // Compartilhado entre todas as instâncias: só um card pode ser arrastado por vez na página
    // (mesmo que dois init diferentes "enxerguem" o mesmo card)
    let activeCard = null;

    // Instâncias criadas, por combinação de seletores. Chamar o init de novo com os mesmos
    // seletores devolve a instância que já existe, em vez de duplicar os listeners
    const instances = new Map();

    // Contador para dar um id único ao texto de instruções de cada instância
    let instanceCount = 0;

    // Estilo "visualmente escondido": invisível na tela, mas lido pelos leitores de tela
    const VISUALLY_HIDDEN = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;';

    // Opções que são seletores CSS e opções numéricas (validadas no init)
    const SELECTOR_OPTIONS = ['draggable', 'dropzone', 'handle'];
    const NUMBER_OPTIONS = ['dragThreshold', 'longPressDelay', 'scrollEdge', 'scrollSpeed'];

    // Propriedades que a lib coloca inline no card durante o arrasto
    // (guardadas antes e devolvidas depois, para não apagar o que já estava lá)
    const DRAG_STYLE_PROPS = ['position', 'top', 'left', 'width', 'height', 'box-sizing',
        'translate', 'z-index', 'pointer-events'];

    // Elementos que o clone não deve copiar: um iframe recarregaria a página dele,
    // e um vídeo ou áudio com autoplay tocaria em dobro. No clone, viram um espaço do mesmo tamanho
    const HEAVY_MEDIA = 'iframe, video, audio, embed, object';

    // Funções globais que um data-jt-drop nunca pode chamar, mesmo com globalDropActions: true
    const BLOCKED_GLOBALS = new Set([
        'eval', 'Function', 'alert', 'confirm', 'prompt', 'open', 'close', 'print', 'stop',
        'fetch', 'postMessage', 'setTimeout', 'setInterval', 'queueMicrotask',
        'requestAnimationFrame', 'importScripts', 'XMLHttpRequest', 'WebSocket', 'Worker',
    ]);

    /**
     - Valida as opções ANTES de a lib tocar na página.
     - Sem isso, um seletor inválido só dava erro no meio do init, com os listeners já
     - registrados: o init falhava sem devolver a instância (sem destroy para chamar)
     - e os listeners ficavam na página para sempre. Validando antes, o init é "tudo ou nada"
     - @param {Object} options - Opções já juntadas com DEFAULTS (os números inválidos são corrigidos aqui)
     - @throws {TypeError|SyntaxError} Se um seletor for inválido
     */
    function validateOptions(options) {
        for (let name of SELECTOR_OPTIONS) {
            let selector = options[name];
            if (typeof selector !== 'string' || !selector.trim()) {
                throw new TypeError(`[JetDnD] a opção "${name}" precisa ser um seletor CSS (texto).`);
            }
            // Os seletores vão para dentro de um <style>: chaves fechariam a regra
            // e deixariam injetar CSS. Um seletor válido nunca precisa delas
            if (/[{}]/.test(selector)) {
                throw new SyntaxError(`[JetDnD] a opção "${name}" não pode ter "{" ou "}".`);
            }
            // Um fragmento vazio é o jeito mais barato de o próprio navegador validar o seletor
            try {
                document.createDocumentFragment().querySelector(selector);
            } catch {
                throw new SyntaxError(`[JetDnD] seletor inválido na opção "${name}": ${selector}`);
            }
        }

        // Números inválidos não derrubam a página: voltam ao padrão, com um aviso
        for (let name of NUMBER_OPTIONS) {
            if (!Number.isFinite(options[name]) || options[name] < 0) {
                console.warn(`[JetDnD] opção "${name}" inválida (${options[name]}); usando ${DEFAULTS[name]}.`);
                options[name] = DEFAULTS[name];
            }
        }
        // Faixa de borda zero: não há onde o auto-scroll agir (e a conta da velocidade dividiria por zero)
        if (options.scrollEdge === 0) options.autoScroll = false;

        if (options.actions == null || typeof options.actions !== 'object') options.actions = {};
    }

    /**
     - Liga o arrastar e soltar na página.
     - @param {Object} userOptions - Opções (as que não forem informadas usam o padrão de DEFAULTS)
     - @returns {{ destroy: Function, options: Object, setMessages: Function }} A instância criada
     - @throws {TypeError|SyntaxError} Se um seletor das opções for inválido (nada é ligado nesse caso)
     */
    function init(userOptions = {}) {
        userOptions ??= {}; // init(null) também usa o padrão

        // Junta o padrão com o que a pessoa passou (o que ela passou ganha).
        // As mensagens são juntadas à parte, para dar para trocar só algumas delas
        const options = { ...DEFAULTS, ...userOptions };
        options.messages = { ...DEFAULTS.messages, ...userOptions.messages };
        validateOptions(options); // Antes de qualquer addEventListener

        // Opções congeladas: trocar dnd.options.draggable depois do init deixaria o CSS injetado
        // e o registro de instâncias inconsistentes. (As mensagens mudam pelo setMessages)
        Object.freeze(options);

        const key = options.draggable + '|' + options.dropzone;
        if (instances.has(key)) {
            console.warn('[JetDnD] init chamado de novo com os mesmos seletores; usando a instância que já existe.');
            return instances.get(key);
        }

        // ---------- Estado desta instância ----------
        // Cada init tem as suas próprias variáveis. As funções abaixo continuam "lembrando" delas
        // (isso se chama closure), por isso não precisam ser globais
        let currentCard = null, cardClone = null, originalDropzone = null;
        let originalIndex = -1; // Posição do card na dropzone de origem (para o evento jt-drop)
        let cardWidth = 0, cardHeight = 0;
        let pressX = 0, pressY = 0; // Posição do ponteiro no momento do pointerdown
        let lastX = 0, lastY = 0; // Última posição conhecida do ponteiro (o auto-scroll e a rolagem usam, porque o ponteiro pode estar parado)
        let autoScrollFrame = null; // Quadro agendado do auto-scroll (requestAnimationFrame)
        let pointerId = null; // Qual ponteiro (mouse, dedo...) está segurando o card, para o setPointerCapture
        let isDragging = false; // false = só pressionado | true = arrastando de fato
        let longPressTimer = null; // Timer do long press (null = não está esperando um long press)
        let currentDropzone = null; // Dropzone embaixo do ponteiro durante o arrasto (a que está destacada)
        let currentRefused = null; // Dropzone embaixo do ponteiro que recusou o card (a que está marcada como recusada)
        let previousUserSelect = ''; // user-select que o body tinha antes do arrasto (para devolver no fim)
        let previousWebkitUserSelect = ''; // O mesmo, para o -webkit-user-select (Safari)
        let savedInlineStyles = null; // Estilos inline que o card tinha antes do arrasto: [propriedade, valor, prioridade]
        let dropTargetFrame = null; // Quadro agendado para recalcular a dropzone e o clone (requestAnimationFrame)
        let overflowCache = new WeakMap(); // overflow de cada elemento, lido uma vez por arrasto (para o auto-scroll)
        let destroyed = false; // true depois do destroy (a instância está desligada)

        // Id desta instância: usado no id das instruções e no marcador data-jt-tabindex,
        // para o destroy desfazer só o que esta instância fez
        const uid = String(++instanceCount);

        // Estado do arrasto pelo teclado
        let keyboardDragging = false; // true = um card foi pego com o Espaço
        let keyboardTarget = null; // Elemento com o foco (o card ou a alça dele)
        let originalNextSibling = null; // O que vinha logo depois do card na origem (para o Esc devolver ele no lugar)
        let movingByKeyboard = false; // true enquanto o card troca de lugar no DOM (mover um elemento pode tirar o foco dele)

        // ---------- Ligando ----------

        // Delegação de eventos: em vez de um listener em cada card, um só no document.
        // O pointerdown de qualquer lugar da página "sobe" até o document, e o jtPointerDown
        // descobre se foi num card. Assim, cards criados depois que a página carregou também arrastam.
        // Pointer events = um só tipo de evento para mouse, toque e caneta
        document.addEventListener('pointerdown', jtPointerDown);

        // Impede o "arrastar" nativo do navegador (de imagens e links dentro do card), que brigaria com o nosso
        document.addEventListener('dragstart', preventNativeDrag);

        // CSS da lib, injetado na página. Uma regra de CSS (em vez de style inline em cada elemento)
        // vale também para os cards criados depois. Os seletores vêm das opções, dentro de :is()
        // para funcionar mesmo se a opção tiver vírgula (ex.: handle: '.alca, .titulo').
        // - touch-action: na alça, o toque é sempre arrasto (nunca rolagem). Precisa estar no elemento ANTES do toque.
        // - -webkit-touch-callout: no iPhone, segurar o dedo num card sem alça não abre o balão de copiar.
        // - .jt-clone: aparência padrão do clone. O :where() zera a especificidade, então qualquer CSS
        //   de quem usa a lib (ex.: .jt-clone { opacity: .3 }) ganha deste padrão
        const style = document.createElement('style');
        style.textContent = `
            :is(${options.draggable}) :is(${options.handle}) { touch-action: none; }
            :is(${options.draggable}):not(:has(:is(${options.handle}))) { -webkit-touch-callout: none; }
            :where(.jt-clone) { opacity: 0.5; }
        `;
        document.head.append(style);

        // ---------- Teclado e leitores de tela ----------

        // Texto de instruções (escondido na tela). Os cards focáveis apontam para ele com aria-describedby,
        // então o leitor de tela lê as instruções quando o card recebe o foco
        const instructions = document.createElement('div');
        instructions.id = 'jt-instructions-' + uid;
        instructions.style.cssText = VISUALLY_HIDDEN;
        instructions.textContent = options.messages.instructions;

        // "Região viva": tudo que é escrito nela o leitor de tela anuncia na hora (ex.: "Posição 2 de 5")
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'assertive');
        liveRegion.style.cssText = VISUALLY_HIDDEN;

        // document.body ainda não existe se o init for chamado no <head>; aí usa o <html>
        (document.body ?? document.documentElement).append(instructions, liveRegion);

        document.addEventListener('keydown', jtKeyDown);
        document.addEventListener('focusout', onFocusOut);

        // Deixa os cards (ou as alças) focáveis pelo Tab. O MutationObserver avisa quando elementos
        // são adicionados à página, para os cards criados depois também ficarem focáveis
        prepareFocusTargets(document);
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) prepareFocusTargets(node);
            }));
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        const instance = { destroy, options, setMessages };
        instances.set(key, instance);
        return instance;

        // ---------- Funções desta instância ----------
        // (Declarações de função são "içadas" para o topo: dá para usá-las acima, antes do return)

        /**
         - Desliga a lib: remove os listeners e o CSS injetado, e cancela um arrasto em andamento
         - (o card volta para onde estava).
         - Chamar de novo não faz nada (a instância já está desligada)
         */
        function destroy() {
            if (destroyed) return;
            destroyed = true;

            if (keyboardDragging) keyboardCancel(false);
            else if (currentCard) jtDragEnd({ type: 'pointercancel' });

            document.removeEventListener('pointerdown', jtPointerDown);
            document.removeEventListener('dragstart', preventNativeDrag);
            document.removeEventListener('keydown', jtKeyDown);
            document.removeEventListener('focusout', onFocusOut);
            observer.disconnect();
            style.remove();
            instructions.remove();
            liveRegion.remove();

            // Desfaz o que ESTA instância colocou nos elementos para deixá-los focáveis.
            // O marcador guarda o id da instância: o destroy de uma não mexe no que é de outra
            document.querySelectorAll(`[data-jt-tabindex="${uid}"]`).forEach(el => {
                el.removeAttribute('tabindex');
                el.removeAttribute('data-jt-tabindex');
            });
            // O id das instruções é só desta instância: basta tirá-lo de quem aponta para ele
            document.querySelectorAll(`[aria-describedby~="${CSS.escape(instructions.id)}"]`).forEach(el => {
                let ids = el.getAttribute('aria-describedby').split(' ').filter(id => id && id !== instructions.id);
                if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
                else el.removeAttribute('aria-describedby');
            });

            // Só tira do registro se a entrada ainda for desta instância.
            // (Depois de um destroy + init, a entrada passa a ser da instância nova:
            // um destroy repetido na instância antiga não pode apagar a nova)
            if (instances.get(key) === instance) instances.delete(key);
        }

        /**
         - Impede o "arrastar" nativo do navegador dentro dos cards
         - @param {DragEvent} e - Evento de arrastar nativo
         */
        function preventNativeDrag(e) {
            if (e.target.closest?.(options.draggable)) e.preventDefault();
        }

        /**
         - Função chamada quando o ponteiro (mouse, dedo ou caneta) é pressionado sobre um card.
         - Aqui ainda não se sabe se é clique ou arrasto, então nada visual muda:
         - só anota a posição do ponteiro e passa a escutar o movimento.
         - Quem começa o arrasto de verdade é o jtDragStart.
         - Não usa preventDefault: assim o duplo e o triplo clique continuam selecionando o texto do card.
         - @param {PointerEvent} e - Evento de ponteiro
         */
        function jtPointerDown(e) {
            if (e.button !== 0) return; // Apenas o botão principal (esquerdo no mouse; o toque e a caneta também são 0)
            if (!e.isPrimary) return; // Ignora o segundo dedo em toques com vários dedos
            if (activeCard) return; // Já tem um card sendo arrastado (por esta ou outra instância)

            // Sobe a partir do elemento clicado até achar um card. Se não achou, o clique foi fora de qualquer card
            let card = e.target.closest(options.draggable);
            if (!card) return;

            let cardHasHandle = hasHandle(card);

            if (cardHasHandle) {
                // Se o card tiver alça, o arrasto só começa por uma delas (pode ter mais de uma, ex.: ícone e título).
                // Fora das alças, o card é texto normal.
                // A pergunta é: "o clique foi em alguma alça que pertence a ESTE card?"
                let clickedHandle = e.target.closest(options.handle);
                let isOwnHandle = clickedHandle && card.contains(clickedHandle) && clickedHandle.closest(options.draggable) === card;
                if (!isOwnHandle) return;
            } else {
                // Sem alça: apertar num botão, link ou campo DENTRO do card não começa o arrasto.
                // (O próprio card pode ser um link: aí ele continua arrastando, por isso o "!== card")
                let interactive = e.target.closest(INTERACTIVE_ELEMENTS);
                if (interactive && interactive !== card && card.contains(interactive)) return;
            }

            currentCard = card; // Armazena o card que foi clicado
            activeCard = card;
            pointerId = e.pointerId;

            // Armazena onde o ponteiro estava (na janela), para medir quanto ele andou depois
            pressX = e.clientX;
            pressY = e.clientY;

            // Adiciona eventos para mover e finalizar o arrasto.
            // Passam por um filtro: só o ponteiro que pegou o card manda no arrasto
            document.addEventListener('pointermove', onOwnPointerMove);
            document.addEventListener('pointerup', onOwnPointerEnd);
            document.addEventListener('pointercancel', onOwnPointerEnd); // O navegador pode cancelar o toque (ex.: uma notificação, um gesto do sistema)

            // No toque, em card sem alça: o arrasto só começa depois de segurar o dedo parado.
            // Um toque rápido deslizando o dedo continua rolando a página normalmente
            if (e.pointerType === 'touch' && !cardHasHandle) {
                longPressTimer = setTimeout(() => {
                    longPressTimer = null;
                    jtDragStart();
                    navigator.vibrate?.(20); // Vibração curta avisando que o card "pegou" (nos celulares que suportam)
                }, options.longPressDelay);

                // Depois que o arrasto começa, o movimento do dedo não pode rolar a página.
                // passive: false é obrigatório, senão o navegador ignora o preventDefault do touchmove
                document.addEventListener('touchmove', preventTouchScroll, { passive: false });

                // Segurar o dedo também abre o menu de contexto no celular
                document.addEventListener('contextmenu', preventContextMenu);
            }
        }

        /**
         - Repassa o pointermove para o jtDragMove só se vier do ponteiro que pegou o card.
         - Os listeners estão no document e recebem eventos de TODOS os ponteiros: sem este filtro,
         - um segundo dedo (ou mouse e caneta juntos) movia o card
         - @param {PointerEvent} e - Evento de ponteiro
         */
        function onOwnPointerMove(e) {
            if (e.pointerId === pointerId) jtDragMove(e);
        }

        /**
         - O mesmo filtro para pointerup/pointercancel: tirar o segundo dedo da tela não solta o card.
         - (O destroy e o Esc chamam o jtDragEnd direto, com um evento { type: 'pointercancel' } sem pointerId)
         - @param {PointerEvent} e - Evento de ponteiro
         */
        function onOwnPointerEnd(e) {
            if (e.pointerId === pointerId) jtDragEnd(e);
        }

        /**
         - Descobre se o card tem pelo menos uma alça.
         - Só valem as alças que pertencem a este card (e não as de um card que esteja dentro dele)
         - @param {HTMLElement} card - Elemento do card
         - @returns {boolean}
         */
        function hasHandle(card) {
            return [...card.querySelectorAll(options.handle)].some(handle =>
                handle.closest(options.draggable) === card
            );
        }

        /**
         - Impede a rolagem da página pelo toque, mas só enquanto um card está sendo arrastado
         - @param {TouchEvent} e - Evento de toque
         */
        function preventTouchScroll(e) {
            if (isDragging) e.preventDefault();
        }

        /**
         - Impede o menu de contexto do long press
         - @param {MouseEvent} e - Evento do menu de contexto
         */
        function preventContextMenu(e) {
            e.preventDefault();
        }

        /**
         - Começa o arrasto de fato. Roda uma única vez, quando o ponteiro passa do
         - dragThreshold (chamada pelo jtDragMove) ou quando termina o long press (chamada pelo timer do jtPointerDown).
         */
        function jtDragStart() {
            isDragging = true;

            // "Prende" o ponteiro no card: mesmo que ele saia do card ou da janela, os eventos continuam
            // chegando (e o pointerup não se perde). Só agora, e não no pointerdown: com a captura,
            // o navegador manda o click para o card, e um clique simples num botão do card se perderia.
            // try/catch: o navegador recusa se o ponteiro já não estiver mais pressionado
            try {
                currentCard.setPointerCapture(pointerId);
            } catch {}

            // Como o pointerdown não usa preventDefault, uma seleção de texto pode ter começado
            // no caminho até o threshold: tira essa seleção e bloqueia novas até o fim do arrasto.
            // Guarda o valor que o body tinha, para devolver no fim
            window.getSelection()?.removeAllRanges();
            previousUserSelect = document.body.style.userSelect;
            previousWebkitUserSelect = document.body.style.webkitUserSelect;
            document.body.style.userSelect = 'none';
            document.body.style.webkitUserSelect = 'none'; // Safari

            cardWidth = currentCard.offsetWidth; // Armazena a largura do Elemento (com padding e borda, igual ao border-box)
            cardHeight = currentCard.offsetHeight; // Armazena a altura do Elemento (com padding e borda, igual ao border-box)

            // Armazena a dropzone e a posição originais do card (para o evento jt-drop dizer de onde ele saiu).
            // A posição é calculada antes de criar o clone, para o clone não entrar na conta
            originalDropzone = currentCard.parentElement;
            originalIndex = getCardIndex(currentCard);

            // Posição do card na janela (já considera o scroll da coluna e da página)
            let rect = currentCard.getBoundingClientRect();
            let cardStyle = getComputedStyle(currentCard); // Estilos finais do card, para ler a margem

            // Posição inicial do card na janela (o mesmo sistema do position: fixed e do clientX/Y).
            // Desconta a margem, porque o style.left/top posiciona a borda de fora da margem
            let initialCardX = rect.left - parseFloat(cardStyle.marginLeft);
            let initialCardY = rect.top - parseFloat(cardStyle.marginTop);

            // Cria um clone do card
            createCloneCard(currentCard);

            // Guarda os estilos inline que o card já tinha, para devolver no fim do arrasto
            saveInlineStyles(currentCard);

            // Define a posição fixa e tamanho do card para permitir arrasto.
            // fixed = posicionado sempre em relação à janela, não importa o position dos pais
            // (com absolute, um pai com position: relative mudava a referência e o card pulava)
            currentCard.style.position = 'fixed';
            currentCard.style.top = initialCardY + 'px'; // top/left são definidos uma vez só, aqui.
            currentCard.style.left = initialCardX + 'px'; // Durante o movimento, quem anda é o translate
            // offsetWidth/offsetHeight incluem padding e borda: só batem com width/height em border-box.
            // Sem isto, um card com box-sizing: content-box "inchava" ao ser pego
            currentCard.style.boxSizing = 'border-box';
            currentCard.style.width = cardWidth + 'px';
            currentCard.style.height = cardHeight + 'px';
            currentCard.style.zIndex = '1000'; // O card arrastado passa por cima dos outros elementos
            currentCard.style.pointerEvents = 'none'; // O ponteiro "atravessa" o card, para o elementFromPoint enxergar o que está embaixo dele

            // Um pai com transform, filter, perspective, contain ou will-change muda a referência do fixed
            // (ele passa a ser relativo a esse pai), e o card pulava. Mede onde o card foi parar e
            // compensa a diferença. Também corrige cards com margin: auto (que vira 0 no fixed).
            // Limitação: compensa deslocamento, não escala (um pai com transform: scale ainda distorce)
            let placed = currentCard.getBoundingClientRect();
            let offsetX = rect.left - placed.left;
            let offsetY = rect.top - placed.top;
            if (Math.abs(offsetX) > 0.5 || Math.abs(offsetY) > 0.5) { // Ignora diferenças de arredondamento
                currentCard.style.left = (initialCardX + offsetX) + 'px';
                currentCard.style.top = (initialCardY + offsetY) + 'px';
            }

            // O overflow das áreas é lido uma vez por arrasto (o auto-scroll consulta a cada quadro)
            overflowCache = new WeakMap();

            // Liga as classes de arrasto, para quem usa a lib estilizar como quiser no CSS
            // (ex.: na demo, card "levantado" e cursor de "agarrando" na página toda)
            currentCard.classList.add('jt-dragging');
            document.body.classList.add('jt-dragging-active');

            // Auto-scroll: um "laço" que roda a cada quadro da tela enquanto o arrasto durar
            lastX = pressX;
            lastY = pressY;
            if (options.autoScroll) autoScrollFrame = requestAnimationFrame(autoScrollStep);

            // Se alguma área rolar durante o arrasto (auto-scroll ou roda do mouse), o ponteiro fica parado,
            // mas o que está embaixo dele muda: atualiza o fantasma e o destaque.
            // capture: true porque o evento de rolagem não "sobe" pelos pais: só dá para pegar na descida
            document.addEventListener('scroll', onScrollDuringDrag, { capture: true, passive: true });

            notifyDragStart();
        }

        /**
         - Avisa quem usa a lib que o arrasto começou (ex.: pausar atualizações automáticas da página).
         - Usada pelo arrasto com ponteiro e pelo arrasto com teclado
         */
        function notifyDragStart() {
            emit('jt-drag-start', currentCard, {
                card: currentCard,
                from: originalDropzone,
                index: originalIndex,
            }, options.onDragStart);
        }

        /**
         - Função chamada enquanto o ponteiro se move pressionado
         - @param {PointerEvent} e - Evento de ponteiro
         */
        function jtDragMove(e) {
            if (!currentCard) return;

            if (!isDragging) {
                // Distância entre a posição atual e a do pointerdown (Pitágoras)
                let distance = Math.hypot(e.clientX - pressX, e.clientY - pressY);
                if (distance < options.dragThreshold) return; // Ainda é um clique, não um arrasto

                // Estava esperando o long press e o dedo andou antes do tempo: é rolagem, não arrasto
                if (longPressTimer) {
                    jtDragEnd(e);
                    return;
                }

                jtDragStart();
            }

            // Quanto o ponteiro andou desde o pointerdown
            let deltaX = e.clientX - pressX;
            let deltaY = e.clientY - pressY;

            // Desloca o card a partir da posição inicial, usando a propriedade translate.
            // translate não recalcula o layout da página (top/left recalculam a cada movimento),
            // e é separada do transform, então não briga com o transform: scale() do CSS
            currentCard.style.translate = deltaX + 'px ' + deltaY + 'px';

            lastX = e.clientX;
            lastY = e.clientY;
            scheduleDropTargetUpdate();
        }

        /**
         - Agenda o recálculo da dropzone e do clone para o próximo quadro da tela.
         - O pointermove pode disparar centenas de vezes por segundo (mouses de 1000 Hz), e cada
         - recálculo lê o layout de todos os cards logo depois de o clone mudar de lugar (reflow forçado).
         - A tela só desenha ~60 vezes por segundo: recalcular mais do que isso é trabalho jogado fora.
         - O translate do card continua sendo aplicado na hora (é barato e mantém o card colado ao ponteiro).
         - O drop não depende disto: o jtDragEnd recalcula tudo na hora, com a posição do pointerup
         */
        function scheduleDropTargetUpdate() {
            if (dropTargetFrame) return; // Já tem um agendado: ele usa o lastX/lastY mais recentes
            dropTargetFrame = requestAnimationFrame(() => {
                dropTargetFrame = null;
                if (isDragging) updateDropTarget(lastX, lastY);
            });
        }

        /**
         - Atualiza tudo que depende do que está embaixo do ponteiro: destaca a dropzone,
         - marca a que recusou (se for o caso) e move o clone para onde o card vai cair se soltar agora
         - @param {number} x - Posição X do ponteiro na janela (clientX)
         - @param {number} y - Posição Y do ponteiro na janela (clientY)
         */
        function updateDropTarget(x, y) {
            let { dropzone, refused } = getDropzoneAt(x, y);
            updateDropzoneHighlight(dropzone);
            updateRefusedHighlight(refused);
            updateClonePosition(dropzone, x, y);
        }

        /**
         - Chamada quando qualquer área da página rola durante o arrasto
         */
        function onScrollDuringDrag() {
            if (isDragging) scheduleDropTargetUpdate();
        }

        /**
         - Um passo do auto-scroll. Roda a cada quadro da tela (requestAnimationFrame) enquanto o arrasto durar.
         - Procura, a partir do elemento embaixo do ponteiro e subindo pelos pais, a primeira área com rolagem
         - em que o ponteiro está perto da borda e que ainda consegue rolar naquela direção.
         - Se nenhuma conseguir (ex.: a coluna já está no fim), tenta rolar a janela
         */
        function autoScrollStep() {
            autoScrollFrame = requestAnimationFrame(autoScrollStep); // Agenda o próximo passo

            for (let el = document.elementFromPoint(lastX, lastY); el && el !== document.body; el = el.parentElement) {
                if (isScrollable(el) && scrollIfNearEdge(el, el.getBoundingClientRect())) return;
            }

            // A janela: a "área" é a tela inteira. Funciona até com o ponteiro fora da janela
            // (o setPointerCapture continua mandando a posição dele)
            let viewport = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
            scrollIfNearEdge(document.scrollingElement, viewport);
        }

        /**
         - Rola a área se o ponteiro estiver perto de uma das bordas dela.
         - Quanto mais perto da borda (ou além dela), mais rápido, até o máximo de scrollSpeed
         - @param {Element} el - Área com rolagem
         - @param {{top: number, left: number, bottom: number, right: number}} rect - Posição da área na janela
         - @returns {boolean} true se rolou (se a área já estava no limite, não rola e devolve false)
         */
        function scrollIfNearEdge(el, rect) {
            let edge = options.scrollEdge;

            // Velocidade proporcional à distância "para dentro" da faixa da borda
            let speed = (distance) => Math.min(options.scrollSpeed, Math.ceil((distance / edge) * options.scrollSpeed));

            let dy = 0, dx = 0;
            if (lastY < rect.top + edge) dy = -speed(rect.top + edge - lastY);
            else if (lastY > rect.bottom - edge) dy = speed(lastY - (rect.bottom - edge));
            if (lastX < rect.left + edge) dx = -speed(rect.left + edge - lastX);
            else if (lastX > rect.right - edge) dx = speed(lastX - (rect.right - edge));

            if (!dx && !dy) return false;

            let beforeTop = el.scrollTop, beforeLeft = el.scrollLeft;
            el.scrollTop += dy;
            el.scrollLeft += dx;
            return el.scrollTop !== beforeTop || el.scrollLeft !== beforeLeft;
        }

        /**
         - Descobre se o elemento tem rolagem própria (overflow auto/scroll e conteúdo maior que ele).
         - O overflow vem do cache (o CSS não muda no meio do arrasto, e o getComputedStyle a cada quadro,
         - em cada pai, custa caro). O tamanho do conteúdo é medido sempre, porque muda com o clone
         - @param {Element} el - Elemento
         - @returns {boolean}
         */
        function isScrollable(el) {
            let overflow = overflowCache.get(el);
            if (!overflow) {
                let style = getComputedStyle(el);
                overflow = {
                    y: /(auto|scroll|overlay)/.test(style.overflowY),
                    x: /(auto|scroll|overlay)/.test(style.overflowX),
                };
                overflowCache.set(el, overflow);
            }
            return (overflow.y && el.scrollHeight > el.clientHeight) || (overflow.x && el.scrollWidth > el.clientWidth);
        }

        /**
         - Move o clone (o "fantasma") para o lugar onde o card vai cair.
         - Dentro de uma dropzone: entre os cards, de acordo com a posição do ponteiro.
         - Fora de qualquer dropzone: volta para o lugar de origem (logo antes do card, que ainda está lá no DOM)
         - @param {HTMLElement|null} dropzone - Dropzone embaixo do ponteiro, ou null
         - @param {number} x - Posição X do ponteiro na janela (clientX)
         - @param {number} y - Posição Y do ponteiro na janela (clientY)
         */
        function updateClonePosition(dropzone, x, y) {
            if (!dropzone) {
                if (cardClone.nextElementSibling !== currentCard) currentCard.before(cardClone);
                return;
            }

            let beforeElement = getElementAfterPointer(dropzone, x, y);

            // Próximo irmão do clone, pulando o card arrastado (ele continua no DOM, só está "flutuando" com fixed)
            let next = cardClone.nextElementSibling;
            if (next === currentCard) next = next.nextElementSibling;

            // O clone já está no lugar certo: não mexe no DOM (o pointermove dispara dezenas de vezes por segundo)
            if (cardClone.parentElement === dropzone && next === beforeElement) return;

            // insertBefore com null coloca no fim, igual ao appendChild
            dropzone.insertBefore(cardClone, beforeElement);
        }

        /**
         - Descobre antes de qual elemento da dropzone o card arrastado deve entrar.
         - Os pontos de referência são os filhos diretos da dropzone que são cards ou que são
         - (ou têm dentro) outra dropzone. Títulos e outros textos são ignorados, para o card
         - nunca cair acima do título da coluna.
         - Percorre esses elementos na ordem e devolve o primeiro que está "depois" do ponteiro.
         - A regra depende do formato da dropzone:
         - - Lista (um card por linha): o ponteiro está acima do meio do elemento.
         -   Só a altura importa, então a troca acontece ao passar do meio do card vizinho,
         -   não importa se o ponteiro está no lado esquerdo ou direito dele
         - - Grade ou linha (vários por linha):
         -   - na mesma linha do ponteiro: o ponteiro está antes do meio do elemento
         -     (à esquerda; ou à direita em dropzones da direita para a esquerda, direction: rtl)
         -   - em outra linha: o ponteiro está acima do meio do elemento
         - @param {HTMLElement} dropzone - Dropzone embaixo do ponteiro
         - @param {number} x - Posição X do ponteiro na janela (clientX)
         - @param {number} y - Posição Y do ponteiro na janela (clientY)
         - @returns {HTMLElement|null} O elemento, ou null se o card arrastado deve ir para o fim
         */
        function getElementAfterPointer(dropzone, x, y) {
            // Filhos diretos desta dropzone (os cards de dropzones de dentro não contam),
            // tirando o clone e o próprio card arrastado
            let references = [...dropzone.children].filter(el =>
                el !== cardClone && el !== currentCard &&
                (el.matches(options.draggable) || el.matches(options.dropzone) || el.querySelector(options.dropzone))
            );
            let rects = references.map(el => el.getBoundingClientRect());

            // Lista: só a altura decide
            if (!isMultiColumn(dropzone, rects)) {
                let index = rects.findIndex(rect => y < rect.top + rect.height / 2);
                return index === -1 ? null : references[index];
            }

            // Grade ou linha
            let isRtl = getComputedStyle(dropzone).direction === 'rtl';
            let index = rects.findIndex(rect => {
                let middleX = rect.left + rect.width / 2;
                let sameRow = y >= rect.top && y <= rect.bottom;

                if (!sameRow) return y < rect.top + rect.height / 2;
                return isRtl ? x > middleX : x < middleX;
            });
            return index === -1 ? null : references[index];
        }

        /**
         - Descobre se a dropzone coloca vários itens por linha (grade, linha horizontal)
         - ou um embaixo do outro (lista).
         - 1. Pela posição dos itens: se algum começa antes de o anterior terminar (em altura),
         -    os dois estão lado a lado. Pega qualquer layout, até inline-block e float.
         - 2. Com menos de dois itens não dá para comparar posições: aí decide pelo CSS da dropzone
         -    (flex em linha, ou grid com mais de uma coluna). Sem isso, uma grade com um item só
         -    seria tratada como lista
         - @param {HTMLElement} dropzone - Dropzone
         - @param {DOMRect[]} rects - Posições dos itens de referência, na ordem do HTML
         - @returns {boolean} true = vários por linha; false = lista
         */
        function isMultiColumn(dropzone, rects) {
            for (let i = 1; i < rects.length; i++) {
                if (rects[i].top < rects[i - 1].bottom - 1) return true; // -1: tolera arredondamento de pixel
            }
            if (rects.length > 1) return false;

            let style = getComputedStyle(dropzone);
            if (style.display.includes('flex')) return style.flexDirection.startsWith('row');
            if (style.display.includes('grid')) return style.gridTemplateColumns.trim().split(/\s+/).length > 1;
            return false;
        }

        /**
         - Descobre qual dropzone está num ponto da tela: pega o elemento mais na frente
         - naquele ponto e sobe pelos pais até achar uma dropzone que aceite o card.
         - Se a dropzone mais de dentro recusar, continua subindo (ex.: uma dropzone que recusa,
         - dentro de uma coluna que aceita: o card cai na coluna)
         - @param {number} x - Posição X na janela (clientX)
         - @param {number} y - Posição Y na janela (clientY)
         - @returns {{ dropzone: HTMLElement|null, refused: HTMLElement|null }}
         -   dropzone: onde o card pode cair (ou null);
         -   refused: a dropzone embaixo do ponteiro, se ela recusou o card (ou null)
         */
        function getDropzoneAt(x, y) {
            let elementBelow = document.elementFromPoint(x, y);
            let first = elementBelow?.closest(options.dropzone) ?? null;

            let dropzone = first;
            while (dropzone && !canDrop(dropzone)) {
                dropzone = dropzone.parentElement?.closest(options.dropzone) ?? null;
            }

            // A dropzone embaixo do ponteiro conta como "recusada" só se ela existe, não aceitou
            // e não está dentro do próprio card (essas nem aparecem como opção)
            let refused = first && first !== dropzone && !currentCard?.contains(first) ? first : null;
            return { dropzone, refused };
        }

        /**
         - Decide se o card arrastado pode cair nesta dropzone
         - @param {HTMLElement} dropzone - Dropzone candidata
         - @returns {boolean}
         */
        function canDrop(dropzone) {
            // O card não pode cair dentro de si mesmo (se ele tiver dropzones dentro)
            if (currentCard.contains(dropzone)) return false;

            // A dropzone de origem sempre aceita o card de volta (senão ele não poderia nem ser reordenado)
            if (dropzone === originalDropzone) return true;

            // Grupos: o card só cai em dropzones do mesmo grupo.
            // O grupo do card é o data-jt-group dele; se não tiver, herda o da dropzone de onde saiu.
            // Sem grupo nos dois (undefined === undefined), vale tudo
            let cardGroup = currentCard.dataset.jtGroup ?? originalDropzone?.dataset.jtGroup;
            if (dropzone.dataset.jtGroup !== cardGroup) return false;

            // Regra livre de quem usa a lib (opção accepts): precisa devolver true para aceitar.
            // Se ela der erro, recusa (é mais seguro do que deixar o card cair onde não devia)
            if (typeof options.accepts === 'function') {
                try {
                    return Boolean(options.accepts(currentCard, dropzone, originalDropzone));
                } catch (error) {
                    console.error('[JetDnD] erro na função accepts:', error);
                    return false;
                }
            }

            return true;
        }

        /**
         - Troca a marcação de "recusada" (classe .jt-dropzone-refused) para a dropzone informada
         - @param {HTMLElement|null} dropzone - Dropzone que recusou o card, ou null para tirar a marcação
         */
        function updateRefusedHighlight(dropzone) {
            if (dropzone === currentRefused) return;

            currentRefused?.classList.remove('jt-dropzone-refused');
            dropzone?.classList.add('jt-dropzone-refused');
            currentRefused = dropzone;
        }

        /**
         - Troca o destaque (classe .jt-dropzone-over) para a dropzone informada.
         - Só mexe no DOM quando a dropzone muda, e não a cada movimento do ponteiro
         - @param {HTMLElement|null} dropzone - Dropzone a destacar, ou null para tirar o destaque
         */
        function updateDropzoneHighlight(dropzone) {
            if (dropzone === currentDropzone) return; // Continua na mesma: nada a fazer

            currentDropzone?.classList.remove('jt-dropzone-over'); // Tira da anterior (se tinha)
            dropzone?.classList.add('jt-dropzone-over'); // Coloca na nova (se tem)
            currentDropzone = dropzone;
        }

        /**
         - Função chamada quando o arrasto termina (pointerup) ou é cancelado pelo navegador (pointercancel).
         - O destroy também chama com { type: 'pointercancel' } para cancelar um arrasto em andamento
         - @param {PointerEvent} e - Evento de ponteiro
         */
        function jtDragEnd(e) {
            document.removeEventListener('pointermove', onOwnPointerMove);
            document.removeEventListener('pointerup', onOwnPointerEnd);
            document.removeEventListener('pointercancel', onOwnPointerEnd);
            document.removeEventListener('touchmove', preventTouchScroll);
            document.removeEventListener('contextmenu', preventContextMenu);

            // Se ainda estava esperando o long press (soltou o dedo antes do tempo), cancela a espera
            clearTimeout(longPressTimer);
            longPressTimer = null;

            let card = currentCard;
            let wasDragging = isDragging;
            let dropped = false; // true = o card tomou o lugar do clone (o drop chegou até o fim sem erro)

            try {
                // Só faz o drop se o arrasto começou de fato (num clique simples, nada muda)
                if (wasDragging) {
                    // Descobre a dropzone embaixo do ponteiro.
                    // Se o navegador cancelou, não procura dropzone: o card volta para onde estava
                    let dropzone = e.type === 'pointercancel' ? null : getDropzoneAt(e.clientX, e.clientY).dropzone;

                    // Garante que o clone está no lugar final (dentro da dropzone, ou de volta à origem se soltou fora)
                    updateClonePosition(dropzone, e.clientX, e.clientY);

                    // O card toma o lugar do clone
                    cardClone.replaceWith(card);
                    dropped = true;
                }
            } finally {
                // finally roda SEMPRE, mesmo se algo acima der erro.
                // Assim a lib nunca fica "travada" achando que ainda tem um arrasto em andamento
                // (se der erro antes do replaceWith, o card nunca saiu do lugar no DOM: ele só volta a aparecer lá)
                if (wasDragging) {
                    deleteCloneCard();
                    updateDropzoneHighlight(null);
                    updateRefusedHighlight(null);

                    // Para o auto-scroll, o recálculo agendado e o acompanhamento da rolagem
                    cancelAnimationFrame(autoScrollFrame);
                    autoScrollFrame = null;
                    cancelAnimationFrame(dropTargetFrame);
                    dropTargetFrame = null;
                    document.removeEventListener('scroll', onScrollDuringDrag, { capture: true });

                    resetDragStyles(card);

                    // Ao soltar, o navegador dispara um click no card. Cancela esse click
                    // (capture: true = pega o click antes de qualquer outro listener da página).
                    // Se o click não vier (ex.: soltou longe do card), o setTimeout tira o bloqueio logo em seguida
                    window.addEventListener('click', preventClick, { capture: true, once: true });
                    setTimeout(() => window.removeEventListener('click', preventClick, { capture: true }), 0);
                }

                // Volta ao estado PARADO, tanto depois de um clique quanto de um arrasto
                currentCard = null;
                activeCard = null;
                pointerId = null;
                isDragging = false;
            }

            // Num clique simples (sem arrasto), não avisa ninguém
            if (wasDragging) notifyDragEnd(card, dropped);
        }

        /**
         - Avisa quem usa a lib que o arrasto terminou (e que houve um drop, se o card mudou de lugar).
         - Usada pelo arrasto com ponteiro e pelo arrasto com teclado
         - @param {HTMLElement} card - O card que foi arrastado
         - @param {boolean} dropped - true se o card foi solto (false = cancelado ou deu erro: ele está na origem)
         */
        function notifyDragEnd(card, dropped) {
            // Onde o card ficou (se não foi solto, ele continua na origem)
            let newDropzone = dropped ? card.parentElement : originalDropzone;
            let newIndex = dropped ? getCardIndex(card) : originalIndex;
            let changed = dropped && (newDropzone !== originalDropzone || newIndex !== originalIndex);

            let detail = {
                card: card,              // O card que foi movido
                from: originalDropzone,  // Dropzone de onde ele saiu
                to: newDropzone,         // Dropzone onde ele caiu
                oldIndex: originalIndex, // Posição antiga (0 = primeiro card da dropzone)
                newIndex: newIndex,      // Posição nova
            };

            // Se o card mudou de dropzone ou de posição, avisa quem usa a lib, nesta ordem:
            // 1. a função do data-jt-drop da dropzone de destino; 2. o onDrop do init; 3. o evento jt-drop.
            // (Soltou fora, cancelou ou soltou no mesmo lugar: nada mudou, então o drop não é avisado)
            if (changed) {
                callDropzoneFunction(newDropzone, detail, options);
                emit('jt-drop', card, detail, options.onDrop);
            }

            // O fim do arrasto é avisado sempre (mudou ou não), com changed dizendo se mudou
            emit('jt-drag-end', card, { ...detail, changed }, options.onDragEnd);
        }

        /**
         - Desfaz os estilos inline e as classes colocados durante o arrasto,
         - para o card (e o body) voltarem a ser como eram antes
         - @param {HTMLElement} card - Elemento do card
         */
        function resetDragStyles(card) {
            restoreInlineStyles(card);
            card.classList.remove('jt-dragging');

            // Devolve o user-select que o body tinha antes do arrasto
            document.body.style.userSelect = previousUserSelect;
            document.body.style.webkitUserSelect = previousWebkitUserSelect;
            document.body.classList.remove('jt-dragging-active');
        }

        /**
         - Guarda os valores inline (e a prioridade !important) que o card tinha nas propriedades
         - que a lib vai usar. Antes, o fim do arrasto removia essas propriedades, apagando
         - estilos que a pessoa tinha colocado no card (ex.: style="z-index: 5")
         - @param {HTMLElement} card - Elemento do card
         */
        function saveInlineStyles(card) {
            savedInlineStyles = DRAG_STYLE_PROPS.map(prop =>
                [prop, card.style.getPropertyValue(prop), card.style.getPropertyPriority(prop)]
            );
        }

        /**
         - Devolve exatamente o que o card tinha em cada propriedade (ou remove, se não tinha nada)
         - @param {HTMLElement} card - Elemento do card
         */
        function restoreInlineStyles(card) {
            for (let [prop, value, priority] of savedInlineStyles ?? []) {
                if (value) card.style.setProperty(prop, value, priority);
                else card.style.removeProperty(prop);
            }
            savedInlineStyles = null;
        }

        /**
         - Descobre a posição de um card entre os cards da sua dropzone (sem contar o clone)
         - @param {HTMLElement} card - Elemento do card
         - @returns {number} Posição do card (0 = primeiro)
         */
        function getCardIndex(card) {
            return getCards(card.parentElement).indexOf(card);
        }

        /**
         - Lista os cards que são filhos diretos de uma dropzone (sem contar o clone)
         - @param {HTMLElement} dropzone - Dropzone
         - @returns {HTMLElement[]}
         */
        function getCards(dropzone) {
            return [...dropzone.children].filter(el => el.matches(options.draggable) && el !== cardClone);
        }

        // ---------- Teclado ----------

        /**
         - Deixa focáveis pelo Tab os cards (ou as alças, se o card tiver) dentro de um elemento,
         - e liga as instruções para leitores de tela (aria-describedby).
         - Elementos que já são focáveis (link, botão...) ou que já têm tabindex não são alterados.
         - O data-jt-tabindex marca (com o id da instância) o tabindex que a lib colocou, para o destroy desfazer só isso
         - @param {Element|Document} root - Onde procurar (a página inteira, ou um elemento recém-adicionado)
         */
        function prepareFocusTargets(root) {
            if (!options.keyboard) return;

            let cards = [...root.querySelectorAll(options.draggable)];
            if (root.matches?.(options.draggable)) cards.unshift(root);

            // O elemento adicionado pode ser uma ALÇA dentro de um card que já existia:
            // aí o card dono precisa ser revisto (o foco passa do card para a alça)
            let owner = root.parentElement?.closest(options.draggable);
            if (owner) cards.push(owner);

            cards.forEach(card => {
                if (card.closest('.jt-clone')) return; // O clone (e tudo dentro dele) é só visual

                // O card ganhou alça: o tabindex que esta instância colocou nele não faz mais sentido
                if (card.getAttribute('data-jt-tabindex') === uid && hasHandle(card)) {
                    card.removeAttribute('tabindex');
                    card.removeAttribute('data-jt-tabindex');
                }

                getFocusTargets(card).forEach(target => {
                    let nativelyFocusable = target.matches('a[href], button, input, select, textarea, [contenteditable]:not([contenteditable="false"])');
                    if (!nativelyFocusable && !target.hasAttribute('tabindex')) {
                        target.setAttribute('tabindex', '0');
                        target.setAttribute('data-jt-tabindex', uid);
                    }

                    let ids = (target.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
                    if (!ids.includes(instructions.id)) {
                        target.setAttribute('aria-describedby', [...ids, instructions.id].join(' '));
                    }
                });
            });
        }

        /**
         - Descobre quem recebe o foco num card: as alças dele (se tiver) ou o próprio card
         - @param {HTMLElement} card - Elemento do card
         - @returns {HTMLElement[]}
         */
        function getFocusTargets(card) {
            if (!hasHandle(card)) return [card];
            return [...card.querySelectorAll(options.handle)].filter(handle =>
                handle.closest(options.draggable) === card
            );
        }

        /**
         - Teclas pressionadas na página.
         - Esc cancela um arrasto com o ponteiro. Com o teclado:
         - Espaço pega o card focado; durante o arrasto, setas movem, Espaço/Enter solta e Esc cancela
         - @param {KeyboardEvent} e - Evento de teclado
         */
        function jtKeyDown(e) {
            // Tecla já tratada (por outra instância da lib ou pela página): não trata de novo.
            // Sem isso, com duas instâncias vendo o mesmo card, o Espaço que SOLTAVA o card
            // numa instância era usado para PEGAR o card de novo na outra.
            // Teclas durante a composição de um IME (japonês, chinês...) também não são comandos
            if (e.defaultPrevented || e.isComposing) return;

            // Esc durante um arrasto com o ponteiro: cancela (o card volta para onde estava)
            if (e.key === 'Escape' && isDragging) {
                e.preventDefault();
                let id = pointerId; // O jtDragEnd zera o pointerId: guarda antes
                jtDragEnd({ type: 'pointercancel' });
                blockClickOnRelease(id);
                return;
            }

            if (!options.keyboard) return;

            if (keyboardDragging) {
                // O card saiu da página no meio do arrasto (ex.: a página redesenhou a lista).
                // Antes, a próxima tecla dava TypeError e a lib ficava travada achando que ainda arrastava
                if (!currentCard.isConnected) {
                    abortKeyboardDrag();
                    return;
                }

                // As setas podem repetir (segurar ↓ desce vários cards), mas o Espaço/Enter não:
                // segurar o Espaço soltava e pegava o card várias vezes seguidas
                if ((e.key === ' ' || e.key === 'Enter') && e.repeat) {
                    e.preventDefault();
                    return;
                }

                // preventDefault: as setas e o Espaço não rolam a página enquanto o card está pego
                if (e.key === 'ArrowUp') { e.preventDefault(); keyboardMove('up'); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); keyboardMove('down'); }
                else if (e.key === 'ArrowLeft') { e.preventDefault(); keyboardMove('left'); }
                else if (e.key === 'ArrowRight') { e.preventDefault(); keyboardMove('right'); }
                else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); keyboardDrop(); }
                else if (e.key === 'Escape') { e.preventDefault(); keyboardCancel(); }
                return;
            }

            // Só o Espaço pega o card. (O Enter fica livre: num card que é link, ele abre o link).
            // Sem repetição (Espaço segurado) e sem Ctrl/Alt/Meta (costumam ser atalhos do sistema ou da página)
            if (e.key !== ' ' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || activeCard) return;

            let card = e.target.closest?.(options.draggable);
            if (!card || !getFocusTargets(card).includes(e.target)) return; // O foco precisa estar no card (ou na alça)

            e.preventDefault(); // Não rola a página (nem "clica" se a alça for um botão)
            keyboardPickUp(card, e.target);
        }

        /**
         - Depois de cancelar com Esc um arrasto com o ponteiro, o botão (ou dedo) continua pressionado.
         - Quando ele for solto, o navegador dispara um click no card, que abriria um card que é link.
         - Bloqueia esse click: espera o pointerup DESSE ponteiro e só então liga o preventClick.
         - Se o navegador cancelar o ponteiro (pointercancel), não vem click, e a espera é desfeita
         - @param {number} id - pointerId do ponteiro que estava arrastando
         */
        function blockClickOnRelease(id) {
            let onRelease = (ev) => {
                if (ev.pointerId !== id) return;
                document.removeEventListener('pointerup', onRelease, true);
                document.removeEventListener('pointercancel', onRelease, true);
                if (ev.type !== 'pointerup') return;
                window.addEventListener('click', preventClick, { capture: true, once: true });
                setTimeout(() => window.removeEventListener('click', preventClick, { capture: true }), 0);
            };
            document.addEventListener('pointerup', onRelease, true);
            document.addEventListener('pointercancel', onRelease, true);
        }

        /**
         - Pega o card pelo teclado
         - @param {HTMLElement} card - O card
         - @param {HTMLElement} target - O elemento com o foco (o card ou a alça)
         */
        function keyboardPickUp(card, target) {
            currentCard = card;
            activeCard = card;
            keyboardDragging = true;
            keyboardTarget = target;

            originalDropzone = card.parentElement;
            originalIndex = getCardIndex(card);
            originalNextSibling = card.nextSibling;

            // Mesmas classes do arrasto com ponteiro (o card não sai do lugar: ele anda pelo DOM a cada seta)
            card.classList.add('jt-dragging');
            updateDropzoneHighlight(originalDropzone);

            notifyDragStart();
            announce(options.messages.pickedUp);
        }

        /**
         - Move o card pego pelo teclado.
         - Cima/baixo: troca de posição com o card vizinho na mesma dropzone.
         - Esquerda/direita: vai para a dropzone anterior/seguinte (na ordem da página) que aceite o card,
         - mantendo a mesma posição (ou a última, se a outra dropzone tiver menos cards)
         - @param {'up'|'down'|'left'|'right'} direction - Direção
         */
        function keyboardMove(direction) {
            let card = currentCard;
            let dropzone = card.parentElement;
            let changedList = false;

            movingByKeyboard = true;
            try {
                if (direction === 'up' || direction === 'down') {
                    let cards = getCards(dropzone);
                    let index = cards.indexOf(card);
                    let neighbor = cards[direction === 'up' ? index - 1 : index + 1];
                    if (!neighbor) return; // Já está na ponta

                    if (direction === 'up') neighbor.before(card);
                    else neighbor.after(card);
                } else {
                    // Todas as dropzones da página, na ordem em que aparecem; procura a próxima que aceite o card
                    let dropzones = [...document.querySelectorAll(options.dropzone)];
                    let step = direction === 'left' ? -1 : 1;
                    let target = null;
                    for (let i = dropzones.indexOf(dropzone) + step; i >= 0 && i < dropzones.length; i += step) {
                        if (canDrop(dropzones[i])) {
                            target = dropzones[i];
                            break;
                        }
                    }
                    if (!target) return; // Nenhuma dropzone aceita o card nessa direção

                    let index = getCardIndex(card);
                    let targetCards = getCards(target);
                    if (index < targetCards.length) targetCards[index].before(card);
                    else if (targetCards.length) targetCards[targetCards.length - 1].after(card);
                    else target.append(card);
                    changedList = true;
                }
            } finally {
                movingByKeyboard = false;
            }

            // Mover o elemento no DOM pode tirar o foco dele: devolve o foco e mostra o card na tela
            keyboardTarget.focus({ preventScroll: true });
            keyboardTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });

            updateDropzoneHighlight(card.parentElement);
            announce(changedList ? options.messages.movedList : options.messages.moved);
        }

        /**
         - Solta o card pego pelo teclado onde ele está agora
         */
        function keyboardDrop() {
            let card = currentCard;
            announce(options.messages.dropped);
            finishKeyboardDrag();
            notifyDragEnd(card, true);
        }

        /**
         - Cancela o arrasto pelo teclado: o card volta para o lugar original
         - @param {boolean} restoreFocus - Devolver o foco ao card? (false quando o foco saiu por ação
         -   da pessoa, como Tab ou clique em outro lugar: aí o foco fica onde ela colocou)
         */
        function keyboardCancel(restoreFocus = true) {
            let card = currentCard;

            // O card saiu da página (a página o removeu): não traz de volta, só encerra
            if (!card.isConnected) {
                abortKeyboardDrag();
                return;
            }

            movingByKeyboard = true;
            try {
                if (originalDropzone.isConnected) {
                    // Volta para a posição original usando o originalIndex, e não o nó que vinha depois do card:
                    // se esse nó tivesse sido removido da página, o insertBefore dava NotFoundError.
                    // Sem o card arrastado na conta, o card na posição original é quem fica logo depois dele
                    let others = getCards(originalDropzone).filter(el => el !== card);
                    let reference = others[originalIndex] ?? null;
                    if (reference) reference.before(card);
                    else if (others.length) others[others.length - 1].after(card);
                    else originalDropzone.insertBefore(card, originalNextSibling?.parentNode === originalDropzone ? originalNextSibling : null);
                }
            } finally {
                movingByKeyboard = false;
            }
            if (restoreFocus) keyboardTarget?.focus({ preventScroll: true });

            announce(options.messages.canceled);
            finishKeyboardDrag();
            notifyDragEnd(card, false);
        }

        /**
         - Encerra o arrasto pelo teclado quando o card já não está na página.
         - Não tenta devolver o card (quem o removeu foi a página, e reinseri-lo brigaria com ela):
         - só volta ao estado parado e avisa o fim (changed: false, com from/oldIndex da origem)
         */
        function abortKeyboardDrag() {
            let card = currentCard;
            finishKeyboardDrag();
            notifyDragEnd(card, false);
        }

        /**
         - Volta ao estado PARADO depois de um arrasto pelo teclado
         */
        function finishKeyboardDrag() {
            currentCard.classList.remove('jt-dragging');
            updateDropzoneHighlight(null);
            currentCard = null;
            activeCard = null;
            keyboardDragging = false;
            keyboardTarget = null;
            originalNextSibling = null;
        }

        /**
         - Se o foco sair do card durante o arrasto pelo teclado (ex.: Tab, ou um clique em outro lugar),
         - cancela o arrasto. Ignora a perda de foco causada pela própria lib ao mover o card
         - @param {FocusEvent} e - Evento de perda de foco
         */
        function onFocusOut(e) {
            if (!keyboardDragging || movingByKeyboard || e.target !== keyboardTarget) return;
            keyboardCancel(false);
        }

        /**
         - Anuncia uma mensagem para leitores de tela, trocando {position} e {total}
         - pela posição atual do card e pelo total de cards na dropzone dele
         - @param {string} message - Mensagem (ex.: options.messages.moved)
         */
        function announce(message) {
            let parent = currentCard?.parentElement;
            if (!parent) return; // O card saiu da página: não há posição para anunciar
            let cards = getCards(parent);
            liveRegion.textContent = message
                .replace('{position}', cards.indexOf(currentCard) + 1)
                .replace('{total}', cards.length);
        }

        /**
         - Troca as mensagens dos leitores de tela (ex.: quando a página muda de idioma).
         - Só as mensagens informadas mudam; as outras continuam como estão
         - @param {Object} messages - Mensagens novas (mesmas chaves de DEFAULTS.messages)
         */
        function setMessages(messages) {
            Object.assign(options.messages, messages);
            instructions.textContent = options.messages.instructions;
        }

        /**
         - Função para criar um clone do card (o "fantasma" que mostra onde o card vai cair).
         - O clone não tem largura/altura fixas: ele se ajusta à dropzone onde estiver,
         - mostrando como o card vai ficar ali. A aparência vem da classe .jt-clone
         - @param {HTMLElement} card - Elemento do card
         */
        function createCloneCard (card) {
            cardClone = card.cloneNode(true);
            cardClone.classList.add('jt-clone'); // Gancho para estilizar o clone (padrão: opacity .5, no CSS injetado)
            cardClone.style.pointerEvents = 'none'; // O clone não deve ser interativo

            // O cloneNode copia tudo, inclusive id e name. Remove ANTES de colocar o clone na página:
            // - id repetido faz o getElementById achar o clone em vez do card;
            // - name repetido num radio marcado desmarca o radio original (regra de grupo de radio do navegador)
            cardClone.removeAttribute('id');
            cardClone.querySelectorAll('[id], [name]').forEach(el => {
                el.removeAttribute('id');
                el.removeAttribute('name');
            });

            // inert: o navegador ignora o clone para foco (Tab) e cliques.
            // aria-hidden: leitores de tela não leem o clone (ele é só visual)
            cardClone.inert = true;
            cardClone.setAttribute('aria-hidden', 'true');

            // iframe, vídeo e áudio: no clone, viram um espaço vazio do mesmo tamanho
            // (copiados, um iframe recarregaria a página dele e um vídeo com autoplay tocaria em dobro).
            // Feito ANTES de o clone entrar na página: fora dela, nada carrega nem toca
            let originalMedia = card.querySelectorAll(HEAVY_MEDIA);
            cardClone.querySelectorAll(HEAVY_MEDIA).forEach((media, i) => {
                let placeholder = document.createElement('div');
                placeholder.className = 'jt-clone-placeholder';
                placeholder.style.cssText = `display: inline-block; vertical-align: top; width: ${originalMedia[i].offsetWidth}px; height: ${originalMedia[i].offsetHeight}px;`;
                media.replaceWith(placeholder);
            });

            // O cloneNode não copia o desenho de um <canvas>: copia à mão, para o clone não ficar em branco
            let originalCanvases = card.querySelectorAll('canvas');
            cardClone.querySelectorAll('canvas').forEach((canvas, i) => {
                try {
                    canvas.getContext('2d')?.drawImage(originalCanvases[i], 0, 0);
                } catch {} // Canvas com contexto WebGL (ou já usado de outro jeito): o clone fica em branco, sem problema
            });

            card.before(cardClone); // Adiciona o clone ao DOM, logo antes do card (no lugar de onde ele sai)
        }

        /**
         - Função para remover o clone do card
         */
        function deleteCloneCard () {
            if (cardClone) {
                cardClone.remove();
                cardClone = null;
            }
        }
    }

    /**
     - Cancela um clique. Usado logo depois de um arrasto: ao soltar, o navegador dispara um "click"
     - no card, e um card que é link (ou tem onclick) seria aberto sem a pessoa querer.
     - Fica fora do init porque é igual para todas as instâncias
     - @param {MouseEvent} e - Evento de clique
     */
    function preventClick(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     - Avisa quem usa a lib que algo aconteceu, de duas formas:
     - 1. chamando a função da opção (ex.: onDrop), se ela existir;
     - 2. disparando o evento (ex.: jt-drop) no card, para quem usa addEventListener.
     - bubbles: true = o evento "sobe" pelos pais do card até o document,
     - então dá para escutar no document, numa coluna, num quadro inteiro...
     - Se o card já saiu da página (ex.: uma "lixeira" o removeu no data-jt-drop), disparar nele
     - não adianta: num elemento solto, o evento não sobe até o document. Aí o evento é disparado
     - na dropzone de destino (ou no document). O detail.card continua apontando para o card
     - @param {string} eventName - Nome do evento (ex.: 'jt-drop')
     - @param {HTMLElement} card - Card onde o evento é disparado
     - @param {Object} detail - Informações enviadas (as mesmas para a função e para o evento)
     - @param {Function|null} callback - Função da opção do init (ou null)
     */
    function emit(eventName, card, detail, callback) {
        safeCall(callback, detail, eventName);

        let target = card.isConnected ? card
            : detail.to?.isConnected ? detail.to
            : document;
        target.dispatchEvent(new CustomEvent(eventName, { bubbles: true, detail }));
    }

    /**
     - Chama a função do atributo data-jt-drop da dropzone, se tiver.
     - Ex.: <div class="jt-dropzone" data-jt-drop="marcarComoFeito"> chama marcarComoFeito(detail).
     - A função vem da opção actions do init ({ marcarComoFeito }) ou, com globalDropActions: true
     - (o padrão), de uma função global, igual às usadas no onclick="" do HTML.
     - Só busca pelo nome: nunca executa texto como código
     - @param {HTMLElement} dropzone - Dropzone de destino
     - @param {Object} detail - Informações do drop
     - @param {Object} options - Opções da instância
     */
    function callDropzoneFunction(dropzone, detail, options) {
        let name = dropzone.dataset.jtDrop; // data-jt-drop="..." vira dataset.jtDrop
        if (!name) return;

        let fn = resolveDropAction(name, options);
        if (!fn) {
            console.warn(`[JetDnD] data-jt-drop="${name}": nenhuma função com esse nome nas actions do init` +
                (options.globalDropActions ? ' nem entre as funções globais permitidas.' : '.'));
            return;
        }
        safeCall(fn, detail, `data-jt-drop="${name}"`);
    }

    /**
     - Descobre qual função um nome de data-jt-drop chama.
     - Buscar direto em window[name] deixava um atributo HTML chamar QUALQUER função global.
     - Se um dia o HTML tiver conteúdo vindo de usuários, isso vira uma porta para acionar
     - funções da página que não deveriam ser chamadas por um drop. Por isso, nesta ordem:
     - 1. as actions do init (lista do que é permitido);
     - 2. com globalDropActions: true, uma função global que seja da página (própria do window)
     -    e que não esteja em BLOCKED_GLOBALS
     - @param {string} name - Nome escrito no data-jt-drop
     - @param {Object} options - Opções da instância
     - @returns {Function|null} A função, ou null se o nome não é permitido
     */
    function resolveDropAction(name, options) {
        if (Object.hasOwn(options.actions, name) && typeof options.actions[name] === 'function') {
            return options.actions[name];
        }
        if (options.globalDropActions && !BLOCKED_GLOBALS.has(name) && Object.hasOwn(window, name)) {
            let fn = window[name];
            if (typeof fn === 'function') return fn;
        }
        return null;
    }

    /**
     - Chama uma função de quem usa a lib, sem deixar um erro dela quebrar a lib
     - (nem impedir as outras funções e eventos de serem avisados)
     - @param {Function|null} fn - Função a chamar (se não for função, não faz nada)
     - @param {Object} detail - Informações enviadas para a função
     - @param {string} name - Nome para identificar a função na mensagem de erro
     */
    function safeCall(fn, detail, name) {
        if (typeof fn !== 'function') return;
        try {
            fn(detail);
        } catch (error) {
            console.error(`[JetDnD] erro na função de "${name}":`, error);
        }
    }

    // A única coisa que a lib expõe para a página
    window.JetDnD = { init, version: '1.1.0' };

    // Com um bundler (webpack, Vite...) ou require(), a lib também funciona como módulo CommonJS
    if (typeof module === 'object' && module.exports) module.exports = window.JetDnD;
})();
