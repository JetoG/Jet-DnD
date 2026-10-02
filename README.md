# Jet DnD

🇧🇷 Português | [🇺🇸 English](README.en.md)

**Arraste e solte em JavaScript puro, sem dependências.** Um único arquivo, que funciona com mouse, toque e caneta, e também pelo teclado.

**[▶ Veja a demonstração ao vivo](https://jetog.github.io/Jet-DnD/)**

<!-- GIF da demonstração: gravar e colocar aqui -->

## Índice

- [Recursos](#recursos)
- [Instalação](#instalação)
- [Uso rápido](#uso-rápido)
- [Como funciona](#como-funciona)
- [Opções](#opções)
- [Reagindo ao arrasto](#reagindo-ao-arrasto)
- [Grupos e regras (onde cada card pode cair)](#grupos-e-regras-onde-cada-card-pode-cair)
- [Alça](#alça)
- [Teclado e acessibilidade](#teclado-e-acessibilidade)
- [Classes CSS para estilizar](#classes-css-para-estilizar)
- [API](#api)
- [Salvando a ordem (Django ou localStorage)](#salvando-a-ordem-django-ou-localstorage)
- [Compatibilidade](#compatibilidade)
- [Limitações conhecidas](#limitações-conhecidas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## Recursos

- **Sem dependências:** um arquivo, sem build, sem npm.
- **Mouse, toque e caneta** (Pointer Events). No celular, os cards sem alça arrastam com um toque longo e a página continua rolando normalmente.
- **Teclado e leitores de tela:** Tab, Espaço, setas e Esc, com anúncios para leitores de tela.
- **Reordenar** dentro da mesma lista e **mover** entre listas, em lista ou em grade.
- **Alça opcional:** qualquer elemento pode ser a alça, e um card pode ter mais de uma.
- **Grupos e regras** para decidir onde cada card pode cair.
- **Eventos e callbacks** para salvar a mudança no servidor.
- **Auto-scroll** ao chegar perto da borda de uma área com rolagem.
- **Cards criados depois** que a página carregou também funcionam.
- **Visual por sua conta:** a lib só adiciona classes, e você estiliza como quiser.

## Instalação

Baixe o arquivo [`jet-dnd.js`](jet-dnd.js), coloque no seu projeto e inclua no fim do `<body>`:

```html
<script src="jet-dnd.js"></script>
```

Ou use direto pelo CDN do jsDelivr, sem baixar nada:

```html
<script src="https://cdn.jsdelivr.net/gh/JetoG/Jet-DnD@1.0.0/jet-dnd.js"></script>
```

## Uso rápido

```html
<div class="jt-dropzone">
    <div class="jt-draggable">Card 1</div>
    <div class="jt-draggable">Card 2</div>
</div>

<div class="jt-dropzone">
    <div class="jt-draggable">Card 3</div>
</div>

<script src="jet-dnd.js"></script>
<script>
    JetDnD.init();
</script>
```

Pronto: os cards podem ser reordenados e movidos entre as duas áreas.

## Como funciona

- **`.jt-draggable`** marca o que pode ser arrastado (o "card").
- **`.jt-dropzone`** marca onde ele pode ser solto. Uma dropzone pode ter outras dentro dela: o card cai sempre na mais interna embaixo do ponteiro.
- **O card precisa ser filho direto da dropzone** (veja as [limitações](#limitações-conhecidas)).
- **Um clique simples não arrasta.** O arrasto só começa depois que o ponteiro anda alguns pixels (ou, no toque, depois de segurar o dedo).
- **Durante o arrasto,** um clone semitransparente (o "fantasma") mostra onde o card vai cair.
- **Soltar fora** de qualquer dropzone, ou numa que recusa o card, devolve o card para onde estava.
- **Os nomes das classes** podem ser trocados nas [opções](#opções).

## Opções

Todas são opcionais:

```js
const dnd = JetDnD.init({
    longPressDelay: 600,
    onDrop: (detail) => console.log('Moveu!', detail),
});
```

| Opção | Padrão | Descrição |
|---|---|---|
| `draggable` | `'.jt-draggable'` | Seletor dos elementos que podem ser arrastados. |
| `dropzone` | `'.jt-dropzone'` | Seletor das áreas onde eles podem ser soltos. |
| `handle` | `'.jt-handle'` | Seletor da alça. Aceita vários, separados por vírgula. Veja [Alça](#alça). |
| `dragThreshold` | `4` | Quantos pixels o ponteiro precisa andar para o clique virar arrasto. |
| `longPressDelay` | `400` | No toque, quanto tempo (em ms) segurar o dedo para pegar um card sem alça. |
| `accepts` | `null` | Função `(card, dropzone, from) => true/false` que decide se o card pode cair na dropzone. Veja [Grupos e regras](#grupos-e-regras-onde-cada-card-pode-cair). |
| `autoScroll` | `true` | Rola sozinho ao chegar perto da borda de uma área com rolagem (ou da janela). |
| `scrollEdge` | `40` | Tamanho (em px) da faixa perto da borda que faz rolar. |
| `scrollSpeed` | `15` | Velocidade máxima do auto-scroll (em px por quadro). |
| `keyboard` | `true` | Liga o arrasto pelo teclado. |
| `messages` | (em inglês) | Mensagens para leitores de tela. Veja [Teclado e acessibilidade](#teclado-e-acessibilidade). |
| `onDragStart` | `null` | Chamada quando o arrasto começa. |
| `onDrop` | `null` | Chamada quando o card é solto **e mudou de lugar**. |
| `onDragEnd` | `null` | Chamada sempre que o arrasto termina (mudou ou não, ou foi cancelado). |

## Reagindo ao arrasto

Há três formas, e você pode usar quantas quiser ao mesmo tempo. Num drop, elas são chamadas nesta ordem:

**1. `data-jt-drop` na dropzone:** uma função para cada coluna.

```html
<div class="jt-dropzone" data-jt-drop="marcarComoConcluida">...</div>
```
```js
function marcarComoConcluida(detail) {
    detail.card.classList.add('concluida');
}
```

> A função precisa ser **global**, igual às funções usadas no `onclick=""`: declarada com `function nome() {}` ou `window.nome = ...`. Um `const nome = () => {}` não é encontrado. A lib só procura a função pelo nome e **nunca executa texto como código**.

**2. Funções no `init`:** uma função para todos os drops.

```js
JetDnD.init({
    onDrop: (detail) => salvar(detail),
});
```

**3. Eventos:** o jeito padrão do navegador. Os eventos "sobem" pelos pais do card, então dá para escutar no `document`, num quadro ou numa coluna.

```js
document.addEventListener('jt-drop', (e) => salvar(e.detail));
```

| Evento | Função no `init` | Quando | `detail` |
|---|---|---|---|
| `jt-drag-start` | `onDragStart` | O arrasto começou | `{ card, from, index }` |
| `jt-drop` | `onDrop` | Soltou **e o card mudou de lugar** (de dropzone ou de posição) | `{ card, from, to, oldIndex, newIndex }` |
| `jt-drag-end` | `onDragEnd` | O arrasto terminou (sempre) | `{ card, from, to, oldIndex, newIndex, changed }` |

- `from` e `to` são as dropzones de origem e de destino.
- `oldIndex` e `newIndex` são as posições do card entre os cards da dropzone (`0` é o primeiro).
- Se uma das suas funções der erro, ele aparece no console, mas as outras continuam sendo chamadas e o arrasto não quebra.

## Grupos e regras (onde cada card pode cair)

**Grupos:** com `data-jt-group`, um card só cai em dropzones do **mesmo grupo**. Basta colocar o atributo nas dropzones: o card herda o grupo de onde saiu. Se quiser, também dá para colocar no próprio card.

```html
<!-- Os cards do quadro A não vão para o quadro B, e vice-versa -->
<div class="jt-dropzone" data-jt-group="quadro-a">...</div>
<div class="jt-dropzone" data-jt-group="quadro-b">...</div>
```

**Regras livres:** com a opção `accepts`.

```js
JetDnD.init({
    // A coluna "concluido" só aceita tarefas com a classe "revisada"
    accepts: (card, dropzone, from) =>
        dropzone.id !== 'concluido' || card.classList.contains('revisada'),
});
```

- A dropzone de origem **sempre** aceita o card de volta, então ele sempre pode ser reordenado onde está.
- Uma dropzone que recusa o card ganha a classe `.jt-dropzone-refused` enquanto o ponteiro está sobre ela, para você mostrar um aviso.

## Alça

Por padrão, o card inteiro arrasta. Se o card tiver um elemento com a classe da alça, **só ela arrasta**, e o resto do card vira texto normal (dá para selecionar e copiar).

```html
<div class="jt-draggable">
    <span class="jt-handle">⠿</span>
    <p>Este texto pode ser selecionado.</p>
</div>
```

- **Qualquer elemento pode ser a alça:** um ícone (inclusive de bibliotecas como o Fomantic UI), o título, um botão...
- **Para usar uma classe que já existe,** sem acrescentar `jt-handle` no HTML, use a opção `handle`:
  ```js
  JetDnD.init({ handle: '.grip.icon, .card-title' });
  ```
- **Um card pode ter mais de uma alça.**
- **No celular,** pela alça o card pega na hora. Sem alça, é preciso segurar o dedo, e deslizar rola a página.

Mesmo **sem** alça, botões, links e campos **dentro** do card continuam funcionando normalmente, e o duplo clique seleciona o texto.

## Teclado e acessibilidade

| Tecla | Ação |
|---|---|
| **Tab** | Foca o card (ou a alça, se ele tiver) |
| **Espaço** | Pega o card |
| **↑ ↓** | Muda a posição dentro da dropzone |
| **← →** | Passa para a dropzone anterior ou a próxima que aceite o card |
| **Espaço** ou **Enter** | Solta |
| **Esc** | Cancela (o card volta para onde estava). Também cancela um arrasto com o mouse. |

- A lib deixa os cards (ou as alças) focáveis pelo Tab, inclusive os criados depois.
- Leitores de tela leem as instruções ao focar um card e anunciam cada movimento.
- As mensagens vêm em inglês. Para traduzir, passe `messages` no `init` ou use `setMessages` (por exemplo, ao trocar o idioma da página). `{position}` e `{total}` são trocados pela lib:

```js
const dnd = JetDnD.init();

dnd.setMessages({
    instructions: 'Pressione Espaço para pegar. Use as setas para cima e para baixo para reordenar e as setas para os lados para mudar de lista. Pressione Espaço de novo para soltar, ou Esc para cancelar.',
    pickedUp: 'Pego. Posição {position} de {total}.',
    moved: 'Posição {position} de {total}.',
    movedList: 'Mudou de lista. Posição {position} de {total}.',
    dropped: 'Solto. Posição {position} de {total}.',
    canceled: 'Cancelado. O card voltou para o lugar original.',
});
```

O estilo do foco é seu. Por exemplo:

```css
.jt-draggable:focus-visible,
.jt-handle:focus-visible {
    outline: 2px solid royalblue;
}
```

## Classes CSS para estilizar

A lib cuida só do funcionamento. A aparência é toda sua, usando as classes que ela adiciona durante o arrasto:

| Classe | Onde | Quando |
|---|---|---|
| `.jt-dragging` | No card | Enquanto ele está sendo arrastado |
| `.jt-dragging-active` | No `<body>` | Enquanto qualquer card está sendo arrastado (útil para o cursor) |
| `.jt-clone` | No clone (o "fantasma") | Sempre. Padrão: `opacity: 0.5` |
| `.jt-dropzone-over` | Na dropzone | Quando o card vai cair nela |
| `.jt-dropzone-refused` | Na dropzone | Quando o ponteiro está sobre ela, mas ela recusou o card |

Exemplo, com o efeito de "levantar" o card que a demonstração usa:

```css
.jt-draggable { cursor: grab; }

.jt-draggable.jt-dragging {
    transform: scale(1.03);
    box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
}

.jt-dropzone.jt-dropzone-over { outline: 2px solid royalblue; }
.jt-dropzone.jt-dropzone-refused { outline: 2px dashed crimson; }

body.jt-dragging-active,
body.jt-dragging-active * { cursor: grabbing; }
```

> Use `translate`, `scale` ou `rotate` à vontade no card. Só não use `transition` em `translate`, `top` ou `left`, senão o card "segue o ponteiro com atraso".

## API

```js
const dnd = JetDnD.init(opcoes);  // Liga a lib e devolve a instância

dnd.destroy();                    // Desliga: remove os listeners e cancela um arrasto em andamento
dnd.setMessages({ ... });         // Troca as mensagens para leitores de tela
dnd.options;                      // As opções em uso

JetDnD.version;                   // '1.0.0'
```

- Chamar `init` de novo com os mesmos seletores devolve a instância que já existe (e mostra um aviso no console).
- Dá para ter instâncias diferentes na mesma página, com seletores diferentes. Só um card é arrastado por vez.
- Incluir o arquivo duas vezes não quebra nada: a segunda cópia é ignorada.

## Salvando a ordem (Django ou localStorage)

A lib só muda o HTML da página. Para a nova ordem continuar lá depois de recarregar (F5), ela precisa ser **salva**: no servidor, para dados reais e compartilhados, ou no navegador, para preferências de uma pessoa só.

> **Salve a ordem da coluna inteira, e não só a posição do card movido.** Quando um card entra na posição 2, todos os cards abaixo dele também mudam de posição. Se o card mudou de coluna, a coluna de origem também mudou.

### Com Django

**O modelo** tem um campo `posicao`, e as tarefas sempre vêm ordenadas por ele:

```python
# models.py
from django.conf import settings
from django.db import models

class Tarefa(models.Model):
    class Status(models.TextChoices):
        A_FAZER = "a_fazer", "A fazer"
        FAZENDO = "fazendo", "Fazendo"
        FEITO = "feito", "Feito"

    titulo = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.A_FAZER)
    posicao = models.PositiveIntegerField(default=0)
    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        ordering = ["posicao"]  # Toda consulta já vem na ordem salva
```

**O template** usa `data-*` para guardar o id de cada tarefa e o status de cada coluna. A URL para salvar vem do `{% url %}`, e o `data-jt-drop` diz qual função chamar quando um card cai na coluna:

```html
{% for status, nome, tarefas in colunas %}
<div class="jt-dropzone"
     data-status="{{ status }}"
     data-url="{% url 'tarefas:reordenar' %}"
     data-jt-drop="salvarOrdem">
    <h3>{{ nome }}</h3>
    {% for tarefa in tarefas %}
        <div class="jt-draggable" data-id="{{ tarefa.pk }}">{{ tarefa.titulo }}</div>
    {% endfor %}
</div>
{% endfor %}
```

**O JavaScript** envia a ordem completa da coluna de destino (e da de origem, se o card mudou de coluna). Se o servidor recusar, o card volta para onde estava:

```js
// Lê o token CSRF do cookie (o Django exige ele em requisições POST)
function getCookie(nome) {
    return document.cookie.split('; ').find(c => c.startsWith(nome + '='))?.split('=')[1];
}

// Lista os ids dos cards de uma coluna, na ordem em que aparecem
function idsDaColuna(coluna) {
    return [...coluna.children].filter(el => el.matches('.jt-draggable')).map(el => el.dataset.id);
}

// Devolve o card para onde ele estava (se o servidor recusar a mudança)
function voltarCard({ card, from, oldIndex }) {
    const cards = [...from.children].filter(el => el.matches('.jt-draggable') && el !== card);
    from.insertBefore(card, cards[oldIndex] ?? null);
}

// Chamada pelo data-jt-drop (por isso é declarada com "function": precisa ser global)
async function salvarOrdem(detail) {
    const { from, to } = detail;

    const colunas = [{ status: to.dataset.status, ids: idsDaColuna(to) }];
    if (from !== to) colunas.push({ status: from.dataset.status, ids: idsDaColuna(from) });

    try {
        const resposta = await fetch(to.dataset.url, {  // A URL veio do {% url %}
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ colunas }),
        });
        if (!resposta.ok) throw new Error('O servidor recusou');
    } catch (erro) {
        voltarCard(detail);
        alert('Não foi possível salvar a nova ordem.');
    }
}

JetDnD.init();
```

**As views** montam o quadro e salvam a ordem. O `bulk_update` grava todas as posições de uma vez:

```python
# views.py
import json

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .models import Tarefa

@login_required
def quadro(request):
    tarefas = Tarefa.objects.filter(dono=request.user)  # Já vem ordenado por posicao (Meta.ordering)
    colunas = [
        (valor, nome, [t for t in tarefas if t.status == valor])
        for valor, nome in Tarefa.Status.choices
    ]
    return render(request, "tarefas/quadro.html", {"colunas": colunas})

@login_required
@require_POST
def reordenar(request):
    dados = json.loads(request.body)
    alteradas = []

    for coluna in dados["colunas"]:
        if coluna["status"] not in Tarefa.Status.values:
            return JsonResponse({"erro": "Status inválido"}, status=400)

        ids = [int(i) for i in coluna["ids"]]
        # Só tarefas da própria pessoa: se algum id não for dela, recusa tudo
        tarefas = {t.pk: t for t in Tarefa.objects.filter(pk__in=ids, dono=request.user)}
        if len(tarefas) != len(ids):
            return JsonResponse({"erro": "Tarefa inválida"}, status=400)

        for posicao, pk in enumerate(ids):
            tarefas[pk].status = coluna["status"]
            tarefas[pk].posicao = posicao
            alteradas.append(tarefas[pk])

    with transaction.atomic():  # Ou grava tudo, ou nada
        Tarefa.objects.bulk_update(alteradas, ["status", "posicao"])
    return JsonResponse({"ok": True})
```

```python
# urls.py
from django.urls import path
from . import views

app_name = "tarefas"
urlpatterns = [
    path("", views.quadro, name="quadro"),
    path("reordenar/", views.reordenar, name="reordenar"),
]
```

O mesmo padrão funciona com qualquer backend: o que importa é a URL no `data-url` e o `fetch` na função do `data-jt-drop` (ou no `onDrop`, ou no evento `jt-drop`).

### Sem backend (localStorage)

Para guardar a ordem só no navegador da pessoa (sem servidor), use o `localStorage`. Cada dropzone precisa de um `id`, e cada card de um `data-id`:

```js
const CHAVE = 'minha-pagina-ordem';

// Guarda a ordem dos cards de cada dropzone
function salvarNoNavegador() {
    const ordem = {};
    document.querySelectorAll('.jt-dropzone[id]').forEach(zona => {
        ordem[zona.id] = [...zona.children].filter(el => el.matches('.jt-draggable')).map(el => el.dataset.id);
    });
    localStorage.setItem(CHAVE, JSON.stringify(ordem));
}

// Ao carregar a página, coloca os cards de volta na ordem salva
function restaurarDoNavegador() {
    const ordem = JSON.parse(localStorage.getItem(CHAVE) ?? '{}');
    for (const [zonaId, ids] of Object.entries(ordem)) {
        const zona = document.getElementById(zonaId);
        if (!zona) continue;
        ids.forEach(id => {
            const card = document.querySelector(`.jt-draggable[data-id="${CSS.escape(id)}"]`);
            if (card) zona.append(card);
        });
    }
}

restaurarDoNavegador();
JetDnD.init({ onDrop: salvarNoNavegador });
```

> O `localStorage` fica **só naquele navegador**: outra pessoa, ou a mesma pessoa em outro computador, vê a ordem original. Serve para preferências pessoais, não para um quadro compartilhado.

## Compatibilidade

Navegadores modernos: **Chrome e Edge 104+, Firefox 112+ e Safari 15.5+** (de 2022 em diante). A lib usa Pointer Events, a propriedade CSS `translate` e o atributo `inert`.

## Limitações conhecidas

- **O card precisa ser filho direto da dropzone.** Em `<ul class="jt-dropzone"><li><div class="jt-draggable">`, o `<li>` não acompanha o card. Nesse caso, coloque a classe no próprio `<li>`.
- **Pais com `transform`, `filter`, `perspective`, `contain` ou `will-change`** mudam a referência do `position: fixed` usado durante o arrasto, e o card pode aparecer deslocado. Pais que criam um contexto de empilhamento (com `z-index`, `opacity` menor que 1...) podem deixar o card arrastado atrás de outros elementos.
- **Não redesenhe a lista durante um arrasto.** Se um framework (React, Vue...) ou uma atualização da página trocar o HTML da lista no meio do arrasto, o card e o clone se perdem. Use o evento `jt-drag-start` para pausar atualizações e o `jt-drag-end` para retomar.
- **`flex-direction: row-reverse` e `column-reverse`** não são suportados: a ordem visual fica invertida em relação à ordem do HTML.
- **Pelo teclado,** as setas ↑ ↓ andam uma posição por vez, inclusive em grade.

## Estrutura do projeto

```
jet-dnd.js      ← a biblioteca (o único arquivo necessário)
docs/           ← a demonstração (publicada no GitHub Pages)
├── index.html
├── style.css
└── demo.js
```

Para rodar a demonstração no seu computador, clone o repositório e, na pasta dele, rode:

```sh
python -m http.server
```

Depois, abra http://localhost:8000/docs/ no navegador. Também dá para abrir o `docs/index.html` direto, mas alguns navegadores mostram avisos de segurança no console para páginas abertas do disco.

## Contribuindo

Contribuições são bem-vindas! Abra uma issue ou envie um pull request:

1. Faça um fork do repositório.
2. Crie uma branch (`git checkout -b minha-melhoria`).
3. Faça commit das mudanças (`git commit -m 'Descreve a melhoria'`).
4. Envie a branch (`git push origin minha-melhoria`).
5. Abra um pull request.

### Checklist de testes manuais

Antes de enviar uma mudança na lib, confira na demonstração:

- [ ] Clique simples sem arrastar: o card não muda de tamanho nem de estilo.
- [ ] Arrastar entre colunas e reordenar dentro de uma coluna: o fantasma fica no lugar certo.
- [ ] Soltar fora de qualquer dropzone: o card volta para onde estava.
- [ ] Coluna com rolagem: o card não pula ao começar a arrastar, e o auto-scroll funciona.
- [ ] Botão direito não inicia o arrasto. Esc cancela.
- [ ] Botões, links e campos dentro de um card continuam funcionando.
- [ ] Cards com alça: só a alça arrasta, e o texto pode ser selecionado.
- [ ] Grupos e `accepts`: a dropzone recusada não recebe o card.
- [ ] Teclado: Tab, Espaço, setas, Enter e Esc.
- [ ] Toque (DevTools com Ctrl + Shift + M, ou celular): toque longo nos cards sem alça, toque direto na alça.
- [ ] O console não mostra erros.

## Licença

MIT. Veja o arquivo [LICENSE.md](LICENSE.md).

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/JetoG">Jean / Jeto</a>
</p>
