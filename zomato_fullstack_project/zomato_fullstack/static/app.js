const state = {
  restaurants: [], cart: [], filter: "All", search: "",
  view: "customer", selectedRestaurant: 1, orders: []
};
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
}[ch]));
const money = value => `₹${Number(value || 0).toFixed(2)}`;
const cuisineColors = {
  Indian:"linear-gradient(135deg,#ffd4b8,#fff0cb)",
  Italian:"linear-gradient(135deg,#ffe0a8,#ffd0c4)",
  American:"linear-gradient(135deg,#f8d3a5,#ffe6bd)",
  Chinese:"linear-gradient(135deg,#ffd1bc,#ffe4a9)",
  "North Indian":"linear-gradient(135deg,#ffd2bd,#f6d9a5)",
  "South Indian":"linear-gradient(135deg,#ffe8a9,#d6edc7)",
  Desserts:"linear-gradient(135deg,#f7c8e0,#e0d4ff)"
};

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {"Content-Type":"application/json", ...(options.headers || {})},
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2600);
}
function showModal(title, content, footer = "") {
  $("modalTitle").textContent = title;
  $("modalContent").innerHTML = content;
  $("modalFoot").innerHTML = footer;
  $("modalBackdrop").classList.add("open");
}
function closeModal() { $("modalBackdrop").classList.remove("open"); }
function cartCount() { return state.cart.reduce((sum, item) => sum + item.quantity, 0); }
function cartSubtotal() { return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
function cartDiscount() { const sub = cartSubtotal(); return sub >= 500 ? sub * .10 : 0; }
function cartTotal() { return cartSubtotal() - cartDiscount(); }
function updateCartBadge() { $("cartCount").textContent = cartCount(); }

async function loadRestaurants() {
  try {
    state.restaurants = await api("/api/restaurants");
    renderRestaurants();
  } catch (error) {
    $("restaurantGrid").innerHTML = `<div class="empty">Could not load restaurants. Make sure the Flask server is running.<p>${escapeHtml(error.message)}</p></div>`;
  }
}
function visibleRestaurants() {
  return state.restaurants.filter(r => {
    const cuisineMatch = state.filter === "All" || r.cuisine === state.filter ||
      (state.filter === "Indian" && r.cuisine === "North Indian");
    const text = `${r.name} ${r.cuisine}`.toLowerCase();
    return cuisineMatch && text.includes(state.search.toLowerCase());
  });
}
function renderRestaurants() {
  const list = visibleRestaurants();
  $("restaurantCount").textContent = `${list.length} place${list.length === 1 ? "" : "s"} to explore`;
  $("restaurantGrid").innerHTML = list.map((r, i) => `
    <article class="restaurant-card" style="animation-delay:${i * 45}ms" data-restaurant="${r.id}">
      <div class="card-art" style="background:${cuisineColors[r.cuisine] || cuisineColors.Indian}">
        <span class="rating">★ ${(4.7 + (r.id % 3) * .1).toFixed(1)} · Popular</span>
        <span class="card-emoji">${escapeHtml(r.emoji)}</span>
        <span class="delivery-time">${escapeHtml(r.delivery_time)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(r.name)}</div>
        <div class="card-meta">${escapeHtml(r.cuisine)} · ${r.menu.length} menu items</div>
        <div class="card-bottom">
          <span class="price-note">From ${money(Math.min(...r.menu.map(f => f.price)))}</span>
          <button class="explore" data-open="${r.id}">View menu →</button>
        </div>
      </div>
    </article>`).join("") || '<div class="empty">No restaurants match your search. Try another cuisine.</div>';
}
function openRestaurant(restaurantId) {
  const r = state.restaurants.find(item => item.id === Number(restaurantId));
  if (!r) return;
  state.selectedRestaurant = r.id;
  const menu = r.menu.map(f => `
    <div class="menu-row">
      <div class="food-icon">${escapeHtml(f.emoji)}</div>
      <div class="food-info"><strong>${escapeHtml(f.name)}</strong><small>Freshly prepared · ${money(f.price)}</small></div>
      <button class="add-btn" data-add="${f.id}">ADD +</button>
    </div>`).join("");
  showModal(`${r.emoji} ${r.name}`,
    `<p class="muted" style="margin-bottom:12px">${escapeHtml(r.cuisine)} cuisine · Pick your favorites</p>${menu}`,
    `<span><strong>${cartCount()} item(s)</strong><small class="muted" style="display:block">in your cart</small></span><button class="primary" id="viewCartButton">View cart →</button>`);
}
function addToCart(foodId) {
  const r = state.restaurants.find(item => item.id === state.selectedRestaurant);
  const food = r?.menu.find(item => item.id === Number(foodId));
  if (!food) return;
  const existing = state.cart.find(item => item.food_id === food.id);
  if (existing) existing.quantity++;
  else state.cart.push({food_id: food.id, restaurant_id: r.id, name: food.name, price: Number(food.price), emoji: food.emoji, restaurant_name: r.name, quantity: 1});
  updateCartBadge();
  toast(`${food.name} added to cart!`);
  openRestaurant(r.id);
}
function cartContents() {
  if (!state.cart.length) {
    showModal("Your cart 🛒", '<div class="empty"><div class="big-emoji">🛍️</div><strong>Your cart is waiting for something tasty.</strong><p>Explore a restaurant and add a dish you love.</p></div>',
      '<button class="primary" id="continueShopping">Explore restaurants</button>');
    return;
  }
  const items = state.cart.map((item, i) => `
    <div class="cart-row">
      <div class="food-icon">${escapeHtml(item.emoji)}</div>
      <div class="food-info"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.restaurant_name)} · ${money(item.price)} each</small></div>
      <div class="qty"><button data-qty="${i}" data-delta="-1">−</button><strong>${item.quantity}</strong><button data-qty="${i}" data-delta="1">+</button></div>
      <strong>${money(item.price * item.quantity)}</strong>
    </div>`).join("");
  const sub = cartSubtotal(), discount = cartDiscount();
  const bill = `<div class="bill">
    <div class="bill-row"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="bill-row"><span>Discount ${sub >= 500 ? "(10%)" : "(orders ₹500+)"}</span><span>−${money(discount)}</span></div>
    <div class="bill-row"><span>Delivery fee</span><span>Free</span></div>
    <div class="bill-row total"><span>Total</span><span>${money(sub - discount)}</span></div>
  </div>`;
  const restaurantIds = [...new Set(state.cart.map(item => item.restaurant_id))];
  const note = restaurantIds.length > 1 ? '<div class="role-note">Your cart has items from multiple restaurants. Remove items until you have only one restaurant in the cart before checkout.</div>' : "";
  const checkout = `<form id="checkoutForm" class="checkout-form">
    <label>Customer name<input name="customer_name" placeholder="Your full name" required maxlength="80"></label>
    <label>Phone number<input name="phone" placeholder="10-digit phone number" required minlength="7" maxlength="15" inputmode="tel"></label>
    <button class="primary full" type="submit">Place order · ${money(cartTotal())}</button>
  </form>`;
  showModal("Your cart 🛒", `${items}${bill}${note}${checkout}`,
    '<button class="secondary" id="clearCartButton">Clear cart</button><button class="primary" id="closeCartButton">Continue shopping</button>');
}
async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.length) return;
  const form = new FormData(event.currentTarget);
  const payload = {
    customer_name: form.get("customer_name").trim(),
    phone: form.get("phone").trim(),
    items: state.cart.map(item => ({food_id:item.food_id, quantity:item.quantity}))
  };
  try {
    const order = await api("/api/orders", {method:"POST", body:JSON.stringify(payload)});
    state.cart = [];
    updateCartBadge();
    showModal("Order placed! 🎉", `
      <div class="empty"><div class="big-emoji">🎉</div><h2>Bon appétit!</h2><p>Your order was saved to the database.</p>
      <div class="bill">
        <div class="bill-row"><span>Order ID</span><strong>${escapeHtml(order.order_code)}</strong></div>
        <div class="bill-row"><span>Restaurant</span><strong>${escapeHtml(order.restaurant_name)}</strong></div>
        <div class="bill-row"><span>Total</span><strong>${money(order.total)}</strong></div>
        <div class="bill-row"><span>Status</span><span class="status-pill">${escapeHtml(order.status)}</span></div>
      </div></div>`,
      '<button class="primary" id="goOrdersButton">View orders</button>');
    toast("Order saved successfully.");
  } catch (error) { toast(error.message); }
}
async function loadOrders(role = "admin", restaurantId = "") {
  const suffix = restaurantId ? `&restaurant_id=${restaurantId}` : "";
  return api(`/api/orders?role=${encodeURIComponent(role)}${suffix}`);
}
function statCard(value, label) {
  return `<div class="stat-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}
function renderOrderTable(orders, mode = "admin") {
  if (!orders.length) return '<div class="empty"><div class="big-emoji">📦</div><strong>No orders yet.</strong><p>Place a test order from the Explore tab first.</p></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr>
    <th>Order</th><th>Customer</th><th>Restaurant / items</th><th>Total</th><th>Status</th><th>Update</th>
    </tr></thead><tbody>${orders.map(o => {
      const items = o.items.map(i => `${escapeHtml(i.name)} × ${i.quantity}`).join(", ");
      const options = (mode === "delivery" ? ["Assigned","Picked Up","Out for Delivery","Delivered"] : ["Order Placed","Preparing","Ready for Pickup","Out for Delivery","Delivered","Cancelled"]);
      const current = mode === "delivery" ? o.delivery_status : o.status;
      return `<tr><td><strong>${escapeHtml(o.order_code)}</strong><br><small>${escapeHtml(o.created_at)}</small></td>
        <td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.phone)}</small></td>
        <td>${escapeHtml(o.restaurant_name)}<br><small>${items}</small></td>
        <td><strong>${money(o.total)}</strong></td>
        <td><span class="status-pill">${escapeHtml(current)}</span></td>
        <td><select aria-label="Update status for ${escapeHtml(o.order_code)}" data-order-status="${o.id}" data-mode="${mode}">
          ${options.map(s => `<option ${s === current ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
        </select></td></tr>`;
    }).join("")}</tbody></table></div>`;
}
async function showDashboard(view) {
  state.view = view;
  $("hero").classList.toggle("hidden", view !== "customer");
  $("customerView").classList.toggle("hidden", view !== "customer");
  $("dashboardView").classList.toggle("hidden", view === "customer");
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  if (view === "customer") { window.scrollTo({top:0, behavior:"smooth"}); return; }
  $("dashboardKicker").textContent = view === "admin" ? "CONTROL CENTER" : view === "restaurant" ? "RESTAURANT WORKSPACE" : "DELIVERY WORKSPACE";
  $("dashboardTitle").textContent = view === "admin" ? "Admin dashboard" : view === "restaurant" ? "Restaurant dashboard" : "Delivery partner";
  $("dashboardSubtitle").textContent = view === "admin" ? "Review the platform's orders and menu." : view === "restaurant" ? "Manage menu prices and order preparation." : "Track orders that are ready for pickup or delivery.";
  try {
    const restaurants = state.restaurants.length ? state.restaurants : await api("/api/restaurants");
    state.restaurants = restaurants;
    const orders = await loadOrders(view === "delivery" ? "delivery" : view);
    state.orders = orders;
    if (view === "admin") {
      const foodCount = restaurants.reduce((n, r) => n + r.menu.length, 0);
      $("dashboardContent").innerHTML = `<div class="dashboard-grid">${statCard(restaurants.length,"Restaurants")}${statCard(foodCount,"Menu items")}${statCard(orders.length,"Orders")}</div>
        <div class="role-note">Admin demo: inspect orders and update order status. This learning version does not include login permissions yet.</div>
        <h3>All orders</h3>${renderOrderTable(orders,"admin")}
        <h3 style="margin-top:28px">Restaurants and menus</h3>${renderFoodTable(restaurants)}`;
    } else if (view === "restaurant") {
      const chosen = Number(state.selectedRestaurant || restaurants[0]?.id || 1);
      $("dashboardContent").innerHTML = `<div class="role-note">Select a restaurant to review its menu and orders. Changes are saved in SQLite.</div>
        <label class="muted" for="restaurantSelect">Your restaurant</label>
        <select id="restaurantSelect" class="price-input" style="display:block;margin:8px 0 18px;min-width:250px">
          ${restaurants.map(r => `<option value="${r.id}" ${r.id === chosen ? "selected" : ""}>${escapeHtml(r.name)}</option>`).join("")}
        </select>
        <div id="restaurantPanel"></div>`;
      renderRestaurantPanel(chosen, orders);
    } else {
      $("dashboardContent").innerHTML = `<div class="role-note">This demo lists orders marked Ready for Pickup or Out for Delivery. Choose a delivery status to update it.</div>${renderOrderTable(orders,"delivery")}`;
    }
  } catch (error) {
    $("dashboardContent").innerHTML = `<div class="empty">Could not load dashboard: ${escapeHtml(error.message)}</div>`;
  }
}
function renderFoodTable(restaurants) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Restaurant</th><th>Food item</th><th>Price</th><th>Update price</th></tr></thead><tbody>
  ${restaurants.flatMap(r => r.menu.map(f => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(f.emoji)} ${escapeHtml(f.name)}</td><td>${money(f.price)}</td>
  <td><form class="price-form" data-food="${f.id}"><input class="price-input" aria-label="New price for ${escapeHtml(f.name)}" type="number" min="1" max="100000" step=".01" value="${Number(f.price)}" required> <button class="small-btn">Save</button></form></td></tr>`)).join("")}
  </tbody></table></div>`;
}
function renderRestaurantPanel(restaurantId, allOrders) {
  const r = state.restaurants.find(item => item.id === Number(restaurantId));
  if (!r) return;
  const restaurantOrders = allOrders.filter(o => o.restaurant_id === r.id);
  $("restaurantPanel").innerHTML = `<h3>${escapeHtml(r.name)} menu</h3>${renderFoodTable([r])}<h3 style="margin-top:25px">Orders for ${escapeHtml(r.name)}</h3>${renderOrderTable(restaurantOrders,"admin")}`;
}
async function updateOrder(orderId, status, mode) {
  try {
    const endpoint = mode === "delivery" ? `/api/orders/${orderId}/delivery` : `/api/orders/${orderId}/status`;
    await api(endpoint, {method:"PATCH", body:JSON.stringify({status})});
    toast("Order status updated.");
    await showDashboard(state.view);
  } catch (error) { toast(error.message); }
}
async function updateFoodPrice(foodId, price) {
  try {
    await api(`/api/foods/${foodId}`, {method:"PATCH", body:JSON.stringify({price})});
    toast("Food price updated.");
    await loadRestaurants();
    await showDashboard(state.view);
  } catch (error) { toast(error.message); }
}

document.addEventListener("click", event => {
  const restaurantCard = event.target.closest("[data-restaurant]");
  const openButton = event.target.closest("[data-open]");
  if (openButton) { event.stopPropagation(); openRestaurant(openButton.dataset.open); return; }
  if (restaurantCard) { openRestaurant(restaurantCard.dataset.restaurant); return; }
  const addButton = event.target.closest("[data-add]");
  if (addButton) { addToCart(addButton.dataset.add); return; }
  const qtyButton = event.target.closest("[data-qty]");
  if (qtyButton) {
    const index = Number(qtyButton.dataset.qty), delta = Number(qtyButton.dataset.delta);
    if (!state.cart[index]) return;
    state.cart[index].quantity += delta;
    if (state.cart[index].quantity <= 0) state.cart.splice(index, 1);
    updateCartBadge(); cartContents(); return;
  }
  const navButton = event.target.closest("[data-view]");
  if (navButton) { showDashboard(navButton.dataset.view); return; }
  const filterButton = event.target.closest("[data-cuisine]");
  if (filterButton) {
    state.filter = filterButton.dataset.cuisine;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === filterButton));
    renderRestaurants(); return;
  }
  if (event.target.closest("#cartButton")) { cartContents(); return; }
  if (event.target.closest("#closeModal")) { closeModal(); return; }
  if (event.target.id === "modalBackdrop") { closeModal(); return; }
  if (event.target.closest("#viewCartButton")) { cartContents(); return; }
  if (event.target.closest("#continueShopping") || event.target.closest("#closeCartButton")) { closeModal(); showDashboard("customer"); return; }
  if (event.target.closest("#clearCartButton")) { state.cart = []; updateCartBadge(); cartContents(); toast("Cart cleared."); return; }
  if (event.target.closest("#goOrdersButton")) { closeModal(); showDashboard("admin"); return; }
  if (event.target.closest("#refreshButton")) { showDashboard(state.view); return; }
});
document.addEventListener("submit", async event => {
  if (event.target.id === "checkoutForm") { await submitOrder(event); return; }
  if (event.target.matches(".price-form")) {
    event.preventDefault();
    const foodId = Number(event.target.dataset.food);
    const price = Number(new FormData(event.target).values().next().value);
    await updateFoodPrice(foodId, price);
  }
});
document.addEventListener("change", event => {
  if (event.target.matches("[data-order-status]")) {
    updateOrder(Number(event.target.dataset.orderStatus), event.target.value, event.target.dataset.mode);
  }
  if (event.target.id === "restaurantSelect") {
    state.selectedRestaurant = Number(event.target.value);
    loadOrders("restaurant", state.selectedRestaurant).then(orders => renderRestaurantPanel(state.selectedRestaurant, orders)).catch(error => toast(error.message));
  }
});
$("searchButton").addEventListener("click", () => { state.search = $("searchInput").value.trim(); renderRestaurants(); });
$("searchInput").addEventListener("input", () => { state.search = $("searchInput").value.trim(); renderRestaurants(); });
$("searchInput").addEventListener("keydown", event => { if (event.key === "Enter") { state.search = event.target.value.trim(); renderRestaurants(); } });
$("closeModal").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", event => { if (event.target === $("modalBackdrop")) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });

loadRestaurants();
