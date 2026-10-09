/**
 * ====================================================================
 * NEXORA - Dedicated Wishlist Controller (wishlist.js)
 * Manages full-page wishlist view, 1-click move to cart, stock bounds,
 * XSS-safe escaping, and multi-tab synchronization.
 * ====================================================================
 */

// ==========================================
// 1. HELPERS & APPLICATION STATE
// ==========================================
function safeParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : (JSON.parse(raw) ?? fallback);
    } catch (e) {
        return fallback;
    }
}

function safeSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* storage blocked or quota exceeded */
    }
}

function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

const formatPrice = n => '₹' + Number(n || 0).toLocaleString('en-IN');

function getDiscount(p) {
    return p.originalPrice > p.price
        ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
        : 0;
}

function getMaxQty(p) {
    return Number.isFinite(p.stock) ? p.stock : Infinity;
}

const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e7eb"/>' +
    '<text x="50%" y="50%" fill="#9ca3af" font-family="Arial" font-size="20" text-anchor="middle">No Image</text></svg>'
);
const IMG_ERR = `onerror="this.onerror=null;this.src=FALLBACK_IMG"`;

// Read only nexora_cart & nexora_wishlist (with fallback for legacy data)
let cart = safeParse('nexora_cart', null) ?? safeParse('ecomm_cart', []);
let wishlist = safeParse('nexora_wishlist', null) ?? safeParse('ecomm_wishlist', []);
let savedTheme = localStorage.getItem('nexora_theme') || 'light';
let currentUser = safeParse('nexora_current_user', null);

// ==========================================
// 2. DOM REFERENCES
// ==========================================
const $ = id => document.getElementById(id);
const container = $('wishlist-container');
const totalCountEl = $('wishlist-total-count');
const wishlistCountEl = $('wishlist-count');
const cartCountEl = $('cart-count');
const themeToggleBtn = $('theme-toggle-btn');
const themeIcon = $('theme-icon');
const navUserLabel = $('nav-user-label');
const searchInput = $('wishlist-search-input');
const toastContainer = $('toast-container');

// Cart Drawer
const cartBtn = $('cart-btn');
const cartDrawer = $('cart-drawer');
const cartOverlay = $('cart-overlay');
const closeCartBtn = $('close-cart-btn');
const cartItemsContainer = $('cart-items');
const cartTotalEl = $('cart-total');

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof products === 'undefined' || typeof getProductById !== 'function') {
        console.error('products.js must be loaded before wishlist.js');
        return;
    }
    initTheme();
    initAuthUI();
    updateBadges();
    renderWishlistPage();
    initEventListeners();
});

