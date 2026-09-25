const $ = (selector) => document.querySelector(selector);
const money = (cents) => `Q ${(cents / 100).toFixed(2)}`;
let products = [];
const cart = new Map();
const status = $('#status');
function message(type, text) { status.className = type; status.textContent = text; }
function drawProducts() {
  const container = $('#products');
  container.replaceChildren();
  for (const product of products) {
    const article = document.createElement('article');
    article.className = 'product';
    article.dataset.cy = `product-${product.id}`;
    article.innerHTML = `<div><span class="product-icon" aria-hidden="true"></span><h3></h3><span class="availability"></span></div><div class="product-bottom"><span class="price"></span><button class="add" type="button"></button></div>`;
    article.querySelector('.product-icon').textContent = product.icon;
    article.querySelector('h3').textContent = product.name;
    const stock = article.querySelector('.availability');
    stock.textContent = product.stock ? `${product.stock} disponibles` : 'Agotado';
    if (!product.stock) stock.classList.add('none');
    article.querySelector('.price').textContent = money(product.priceCents);
    const add = article.querySelector('button');
    add.textContent = product.stock ? 'Agregar +' : 'Sin existencias';
    add.disabled = !product.stock;
    add.setAttribute('aria-label', `Agregar ${product.name}`);
    add.addEventListener('click', () => {
      const current = cart.get(product.id) ?? 0;
      if (current >= product.stock) return message('error', `No hay suficientes existencias de ${product.name}.`);
      cart.set(product.id, current + 1);
      message('', '');
      drawCart();
    });
    container.append(article);
  }
}
function drawCart() {
  const box = $('#cart-items');
  box.replaceChildren();
  let total = 0;
  let count = 0;
  if (!cart.size) box.innerHTML = '<div class="empty"><span aria-hidden="true">☕</span>Tu bandeja está vacía.<br>Agrega algo del menú para empezar.</div>';
  for (const [id, quantity] of cart) {
    const product = products.find(p => p.id === id);
    total += product.priceCents * (Number.isInteger(quantity) ? quantity : 0);
    count += Number.isInteger(quantity) ? quantity : 0;
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.innerHTML = '<div><strong></strong><small></small><button type="button" class="remove">Quitar</button></div><div class="line-right"><span></span><div class="quantity"><label></label><input type="number" min="1" max="20" step="1" required></div></div>';
    line.querySelector('strong').textContent = product.name;
    line.querySelector('small').textContent = `${money(product.priceCents)} c/u`;
    line.querySelector('.line-right>span').textContent = money(product.priceCents * (Number.isInteger(quantity) ? quantity : 0));
    line.querySelector('.remove').addEventListener('click', () => { cart.delete(id); message('', ''); drawCart(); });
    const input = line.querySelector('input');
    input.id = `quantity-${id}`;
    line.querySelector('label').setAttribute('for', input.id);
    line.querySelector('label').textContent = 'Cant.';
    input.value = quantity;
    input.setAttribute('aria-label', `Cantidad de ${product.name}`);
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!input.value || !Number.isSafeInteger(value) || value < 1 || value > 20 || value > product.stock) {
        input.setCustomValidity(`Introduce una cantidad entera entre 1 y ${Math.min(20, product.stock)}.`);
        message('error', input.validationMessage);
        return;
      }
      input.setCustomValidity('');
      cart.set(id, value);
      message('', '');
      drawCart();
    });
    box.append(line);
  }
  $('#total').textContent = money(total);
  $('#cart-count').textContent = count;
}
async function loadProducts() {
  const response = await fetch('/api/products');
  if (!response.ok) throw new Error('No se pudo cargar el menú.');
  products = await response.json();
  drawProducts();
}
$('#confirm').addEventListener('click', async () => {
  if (!cart.size) return message('error', 'Agrega al menos un producto antes de confirmar.');
  const invalid = [...cart].some(([id, q]) => !Number.isSafeInteger(q) || q < 1 || q > 20 || q > products.find(p => p.id === id).stock);
  if (invalid || document.querySelector('input:invalid')) return message('error', 'Revisa las cantidades del pedido.');
  const button = $('#confirm');
  button.disabled = true;
  message('', '');
  try {
    const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [...cart].map(([productId, quantity]) => ({ productId, quantity })) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'No se pudo confirmar el pedido.');
    cart.clear();
    drawCart();
    await loadProducts();
    message('success', `¡Pedido confirmado! Identificador: ${result.id}. Total: ${money(result.totalCents)}.`);
  } catch (error) { message('error', `${error.message} Puedes intentarlo de nuevo.`); }
  finally { button.disabled = false; }
});
loadProducts().catch(error => message('error', error.message));
drawCart();
