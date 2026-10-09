/**
 * ====================================================================
 * NEXORA - Dedicated Product Details Controller (product.js)
 * Manages URL query params, product rendering, galleries, tabs,
 * reviews, related products, stock bounds, and LocalStorage state.
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

// Shared LocalStorage keys
let cart = safeParse('nexora_cart', null) ?? safeParse('ecomm_cart', []);
let wishlist = safeParse('nexora_wishlist', null) ?? safeParse('ecomm_wishlist', []);
let savedTheme = localStorage.getItem('nexora_theme') || 'light';
let currentUser = safeParse('nexora_current_user', null);

let currentProduct = null;
let selectedQuantity = 1;

// Dynamic review store per product
let productReviews = safeParse('nexora_user_reviews', {});

// ==========================================
// 2. DOM REFERENCES
// ==========================================
const $ = id => document.getElementById(id);
const mountPoint = $('product-detail-mount');
const cartCountEl = $('cart-count');
const wishlistCountEl = $('wishlist-count');
const themeToggleBtn = $('theme-toggle-btn');
const themeIcon = $('theme-icon');
const navUserLabel = $('nav-user-label');
const searchInput = $('detail-search-input');
const searchBtn = $('detail-search-btn');
const toastContainer = $('toast-container');

// Cart Drawer
const cartBtn = $('cart-btn');
const cartDrawer = $('cart-drawer');
const cartOverlay = $('cart-overlay');
const closeCartBtn = $('close-cart-btn');
const cartItemsContainer = $('cart-items');
const cartTotalEl = $('cart-total');

// Wishlist Modal
const wishlistModal = $('wishlist-modal');
const closeWishlistBtn = $('close-wishlist-btn');
const wishlistItemsContainer = $('wishlist-items');

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof products === 'undefined' || typeof getProductById !== 'function') {
        console.error('products.js must be loaded before product.js');
        if (mountPoint) {
            mountPoint.innerHTML = '<p style="text-align:center;padding:40px;">Products could not be loaded. Please refresh the page.</p>';
        }
        return;
    }
    initTheme();
    initAuthUI();
    updateBadges();
    loadProductFromUrl();
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
// 6. LOAD & RENDER PRODUCT
// ==========================================
function loadProductFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10) || 1;

    currentProduct = getProductById(id);

    if (!currentProduct) {
        if (mountPoint) {
            mountPoint.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <h2>Product Not Found</h2>
                    <p style="color: var(--text-muted); margin: 10px 0 20px;">The requested product could not be located in our catalog.</p>
                    <a href="../index.html" class="btn-add-cart" style="display: inline-flex; width: auto; padding: 12px 24px; text-decoration: none;">
                        Return to NEXORA Store
                    </a>
                </div>
            `;
        }
        return;
    }

    // Update document title & breadcrumbs
    document.title = `${currentProduct.title} | NEXORA`;
    const catEl = $('breadcrumb-category');
    const titleEl = $('breadcrumb-title');
    if (catEl) catEl.textContent = currentProduct.category;
    if (titleEl) titleEl.textContent = currentProduct.title;

    // Track viewed product (max 8, no duplicates)
    trackRecentlyViewed(currentProduct.id);

    // Render components
    renderProductDetails(currentProduct);
    renderTabsData(currentProduct);
    renderRelatedProducts(currentProduct);
    renderRecentlyViewed(currentProduct.id);
}

function renderProductDetails(prod) {
    if (!mountPoint) return;

    const isWishlisted = wishlist.includes(prod.id);
    const discount = getDiscount(prod);
    const savingsAmount = prod.originalPrice - prod.price;
    const max = getMaxQty(prod);
    const title = escapeHTML(prod.title);
    const outOfStock = max <= 0;

    let stockText;
    if (outOfStock) stockText = '<span style="color: var(--danger-color);"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>';
    else if (max <= 5) stockText = `<span style="color: var(--accent-orange);"><i class="fa-solid fa-triangle-exclamation"></i> Only ${max} left in stock - order soon!</span>`;
    else stockText = `<span style="color: var(--success-color);"><i class="fa-solid fa-circle-check"></i> In Stock (${max} units available)</span>`;

    mountPoint.innerHTML = `
        <div class="product-detail-layout">
            <!-- Left: Media Gallery -->
            <div class="product-gallery">
                <div class="main-image-container">
                    ${prod.badge ? `<span class="gallery-badge">${escapeHTML(prod.badge)}</span>` : ''}
                    <img id="main-product-img" src="${escapeHTML(prod.image)}" alt="${title}" ${IMG_ERR}>
                </div>
                <div class="thumbnails-row">
                    <div class="thumbnail-item active" onclick="swapImage(this, '${escapeHTML(prod.image)}')">
                        <img src="${escapeHTML(prod.image)}" alt="Thumbnail 1" ${IMG_ERR}>
                    </div>
                    <div class="thumbnail-item" onclick="swapImage(this, '${escapeHTML(prod.image)}&auto=format&fit=crop&w=800')">
                        <img src="${escapeHTML(prod.image)}" alt="Thumbnail 2" ${IMG_ERR}>
                    </div>
                    <div class="thumbnail-item" onclick="swapImage(this, '${escapeHTML(prod.image)}&auto=format&fit=crop&w=700')">
                        <img src="${escapeHTML(prod.image)}" alt="Thumbnail 3" ${IMG_ERR}>
                    </div>
                </div>
            </div>

            <!-- Right: Details & Purchase Controls -->
            <div class="product-details-content">
                <span class="brand-tag">${escapeHTML(prod.brand)} &bull; ${escapeHTML(prod.category)}</span>
                <h1>${title}</h1>

                <div class="details-rating">
                    <span class="stars">${renderStars(prod.rating)}</span>
                    <span class="rating-num">${prod.rating}</span>
                    <span class="reviews-count">(${prod.reviewsCount} customer reviews)</span>
                </div>

                <div class="price-box">
                    <div class="price-main-row">
                        <span class="detail-current-price">${formatPrice(prod.price)}</span>
                        ${discount > 0 ? `<span class="detail-original-price">${formatPrice(prod.originalPrice)}</span>
                        <span class="discount-pill">${discount}% OFF</span>` : ''}
                    </div>
                    ${savingsAmount > 0 ? `<span class="savings-label">You save ${formatPrice(savingsAmount)} (${discount}%)</span>` : ''}
                </div>

                <p class="detail-desc">${escapeHTML(prod.description)}</p>

                <!-- Perks Grid -->
                <div class="perks-grid">
                    <div class="perk-item">
                        <i class="fa-solid fa-truck-fast"></i>
                        <span>Free Express Shipping</span>
                    </div>
                    <div class="perk-item">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>Official Brand Warranty</span>
                    </div>
                    <div class="perk-item">
                        <i class="fa-solid fa-rotate-left"></i>
                        <span>7-Day Easy Replacement</span>
                    </div>
                    <div class="perk-item">
                        <i class="fa-solid fa-lock"></i>
                        <span>256-Bit Encrypted Pay</span>
                    </div>
                </div>

                <div class="stock-status" style="margin-bottom: 20px;">
                    ${stockText}
                </div>

                <!-- Purchase Controls -->
                <div class="purchase-controls">
                    <div class="qty-picker">
                        <button type="button" aria-label="Decrease quantity" onclick="adjustQty(-1)">-</button>
                        <input type="text" id="qty-input" value="1" readonly aria-label="Selected quantity">
                        <button type="button" aria-label="Increase quantity" onclick="adjustQty(1)">+</button>
                    </div>

                    <button class="detail-cart-btn" onclick="addCurrentProductToCart()" ${outOfStock ? 'disabled' : ''}>
                        <i class="fa-solid fa-cart-shopping"></i> ${outOfStock ? 'Out of Stock' : 'Add To Cart'}
                    </button>

                    <button class="detail-buy-btn" onclick="buyNowCurrentProduct()" ${outOfStock ? 'disabled' : ''}>
                        <i class="fa-solid fa-bolt"></i> Buy Now
                    </button>

                    <button class="detail-wish-btn ${isWishlisted ? 'active' : ''}" 
                            onclick="toggleProductWishlist()" 
                            id="detail-wishlist-toggle"
                            title="Save to Wishlist"
                            aria-label="Save to Wishlist"
                            aria-pressed="${isWishlisted}">
                        <i class="${isWishlisted ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function swapImage(thumbnailEl, src) {
    const mainImg = $('main-product-img');
    if (mainImg) mainImg.src = src;

    document.querySelectorAll('.thumbnail-item').forEach(el => el.classList.remove('active'));
    thumbnailEl.classList.add('active');
}

function adjustQty(delta) {
    const input = $('qty-input');
    if (!input || !currentProduct) return;
    const max = getMaxQty(currentProduct);
    if (max <= 0) return;

    let val = parseInt(input.value, 10) || 1;
    val += delta;
    if (val < 1) val = 1;
    if (val > max) {
        val = max;
        showToast(`Maximum ${max} unit(s) available`, 'info');
    }
    input.value = val;
    selectedQuantity = val;
}

function addCurrentProductToCart() {
    if (!currentProduct) return;
    const max = getMaxQty(currentProduct);
    if (max <= 0) {
        showToast(`"${currentProduct.title}" is out of stock`, 'info');
        return;
    }

    const existing = cart.find(i => i.id === currentProduct.id);
    const curQty = existing ? existing.quantity : 0;
    if (curQty + selectedQuantity > max) {
        showToast(`Only ${max} units available (you already have ${curQty} in cart)`, 'info');
        return;
    }

    addToCart(currentProduct.id, selectedQuantity);
}

function buyNowCurrentProduct() {
    if (!currentProduct) return;
    const max = getMaxQty(currentProduct);
    if (max <= 0) {
        showToast(`"${currentProduct.title}" is out of stock`, 'info');
        return;
    }

    addToCart(currentProduct.id, selectedQuantity);
    window.location.href = 'checkout.html';
}

function toggleProductWishlist() {
    if (!currentProduct) return;
    toggleWishlist(currentProduct.id);
    const wishBtn = $('detail-wishlist-toggle');
    if (wishBtn) {
        const isWish = wishlist.includes(currentProduct.id);
        wishBtn.classList.toggle('active', isWish);
        wishBtn.setAttribute('aria-pressed', isWish);
        wishBtn.querySelector('i').className = `${isWish ? 'fa-solid' : 'fa-regular'} fa-heart`;
    }
}

// ==========================================
// 7. TABS LOGIC
// ==========================================
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

    const activeBtn = Array.from(document.querySelectorAll('.tab-btn'))
        .find(b => b.getAttribute('onclick')?.includes(tabName));
    if (activeBtn) activeBtn.classList.add('active');

    const activePanel = $(`tab-${tabName}`);
    if (activePanel) activePanel.classList.add('active');
}

function renderTabsData(prod) {
    const fullDescEl = $('full-description');
    if (fullDescEl) {
        fullDescEl.textContent = `${prod.description} Built using high-grade aerospace materials and thoroughly tested to meet the highest safety and performance criteria. Guaranteed compatibility with standard industry ecosystems.`;
    }

    const specsBody = $('specs-table-body');
    if (specsBody) {
        specsBody.innerHTML = `
            <tr><td>Brand</td><td>${escapeHTML(prod.brand)}</td></tr>
            <tr><td>Category</td><td>${escapeHTML(prod.category)}</td></tr>
            <tr><td>Model</td><td>${escapeHTML(prod.title)}</td></tr>
            <tr><td>Product SKU</td><td>NX-${escapeHTML(prod.category.toUpperCase().slice(0, 3))}-${prod.id.toString().padStart(4, '0')}</td></tr>
            <tr><td>In Stock</td><td>${prod.stock} units</td></tr>
            <tr><td>Official Warranty</td><td>1 Year Global Replacement Warranty</td></tr>
            <tr><td>Package Includes</td><td>Device, Quickstart Manual, Official Warranty Card, Authentic Packaging</td></tr>
        `;
    }

    renderReviews(prod.id);
}

function renderReviews(prodId) {
    const listEl = $('reviews-list');
    const tabReviewsCount = $('tab-reviews-count');
    if (!listEl) return;

    const custom = productReviews[prodId] || [];
    const baseReviews = [
        {
            name: "Aman Verma",
            rating: 5,
            date: "2 days ago",
            comment: `Outstanding purchase! The build quality from ${currentProduct.brand} is truly top notch. Delivered within 24 hours by NEXORA.`
        },
        {
            name: "Pooja Mehta",
            rating: 4.8,
            date: "1 week ago",
            comment: "Totally worth the price. Sleek aesthetics and functions exactly as described. Highly recommended!"
        }
    ];

    const allReviews = [...custom, ...baseReviews];
    if (tabReviewsCount) tabReviewsCount.textContent = allReviews.length;

    listEl.innerHTML = allReviews.map(r => `
        <div class="review-item">
            <div class="review-item-header">
                <span class="reviewer-name">${escapeHTML(r.name)}</span>
                <span style="font-size: 12px; color: var(--text-muted);">${escapeHTML(r.date || 'Recent')}</span>
            </div>
            <div class="stars" style="margin-bottom: 6px;">${renderStars(r.rating)}</div>
            <p style="font-size: 13.5px; color: var(--text-muted);">${escapeHTML(r.comment)}</p>
        </div>
    `).join('');
}

function handleReviewSubmit(e) {
    e.preventDefault();
    if (!currentProduct) return;

    const nameInput = $('reviewer-name-input');
    const ratingInput = $('reviewer-rating-input');
    const commentInput = $('reviewer-comment-input');

    const newReview = {
        name: nameInput.value.trim(),
        rating: parseFloat(ratingInput.value),
        date: "Just now",
        comment: commentInput.value.trim()
    };

    if (!productReviews[currentProduct.id]) {
        productReviews[currentProduct.id] = [];
    }
    productReviews[currentProduct.id].unshift(newReview);
    safeSet('nexora_user_reviews', productReviews);

    e.target.reset();
    renderReviews(currentProduct.id);
    showToast('Your review has been published!');
}

// ==========================================
// 8. RELATED & RECENTLY VIEWED PRODUCTS
// ==========================================
function renderRelatedProducts(prod) {
    const container = $('related-products-container');
    if (!container) return;

    const related = getRelatedProducts(prod.category, prod.id, 4);
    container.innerHTML = related.map(p => renderSmallProductCard(p)).join('');
}

function renderRecentlyViewed(currentId) {
    const container = $('recently-viewed-container');
    const section = $('recently-viewed-section');
    if (!container || !section) return;

    const recentIds = safeParse('nexora_recent', []);
    const filteredIds = recentIds.filter(id => id !== currentId).slice(0, 4);

    if (filteredIds.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    const items = filteredIds.map(id => getProductById(id)).filter(Boolean);
    container.innerHTML = items.map(p => renderSmallProductCard(p)).join('');
}

function renderSmallProductCard(p) {
    const discount = getDiscount(p);
    const title = escapeHTML(p.title);
    return `
        <div class="product-card">
            ${p.badge ? `<span class="product-badge">${escapeHTML(p.badge)}</span>` : ''}
            <div class="product-image-wrap" role="button" tabindex="0" onclick="window.location.href='product.html?id=${p.id}'" aria-label="View ${title}">
                <img src="${escapeHTML(p.image)}" alt="${title}" loading="lazy" ${IMG_ERR}>
            </div>
            <div class="product-info">
                <span class="product-brand-tag">${escapeHTML(p.brand)}</span>
                <h3 class="product-title" onclick="window.location.href='product.html?id=${p.id}'">${title}</h3>
                <div class="price-row">
                    <span class="current-price">${formatPrice(p.price)}</span>
                    ${discount > 0 ? `<span class="discount-pill">${discount}% OFF</span>` : ''}
                </div>
                <button class="btn-add-cart" onclick="addToCart(${p.id})">
                    <i class="fa-solid fa-cart-shopping"></i> Add To Cart
                </button>
            </div>
        </div>
    `;
}

// Save viewed product id to nexora_recent (max 8, no duplicates)
function trackRecentlyViewed(productId) {
    let recent = safeParse('nexora_recent', []);
    recent = recent.filter(id => id !== productId);
    recent.unshift(productId);
    safeSet('nexora_recent', recent.slice(0, 8));
}

// ==========================================
// 9. SHARED CART & WISHLIST LOGIC
// ==========================================
function addToCart(productId, quantity = 1) {
    const prod = getProductById(productId);
    if (!prod) return;

    const max = getMaxQty(prod);
    const existing = cart.find(item => item.id === productId);
    const newQty = (existing ? existing.quantity : 0) + quantity;

    if (max <= 0) {
        showToast(`"${prod.title}" is out of stock`, 'info');
        return;
    }
    if (newQty > max) {
        showToast(`Only ${max} unit(s) available for "${prod.title}"`, 'info');
        return;
    }

    if (existing) existing.quantity = newQty;
    else cart.push({ id: productId, quantity });

    safeSet('nexora_cart', cart);
    updateBadges();
    showToast(`Added "${prod.title}" to Cart!`);

    if (cartBtn) {
        cartBtn.classList.add('shake-anim');
        setTimeout(() => cartBtn.classList.remove('shake-anim'), 400);
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
        showToast(`Only ${getMaxQty(product)} unit(s) available`, 'info');
        return;
    }

    item.quantity = newQty;
    safeSet('nexora_cart', cart);
    updateBadges();
    renderCartDrawer();
}

function removeFromCart(productId) {
    const prod = getProductById(productId);
    cart = cart.filter(item => item.id !== productId);
    safeSet('nexora_cart', cart);
    updateBadges();
    renderCartDrawer();
    if (prod) showToast(`Removed "${prod.title}" from Cart`, 'info');
}

function renderCartDrawer() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
            <div class="empty-drawer">
                <i class="fa-solid fa-cart-arrow-down"></i>
                <p>Your shopping cart is empty.</p>
                <button class="btn-add-cart" style="width: auto; margin: 0 auto; padding: 10px 20px;" onclick="closeCart();">Start Shopping</button>
            </div>
        `;
        if (cartTotalEl) cartTotalEl.textContent = formatPrice(0);
        return;
    }

    let subtotal = 0;
    cartItemsContainer.innerHTML = cart.map(item => {
        const prod = getProductById(item.id);
        if (!prod) return '';
        const itemTotal = prod.price * item.quantity;
        subtotal += itemTotal;

        return `
            <div class="cart-item">
                <img src="${escapeHTML(prod.image)}" alt="${escapeHTML(prod.title)}" ${IMG_ERR}>
                <div class="cart-item-details">
                    <h4>${escapeHTML(prod.title)}</h4>
                    <p class="cart-item-price">${formatPrice(prod.price)}</p>
                    <div class="qty-control">
                        <button aria-label="Decrease quantity" onclick="updateCartQuantity(${prod.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button aria-label="Increase quantity" onclick="updateCartQuantity(${prod.id}, 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-action">
                    <span class="item-total">${formatPrice(itemTotal)}</span>
                    <button class="btn-remove" onclick="removeFromCart(${prod.id})" title="Remove item" aria-label="Remove item">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    if (cartTotalEl) cartTotalEl.textContent = formatPrice(subtotal);
}

function toggleWishlist(productId) {
    const prod = getProductById(productId);
    if (!prod) return;

    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast(`Removed "${prod.title}" from Wishlist`, 'info');
    } else {
        wishlist.push(productId);
        showToast(`Added "${prod.title}" to Wishlist!`);
    }

    safeSet('nexora_wishlist', wishlist);
    updateBadges();
}

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

function renderStars(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const full = Math.floor(r);
    const half = r % 1 >= 0.5;
    return '<i class="fa-solid fa-star"></i>'.repeat(full) +
        (half ? '<i class="fa-solid fa-star-half-stroke"></i>' : '') +
        '<i class="fa-regular fa-star"></i>'.repeat(5 - full - (half ? 1 : 0));
}

// ==========================================
// 10. EVENT LISTENERS & CROSS-TAB SYNC
// ==========================================
function initEventListeners() {
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if (searchInput) {
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const val = searchInput.value.trim();
                if (val) window.location.href = `../index.html?q=${encodeURIComponent(val)}`;
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput && searchInput.value.trim()) {
                window.location.href = `../index.html?q=${encodeURIComponent(searchInput.value.trim())}`;
            }
        });
    }

    document.addEventListener('keydown', (e) => {
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
    });
}