// ==========================================
// 4. THEME & AUTH
// ==========================================
function initTheme() {
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

function toggleTheme() {
    savedTheme = savedTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    localStorage.setItem('nexora_theme', savedTheme);
    if (themeIcon) {
        themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
    showToast(`Switched to ${savedTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
}

function initAuthUI() {
    if (!navUserLabel) return;
    if (currentUser && currentUser.name) {
        navUserLabel.textContent = currentUser.name.split(' ')[0];
    } else {
        navUserLabel.textContent = 'Sign In';
    }
}

function updateBadges() {
    const totalCart = cart.reduce((t, i) => t + i.quantity, 0);
    if (cartCountEl) cartCountEl.textContent = totalCart;
    if (wishlistCountEl) wishlistCountEl.textContent = wishlist.length;
    if (totalCountEl) totalCountEl.textContent = wishlist.length;
}

// ==========================================
// 5. TOAST NOTIFICATIONS (XSS-safe)
// ==========================================
function showToast(message, type = 'success') {
    if (!toastContainer) return;
    toastContainer.setAttribute('aria-live', 'polite');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');

    const icon = document.createElement('i');
    icon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info';
    const text = document.createElement('span');
    text.textContent = message;

    toast.append(icon, ' ', text);
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==========================================
// 6. RENDER WISHLIST GRID
// ==========================================
function renderWishlistPage(filterQuery = '') {
    if (!container) return;

    if (wishlist.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 70px 20px;">
                <i class="fa-regular fa-heart text-danger" style="font-size: 56px; margin-bottom: 16px; opacity: 0.85;"></i>
                <h3 style="font-size: 22px; font-weight: 800; color: var(--text-main);">Your Wishlist is Empty</h3>
                <p style="color: var(--text-muted); margin: 8px 0 24px; max-width: 450px; margin-left: auto; margin-right: auto;">
                    You haven't saved any items yet. Explore our 200+ top-tier electronics, fashion, and lifestyle products to start building your wishlist.
                </p>
                <a href="../index.html" class="btn-add-cart" style="display: inline-flex; width: auto; padding: 12px 28px; text-decoration: none;">
                    <i class="fa-solid fa-compass"></i> Start Shopping
                </a>
            </div>
        `;
        return;
    }

    let items = wishlist.map(id => getProductById(id)).filter(Boolean);

    if (filterQuery) {
        const q = filterQuery.toLowerCase();
        items = items.filter(p => 
            String(p.title).toLowerCase().includes(q) ||
            String(p.brand).toLowerCase().includes(q) ||
            String(p.category).toLowerCase().includes(q)
        );
    }

    if (items.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 50px 20px;">
                <p style="color: var(--text-muted);">No saved items match "${escapeHTML(filterQuery)}".</p>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(p => {
        const discount = getDiscount(p);
        const title = escapeHTML(p.title);
        const outOfStock = getMaxQty(p) <= 0;

        return `
            <div class="product-card" data-id="${p.id}">
                ${p.badge ? `<span class="product-badge">${escapeHTML(p.badge)}</span>` : ''}

                <button class="wishlist-toggle-btn active" onclick="removeFromWishlist(${p.id})" title="Remove item" aria-label="Remove ${title} from wishlist">
                    <i class="fa-solid fa-trash-can" style="font-size: 13px;"></i>
                </button>

                <div class="product-image-wrap" role="button" tabindex="0" onclick="window.location.href='product.html?id=${p.id}'" aria-label="View ${title}">
                    <img src="${escapeHTML(p.image)}" alt="${title}" loading="lazy" ${IMG_ERR}>
                </div>

                <div class="product-info">
                    <span class="product-brand-tag">${escapeHTML(p.brand)} &bull; ${escapeHTML(p.category)}</span>
                    <h3 class="product-title" onclick="window.location.href='product.html?id=${p.id}'">${title}</h3>

                    <div class="product-rating">
                        <span class="stars">${renderStars(p.rating)}</span>
                        <span class="rating-num">${p.rating}</span>
                        <span class="reviews-count">(${p.reviewsCount})</span>
                    </div>

                    <div class="price-row">
                        <span class="current-price">${formatPrice(p.price)}</span>
                        ${discount > 0 ? `<span class="original-price">${formatPrice(p.originalPrice)}</span>
                        <span class="discount-pill">${discount}% OFF</span>` : ''}
                    </div>

                    <div class="card-actions">
                        <button class="btn-add-cart" onclick="moveItemToCart(${p.id})" ${outOfStock ? 'disabled' : ''}>
                            <i class="fa-solid fa-cart-plus"></i> ${outOfStock ? 'Out of Stock' : 'Move to Cart'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ==========================================
// 7. WISHLIST ACTIONS & CART TRANSFER
// ==========================================
function removeFromWishlist(id) {
    const prod = getProductById(id);
    wishlist = wishlist.filter(itemId => itemId !== id);
    safeSet('nexora_wishlist', wishlist);
    updateBadges();
    renderWishlistPage(searchInput ? searchInput.value.trim() : '');
    if (prod) showToast(`Removed "${prod.title}" from Wishlist`, 'info');
}

function moveItemToCart(id) {
    const prod = getProductById(id);
    if (!prod) return;

    const max = getMaxQty(prod);
    if (max <= 0) {
        showToast(`"${prod.title}" is currently out of stock`, 'info');
        return;
    }

    const existing = cart.find(i => i.id === id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty >= max) {
        showToast(`Cannot add more. Stock limit of ${max} reached for "${prod.title}"`, 'info');
        return;
    }

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id, quantity: 1 });
    }
    safeSet('nexora_cart', cart);

    // Remove from wishlist
    wishlist = wishlist.filter(itemId => itemId !== id);
    safeSet('nexora_wishlist', wishlist);

    updateBadges();
    renderWishlistPage(searchInput ? searchInput.value.trim() : '');
    showToast(`Moved "${prod.title}" to Shopping Cart!`);

    if (cartBtn) {
        cartBtn.classList.add('shake-anim');
        setTimeout(() => cartBtn.classList.remove('shake-anim'), 400);
    }
}

function moveAllToCart() {
    if (wishlist.length === 0) {
        showToast('Your wishlist is empty.', 'info');
        return;
    }

    let movedCount = 0;
    let skippedCount = 0;

    const remainingWishlist = [];

    wishlist.forEach(id => {
        const prod = getProductById(id);
        if (!prod) return;

        const max = getMaxQty(prod);
        if (max <= 0) {
            skippedCount++;
            remainingWishlist.push(id);
            return;
        }

        const existing = cart.find(i => i.id === id);
        const currentQty = existing ? existing.quantity : 0;

        if (currentQty >= max) {
            skippedCount++;
            remainingWishlist.push(id);
            return;
        }

        if (existing) {
            existing.quantity += 1;
        } else {
            cart.push({ id, quantity: 1 });
        }
        movedCount++;
    });

    wishlist = remainingWishlist;
    safeSet('nexora_cart', cart);
    safeSet('nexora_wishlist', wishlist);

    updateBadges();
    renderWishlistPage();

    if (movedCount > 0) {
        showToast(`Moved ${movedCount} item(s) to Cart!`);
    }
    if (skippedCount > 0) {
        showToast(`${skippedCount} item(s) could not be moved due to stock limits`, 'info');
    }
}

function clearAllWishlist() {
    if (wishlist.length === 0) return;
    if (confirm('Are you sure you want to remove all saved items from your wishlist?')) {
        wishlist = [];
        safeSet('nexora_wishlist', wishlist);
        updateBadges();
        renderWishlistPage();
        showToast('Wishlist cleared.', 'info');
    }
}

function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r % 1 >= 0.5;
    return '<i class="fa-solid fa-star"></i>'.repeat(full) +
        (half ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
        '<i class="fa-regular fa-star"></i>'.repeat(5 - full - (half ? 1 : 0));
}

// ==========================================
// 8. CART DRAWER UTILITIES
// ==========================================
function openCart() {
    renderCartDrawer();
    if (cartDrawer && cartOverlay) {
        cartDrawer.classList.add('active');
        cartOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeCart() {
    if (cartDrawer && cartOverlay) {
        cartDrawer.classList.remove('active');
        cartOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateCartQuantity(productId, delta) {
    const item = cart.find(i => i.id === productId);
    const product = getProductById(productId);
    if (!item || !product) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
        removeFromCart(productId);
        return;
    }
    if (newQty > getMaxQty(product)) {
        showToast(`Only ${getMaxQty(product)} unit(s) available for "${product.title}"`, 'info');
        return;
    }

    item.quantity = newQty;
    safeSet('nexora_cart', cart);
    updateBadges();
    renderCartDrawer();
}

function removeFromCart(productId) {
    const product = getProductById(productId);
    cart = cart.filter(item => item.id !== productId);
    safeSet('nexora_cart', cart);
    updateBadges();
    renderCartDrawer();
    if (product) showToast(`Removed "${product.title}" from Cart`, 'info');
}

function renderCartDrawer() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-drawer">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <p>Your shopping cart is empty.</p>
                <button class="btn-add-cart" style="width: auto; margin: 0 auto; padding: 10px 20px;" onclick="closeCart();">Start Shopping</button>
            </div>`;
        if (cartTotalEl) cartTotalEl.textContent = formatPrice(0);
        return;
    }

    let subtotal = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
        const p = getProductById(item.id);
        if (!p) return '';
        const itemTotal = p.price * item.quantity;
        subtotal += itemTotal;

        return `
            <div class="cart-item">
                <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" ${IMG_ERR}>
                <div class="cart-item-details">
                    <h4>${escapeHTML(p.title)}</h4>
                    <p class="cart-item-price">${formatPrice(p.price)}</p>
                    <div class="qty-control">
                        <button aria-label="Decrease quantity" onclick="updateCartQuantity(${p.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button aria-label="Increase quantity" onclick="updateCartQuantity(${p.id}, 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-action">
                    <span class="item-total">${formatPrice(itemTotal)}</span>
                    <button class="btn-remove" onclick="removeFromCart(${p.id})" title="Remove item" aria-label="Remove item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>`;
    }).join('');

    if (cartTotalEl) cartTotalEl.textContent = formatPrice(subtotal);
}

// ==========================================
// 9. EVENT LISTENERS & CROSS-TAB SYNC
// ==========================================
function initEventListeners() {
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    if (searchInput) {
        searchInput.addEventListener('input', e => {
            renderWishlistPage(e.target.value.trim());
        });
    }

    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCart();
    });

    // Cross-tab synchronization
    window.addEventListener('storage', e => {
        if (!['nexora_cart', 'nexora_wishlist', 'nexora_theme'].includes(e.key)) return;
        if (e.key === 'nexora_theme') {
            savedTheme = localStorage.getItem('nexora_theme') || 'light';
            initTheme();
        }
        cart = safeParse('nexora_cart', []);
        wishlist = safeParse('nexora_wishlist', []);
        updateBadges();
        if (cartDrawer && cartDrawer.classList.contains('active')) renderCartDrawer();
        renderWishlistPage(searchInput ? searchInput.value.trim() : '');
    });
}
