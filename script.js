// Variáveis globais para armazenar informações de arrasto
let startX = 0, startY = 0, initialCardX = 0, initialCardY = 0;
let currentCard = null, cardClone = null, originalDropzone = null;

// Seleciona todos os elementos que podem ser arrastados
const draggableCards = document.querySelectorAll('.jt-draggable');

// Adiciona o evento de início de arrasto para cada card
draggableCards.forEach(card => {
    card.addEventListener('mousedown', jtDragStart);
});

/**
 - Função chamada quando o arrasto inicia
 - @param {MouseEvent} e - Evento de mouse
 */
function jtDragStart(e) {
    e.preventDefault();
    currentCard = e.currentTarget; // Armazena o card que foi clicado
    cardWidth = currentCard.clientWidth; // Armazena a largura do Elemento
    cardHeight = currentCard.clientHeight; // Armazena a altura do Elemento
    
    // Armazena a dropzone original do card
    originalDropzone = currentCard.parentElement;

    // Armazena a posição inicial do card
    initialCardX = currentCard.offsetLeft;
    initialCardY = currentCard.offsetTop;

    // Calcula a diferença entre a posição do mouse e a posição inicial do card
    startX = e.pageX - initialCardX;
    startY = e.pageY - initialCardY;

    // Cria um clone do card
    createCloneCard(currentCard);

    // Adiciona eventos para mover e finalizar o arrasto
    document.addEventListener('mousemove', jtDragMove);
    document.addEventListener('mouseup', jtDragEnd);
}

/**
 - Função chamada enquanto o card está sendo arrastado
 - @param {MouseEvent} e - Evento de mouse
 */
function jtDragMove(e) {
    if (!currentCard) return;

    // Define a posição absoluta e tamanho do card para permitir arrasto
    currentCard.style.position = 'absolute';
    currentCard.style.width = cardWidth + 'px';
    currentCard.style.height = cardHeight + 'px';

    // Calcula a nova posição do card baseado na posição do mouse
    let newX = e.pageX - startX;
    let newY = e.pageY - startY;

    // Atualiza a posição do card
    currentCard.style.top = newY + 'px';
    currentCard.style.left = newX + 'px';
}

/**
 - Função chamada quando o arrasto termina
 - @param {MouseEvent} e - Evento de mouse
 */
function jtDragEnd(e) {
    document.removeEventListener('mousemove', jtDragMove);
    document.removeEventListener('mouseup', jtDragEnd);

    // Verifica se o card está sobre alguma dropzone
    let dropzones = document.querySelectorAll('.jt-dropzone');
    let isOverDropzone = false;

    dropzones.forEach(dropzone => {
        let rect = dropzone.getBoundingClientRect();
        if (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        ) {
            isOverDropzone = true;
            dropzone.appendChild(currentCard); // Move o card para dentro da dropzone
        }
    });

    // Remove o clone após o arrasto terminar
    deleteCloneCard(currentCard);

    // Se não estiver sobre nenhuma dropzone, volta ao estado inicial
    currentCard.style.position = 'static';
    currentCard.style.width = '100%';
    currentCard = null; // Reseta o card atual após soltar o mouse
}

/**
 - Função para criar um clone do card
 - @param {HTMLElement} card - Elemento do card
 - @param {number} cardWidth - Largura do card
 - @param {number} cardHeight - Altura do card
 */
function createCloneCard (card) {
    cardClone = card.cloneNode(true);
    cardClone.style.opacity = '0.5'; // Torna o clone transparente
    cardClone.style.position = 'static';
    cardClone.style.width = cardWidth + 'px'
    cardClone.style.height = cardHeight + 'px'
    cardClone.style.pointerEvents = 'none'; // O clone não deve ser interativo
    originalDropzone.appendChild(cardClone); // Adiciona o clone ao DOM
}

/**
 - Função para remover o clone do card
 */
function deleteCloneCard (card) {
    if (cardClone) {
        cardClone.remove();
        cardClone = null;
    }
}