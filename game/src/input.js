// SOLMAR HEAT — input.js
// One clear job: keyboard and mouse state, including pointer drag for the
// camera, click-to-shoot and the keys the HUD lists on the start screen.

export function createInput() {
  const input = {
    keys: new Set(),
    mouseDown: false,
    mouseClicked: false, // consumed once per click by the shooter
    dragDX: 0,
    dragDY: 0,
    pointerLocked: false,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    input.keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => input.keys.clear());

  let dragging = false;
  let lastX = 0, lastY = 0;
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    input.mouseDown = true;
    input.mouseClicked = true;
    dragging = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    input.dragDX += e.clientX - lastX;
    input.dragDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  return input;
}

// Helpers the game loop calls once a frame.
export function keyDown(input, key) {
  return input.keys.has(key);
}

export function consumeClick(input) {
  const c = input.mouseClicked;
  input.mouseClicked = false;
  return c;
}

export function consumeDrag(input) {
  const dx = input.dragDX, dy = input.dragDY;
  input.dragDX = 0; input.dragDY = 0;
  return { dx, dy };
}

export function consumeKey(input, key) {
  if (!input.keys.has(key)) return false;
  input.keys.delete(key);
  return true;
}
