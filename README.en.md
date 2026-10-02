# Jet DnD

[🇧🇷 Português](README.md) | 🇺🇸 English

**Drag and drop in plain JavaScript, with no dependencies.** A single file that works with mouse, touch and pen, and with the keyboard too.

**[▶ See the live demo](https://jetog.github.io/Jet-DnD/)**

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [How it works](#how-it-works)
- [Options](#options)
- [Reacting to drags](#reacting-to-drags)
- [Groups and rules (where each card can go)](#groups-and-rules-where-each-card-can-go)
- [Handle](#handle)
- [Keyboard and accessibility](#keyboard-and-accessibility)
- [CSS classes for styling](#css-classes-for-styling)
- [API](#api)
- [Saving the order (Django or localStorage)](#saving-the-order-django-or-localstorage)
- [Browser support](#browser-support)
- [Known limitations](#known-limitations)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features

- **No dependencies:** one file, no build step, no npm.
- **Mouse, touch and pen** (Pointer Events). On mobile, cards without a handle are dragged with a long press, and the page still scrolls normally.
- **Keyboard and screen readers:** Tab, Space, arrows and Escape, with screen reader announcements.
- **Reorder** inside the same list and **move** between lists, in a list or in a grid.
- **Optional handle:** any element can be the handle, and a card can have more than one.
- **Groups and rules** to decide where each card can go.
- **Events and callbacks** to save the change on the server.
- **Auto-scroll** when close to the edge of a scrollable area.
- **Cards created after** the page loaded work too.
- **Your styles:** the library only adds classes, and you style them however you want.

## Installation

Download [`jet-dnd.js`](jet-dnd.js), add it to your project and include it at the end of `<body>`:

```html
<script src="jet-dnd.js"></script>
```

Or load it straight from the jsDelivr CDN, without downloading anything:

```html
<script src="https://cdn.jsdelivr.net/gh/JetoG/Jet-DnD@1.0.0/jet-dnd.js"></script>
```

## Quick start

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

That's it: the cards can be reordered and moved between the two areas.

## How it works

- **`.jt-draggable`** marks what can be dragged (the "card").
- **`.jt-dropzone`** marks where it can be dropped. A dropzone can contain other dropzones: the card always lands in the innermost one under the pointer.
- **The card must be a direct child of the dropzone** (see [known limitations](#known-limitations)).
- **A simple click does not drag.** Dragging only starts after the pointer moves a few pixels (or, on touch, after holding the finger down).
- **While dragging,** a semi-transparent clone (the "ghost") shows where the card will land.
- **Dropping outside** any dropzone, or on one that refuses the card, sends the card back to where it was.
- **The class names** can be changed in the [options](#options).

## Options

All of them are optional:

```js
const dnd = JetDnD.init({
    longPressDelay: 600,
    onDrop: (detail) => console.log('Moved!', detail),
});
```

| Option | Default | Description |
|---|---|---|
| `draggable` | `'.jt-draggable'` | Selector for the elements that can be dragged. |
| `dropzone` | `'.jt-dropzone'` | Selector for the areas where they can be dropped. |
| `handle` | `'.jt-handle'` | Selector for the handle. Accepts several, separated by commas. See [Handle](#handle). |
| `dragThreshold` | `4` | How many pixels the pointer must move for a click to become a drag. |
| `longPressDelay` | `400` | On touch, how long (in ms) to hold the finger down to pick up a card without a handle. |
| `accepts` | `null` | Function `(card, dropzone, from) => true/false` that decides whether the card can go into the dropzone. See [Groups and rules](#groups-and-rules-where-each-card-can-go). |
| `autoScroll` | `true` | Scrolls automatically when close to the edge of a scrollable area (or of the window). |
| `scrollEdge` | `40` | Size (in px) of the strip near the edge that triggers scrolling. |
| `scrollSpeed` | `15` | Maximum auto-scroll speed (in px per frame). |
| `keyboard` | `true` | Enables dragging with the keyboard. |
| `messages` | (in English) | Screen reader messages. See [Keyboard and accessibility](#keyboard-and-accessibility). |
| `onDragStart` | `null` | Called when a drag starts. |
| `onDrop` | `null` | Called when the card is dropped **and its place changed**. |
| `onDragEnd` | `null` | Called whenever a drag ends (changed or not, or canceled). |

## Reacting to drags

There are three ways, and you can use as many as you want at the same time. On a drop, they are called in this order:

**1. `data-jt-drop` on the dropzone:** one function per column.

```html
<div class="jt-dropzone" data-jt-drop="markAsDone">...</div>
```
```js
function markAsDone(detail) {
    detail.card.classList.add('done');
}
```

> The function must be **global**, just like functions used in `onclick=""`: declared with `function name() {}` or `window.name = ...`. A `const name = () => {}` is not found. The library only looks the function up by name and **never runs text as code**.

**2. Functions in `init`:** one function for every drop.

```js
JetDnD.init({
    onDrop: (detail) => save(detail),
});
```

**3. Events:** the standard browser way. Events bubble up through the card's parents, so you can listen on the `document`, on a board or on a single column.

```js
document.addEventListener('jt-drop', (e) => save(e.detail));
```

| Event | Function in `init` | When | `detail` |
|---|---|---|---|
| `jt-drag-start` | `onDragStart` | The drag started | `{ card, from, index }` |
| `jt-drop` | `onDrop` | Dropped **and the card's place changed** (dropzone or position) | `{ card, from, to, oldIndex, newIndex }` |
| `jt-drag-end` | `onDragEnd` | The drag ended (always) | `{ card, from, to, oldIndex, newIndex, changed }` |

- `from` and `to` are the source and destination dropzones.
- `oldIndex` and `newIndex` are the card's positions among the dropzone's cards (`0` is the first).
- If one of your functions throws an error, it shows up in the console, but the others are still called and the drag does not break.

## Groups and rules (where each card can go)

**Groups:** with `data-jt-group`, a card only goes into dropzones of the **same group**. Put the attribute on the dropzones: the card inherits the group of the dropzone it came from. You can also put it on the card itself.

```html
<!-- Cards from board A don't go to board B, and vice versa -->
<div class="jt-dropzone" data-jt-group="board-a">...</div>
<div class="jt-dropzone" data-jt-group="board-b">...</div>
```

**Custom rules:** with the `accepts` option.

```js
JetDnD.init({
    // The "done" column only accepts tasks with the "reviewed" class
    accepts: (card, dropzone, from) =>
        dropzone.id !== 'done' || card.classList.contains('reviewed'),
});
```

- The source dropzone **always** accepts the card back, so it can always be reordered where it is.
- A dropzone that refuses the card gets the `.jt-dropzone-refused` class while the pointer is over it, so you can show a warning.

## Handle

By default, the whole card drags. If the card has an element with the handle class, **only the handle drags**, and the rest of the card becomes regular text (it can be selected and copied).

```html
<div class="jt-draggable">
    <span class="jt-handle">⠿</span>
    <p>This text can be selected.</p>
</div>
```

- **Any element can be the handle:** an icon (including from libraries like Fomantic UI), the title, a button...
- **To use a class you already have,** without adding `jt-handle` to the HTML, use the `handle` option:
  ```js
  JetDnD.init({ handle: '.grip.icon, .card-title' });
  ```
- **A card can have more than one handle.**
- **On mobile,** the card is picked up right away by the handle. Without a handle, you need to hold the finger down, and swiping scrolls the page.

Even **without** a handle, buttons, links and fields **inside** the card keep working normally, and double-clicking selects the text.

## Keyboard and accessibility

| Key | Action |
|---|---|
| **Tab** | Focuses the card (or its handle, if it has one) |
| **Space** | Picks up the card |
| **↑ ↓** | Changes the position inside the dropzone |
| **← →** | Moves to the previous or next dropzone that accepts the card |
| **Space** or **Enter** | Drops |
| **Esc** | Cancels (the card goes back to where it was). It also cancels a mouse drag. |

- The library makes cards (or handles) focusable with Tab, including the ones created later.
- Screen readers read the instructions when a card is focused and announce every move.
- Messages are in English by default. To translate them, pass `messages` to `init` or use `setMessages` (for example, when the page language changes). `{position}` and `{total}` are replaced by the library:

```js
const dnd = JetDnD.init();

dnd.setMessages({
    instructions: 'Press Space to pick up. Use the up and down arrows to reorder and the left and right arrows to move to another list. Press Space again to drop, or Escape to cancel.',
    pickedUp: 'Picked up. Position {position} of {total}.',
    moved: 'Position {position} of {total}.',
    movedList: 'Moved to another list. Position {position} of {total}.',
    dropped: 'Dropped. Position {position} of {total}.',
    canceled: 'Canceled. Back to the original position.',
});
```

The focus style is up to you. For example:

```css
.jt-draggable:focus-visible,
.jt-handle:focus-visible {
    outline: 2px solid royalblue;
}
```

## CSS classes for styling

The library only handles the behavior. The look is entirely yours, using the classes it adds while dragging:

| Class | Where | When |
|---|---|---|
| `.jt-dragging` | On the card | While it is being dragged |
| `.jt-dragging-active` | On `<body>` | While any card is being dragged (useful for the cursor) |
| `.jt-clone` | On the clone (the "ghost") | Always. Default: `opacity: 0.5` |
| `.jt-dropzone-over` | On the dropzone | When the card will land in it |
| `.jt-dropzone-refused` | On the dropzone | When the pointer is over it, but it refused the card |

Example, with the "lift" effect used in the demo:

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

> Feel free to use `translate`, `scale` or `rotate` on the card. Just don't put a `transition` on `translate`, `top` or `left`, or the card will lag behind the pointer.

## API

```js
const dnd = JetDnD.init(options); // Turns the library on and returns the instance

dnd.destroy();                    // Turns it off: removes the listeners and cancels a drag in progress
dnd.setMessages({ ... });         // Changes the screen reader messages
dnd.options;                      // The options in use

JetDnD.version;                   // '1.0.0'
```

- Calling `init` again with the same selectors returns the existing instance (and logs a warning).
- You can have different instances on the same page, with different selectors. Only one card is dragged at a time.
- Including the file twice doesn't break anything: the second copy is ignored.

## Saving the order (Django or localStorage)

The library only changes the page's HTML. For the new order to still be there after a reload (F5), it has to be **saved**: on the server, for real and shared data, or in the browser, for one person's preferences.

> **Save the order of the whole column, not just the position of the moved card.** When a card goes into position 2, every card below it changes position too. If the card changed columns, the source column changed as well.

### With Django

**The model** has a `position` field, and tasks always come ordered by it:

```python
# models.py
from django.conf import settings
from django.db import models

class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To do"
        DOING = "doing", "Doing"
        DONE = "done", "Done"

    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)
    position = models.PositiveIntegerField(default=0)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        ordering = ["position"]  # Every query already comes in the saved order
```

**The template** uses `data-*` attributes to store each task's id and each column's status. The URL to save comes from `{% url %}`, and `data-jt-drop` says which function to call when a card lands in the column:

```html
{% for status, name, tasks in columns %}
<div class="jt-dropzone"
     data-status="{{ status }}"
     data-url="{% url 'tasks:reorder' %}"
     data-jt-drop="saveOrder">
    <h3>{{ name }}</h3>
    {% for task in tasks %}
        <div class="jt-draggable" data-id="{{ task.pk }}">{{ task.title }}</div>
    {% endfor %}
</div>
{% endfor %}
```

**The JavaScript** sends the full order of the destination column (and of the source column, if the card changed columns). If the server refuses, the card goes back to where it was:

```js
// Reads the CSRF token from the cookie (Django requires it on POST requests)
function getCookie(name) {
    return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

// Lists the ids of a column's cards, in the order they appear
function columnIds(column) {
    return [...column.children].filter(el => el.matches('.jt-draggable')).map(el => el.dataset.id);
}

// Puts the card back where it was (if the server refuses the change)
function moveBack({ card, from, oldIndex }) {
    const cards = [...from.children].filter(el => el.matches('.jt-draggable') && el !== card);
    from.insertBefore(card, cards[oldIndex] ?? null);
}

// Called by data-jt-drop (that's why it's declared with "function": it must be global)
async function saveOrder(detail) {
    const { from, to } = detail;

    const columns = [{ status: to.dataset.status, ids: columnIds(to) }];
    if (from !== to) columns.push({ status: from.dataset.status, ids: columnIds(from) });

    try {
        const response = await fetch(to.dataset.url, {  // The URL came from {% url %}
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ columns }),
        });
        if (!response.ok) throw new Error('The server refused');
    } catch (error) {
        moveBack(detail);
        alert('Could not save the new order.');
    }
}

JetDnD.init();
```

**The views** build the board and save the order. `bulk_update` writes every position at once:

```python
# views.py
import json

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from .models import Task

@login_required
def board(request):
    tasks = Task.objects.filter(owner=request.user)  # Already ordered by position (Meta.ordering)
    columns = [
        (value, name, [t for t in tasks if t.status == value])
        for value, name in Task.Status.choices
    ]
    return render(request, "tasks/board.html", {"columns": columns})

@login_required
@require_POST
def reorder(request):
    data = json.loads(request.body)
    changed = []

    for column in data["columns"]:
        if column["status"] not in Task.Status.values:
            return JsonResponse({"error": "Invalid status"}, status=400)

        ids = [int(i) for i in column["ids"]]
        # Only the person's own tasks: if any id isn't theirs, refuse everything
        tasks = {t.pk: t for t in Task.objects.filter(pk__in=ids, owner=request.user)}
        if len(tasks) != len(ids):
            return JsonResponse({"error": "Invalid task"}, status=400)

        for position, pk in enumerate(ids):
            tasks[pk].status = column["status"]
            tasks[pk].position = position
            changed.append(tasks[pk])

    with transaction.atomic():  # Either save everything, or nothing
        Task.objects.bulk_update(changed, ["status", "position"])
    return JsonResponse({"ok": True})
```

```python
# urls.py
from django.urls import path
from . import views

app_name = "tasks"
urlpatterns = [
    path("", views.board, name="board"),
    path("reorder/", views.reorder, name="reorder"),
]
```

The same pattern works with any backend: what matters is the URL in `data-url` and the `fetch` in the `data-jt-drop` function (or in `onDrop`, or in the `jt-drop` event).

### Without a backend (localStorage)

To keep the order only in the person's browser (no server), use `localStorage`. Each dropzone needs an `id`, and each card a `data-id`:

```js
const KEY = 'my-page-order';

// Stores the order of the cards in each dropzone
function saveInBrowser() {
    const order = {};
    document.querySelectorAll('.jt-dropzone[id]').forEach(zone => {
        order[zone.id] = [...zone.children].filter(el => el.matches('.jt-draggable')).map(el => el.dataset.id);
    });
    localStorage.setItem(KEY, JSON.stringify(order));
}

// When the page loads, puts the cards back in the saved order
function restoreFromBrowser() {
    const order = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    for (const [zoneId, ids] of Object.entries(order)) {
        const zone = document.getElementById(zoneId);
        if (!zone) continue;
        ids.forEach(id => {
            const card = document.querySelector(`.jt-draggable[data-id="${CSS.escape(id)}"]`);
            if (card) zone.append(card);
        });
    }
}

restoreFromBrowser();
JetDnD.init({ onDrop: saveInBrowser });
```

> `localStorage` lives **only in that browser**: someone else, or the same person on another computer, sees the original order. It's meant for personal preferences, not for a shared board.

## Browser support

Modern browsers: **Chrome and Edge 104+, Firefox 112+ and Safari 15.5+** (2022 onwards). The library uses Pointer Events, the CSS `translate` property and the `inert` attribute.

## Known limitations

- **The card must be a direct child of the dropzone.** In `<ul class="jt-dropzone"><li><div class="jt-draggable">`, the `<li>` does not follow the card. In that case, put the class on the `<li>` itself.
- **Parents with `transform`, `filter`, `perspective`, `contain` or `will-change`** change the reference of the `position: fixed` used while dragging, and the card may appear offset. Parents that create a stacking context (with `z-index`, `opacity` below 1...) can keep the dragged card behind other elements.
- **Don't re-render the list during a drag.** If a framework (React, Vue...) or a page update replaces the list's HTML in the middle of a drag, the card and the clone get lost. Use the `jt-drag-start` event to pause updates and `jt-drag-end` to resume them.
- **`flex-direction: row-reverse` and `column-reverse`** are not supported: the visual order is reversed compared to the HTML order.
- **With the keyboard,** the ↑ ↓ arrows move one position at a time, in a grid too.

## Project structure

```
jet-dnd.js      ← the library (the only file you need)
docs/           ← the demo (published on GitHub Pages)
├── index.html
├── style.css
└── demo.js
```

To run the demo on your computer, clone the repository and, inside its folder, run:

```sh
python -m http.server
```

Then open http://localhost:8000/docs/ in your browser. You can also open `docs/index.html` directly, but some browsers log security warnings in the console for pages opened from the disk.

## Contributing

Contributions are welcome! Open an issue or send a pull request:

1. Fork the repository.
2. Create a branch (`git checkout -b my-improvement`).
3. Commit your changes (`git commit -m 'Describe the improvement'`).
4. Push the branch (`git push origin my-improvement`).
5. Open a pull request.

### Manual test checklist

Before sending a change to the library, check in the demo:

- [ ] Simple click without dragging: the card doesn't change size or style.
- [ ] Dragging between columns and reordering inside a column: the ghost lands in the right place.
- [ ] Dropping outside any dropzone: the card goes back to where it was.
- [ ] Scrollable column: the card doesn't jump when the drag starts, and auto-scroll works.
- [ ] The right mouse button doesn't start a drag. Escape cancels.
- [ ] Buttons, links and fields inside a card keep working.
- [ ] Cards with a handle: only the handle drags, and the text can be selected.
- [ ] Groups and `accepts`: a refusing dropzone doesn't receive the card.
- [ ] Keyboard: Tab, Space, arrows, Enter and Escape.
- [ ] Touch (DevTools with Ctrl + Shift + M, or a phone): long press on cards without a handle, direct touch on the handle.
- [ ] The console shows no errors.

## License

MIT. See [LICENSE.md](LICENSE.md).

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/JetoG">Jean / Jeto</a>
</p>
