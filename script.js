// Variáveis globais para armazenar informações de arrasto
let startX = 0, startY = 0, initialCardX = 0, initialCardY = 0;
let currentCard = null;

// Seleciona todos os elementos que podem ser arrastados
const draggableCards = document.querySelectorAll('.jt-draggable');

// Adiciona o evento de início de arrasto para cada card
draggableCards.forEach(card => {
    card.addEventListener('mousedown', jtDragStart);
});

/**
 - Função chamada enquanto o card está sendo arrastado
 - @param {MouseEvent} e - Evento de mouse
 */
function jtDragStart(e) {
    e.preventDefault();
    currentCard = e.currentTarget; // Armazena o card que foi clicado
    cardWidth = currentCard.clientWidth; // Armazena a largura do Elemento
    cardHeight = currentCard.clientHeight; // Armazena a altura do Elemento

    initialCardX = currentCard.offsetLeft;
    initialCardY = currentCard.offsetTop;

    startX = e.pageX - initialCardX;
    startY = e.pageY - initialCardY;

    document.addEventListener('mousemove', jtDragMove);
    document.addEventListener('mouseup', jtDragEnd);
}

function jtDragMove(e) {
    if (!currentCard) return;

    currentCard.style.position = 'absolute';
    currentCard.style.width = cardWidth + 'px';
    currentCard.style.height = cardHeight + 'px';

    let newX = e.pageX - startX;
    let newY = e.pageY - startY;

    currentCard.style.top = newY + 'px';
    currentCard.style.left = newX + 'px';
}

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

    // Se não estiver sobre nenhuma dropzone, volta ao estado inicial
    currentCard.style.position = 'static';
    currentCard.style.width = '100%';
    currentCard = null; // Reseta o card atual após soltar o mouse
}