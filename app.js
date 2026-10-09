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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/blocked */ }
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

function debounce(func, wait = 250) {
    let timeout;
    const debounced = function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
    debounced.cancel = () => clearTimeout(timeout);
    return debounced;
}

let cart = safeParse('nexora_cart', null) ?? safeParse('ecomm_cart', []);
let wishlist = safeParse('nexora_wishlist', null) ?? safeParse('ecomm_wishlist', []);
let savedTheme = localStorage.getItem('nexora_theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
let searchHistory = safeParse('nexora_search_history', []);
let currentUser = safeParse('nexora_current_user', null);

let currentCategory = 'all';
let searchQuery = '';
let currentSort = 'default';
let currentPage = 1;
const itemsPerPage = 12;
let lastFocusedEl = null;

const POPULAR_SEARCHES = ["iPhone 15", "Nike Shoes", "Sony Headphones", "MacBook Pro", "G-Shock", "Gaming RTX"];

// ==========================================
// 2. DOM ELEMENT REFERENCES
// ==========================================
const $ = id => document.getElementById(id);
const productContainer = $('product-container');
const paginationContainer = $('pagination-container');
const cartCountEl = $('cart-count');
const wishlistCountEl = $('wishlist-count');
const searchInput = $('search-input');
const searchBtn = $('search-btn');
const searchSuggestions = $('search-suggestions');
const sortSelect = $('sort-select');
const activeCategoryLabel = $('active-category-label');
const resetFilterBtn = $('reset-filter-btn');
const themeToggleBtn = $('theme-toggle-btn');
const themeIcon = $('theme-icon');
const navUserLabel = $('nav-user-label');
const navAuthBtn = $('nav-auth-btn');
const cartBtn = $('cart-btn');
const cartDrawer = $('cart-drawer');
const cartOverlay = $('cart-overlay');
const closeCartBtn = $('close-cart-btn');
const cartItemsContainer = $('cart-items');
const cartTotalEl = $('cart-total');
const productModal = $('product-modal');
const closeProductModalBtn = $('close-product-modal-btn');
const modalProductContent = $('modal-product-content');
const toastContainer = $('toast-container');

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (typeof products === 'undefined' || typeof getProductById !== 'function') {
        console.error('products.js must be loaded before app.js');
        if (productContainer) {
            productContainer.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:40px;">Products could not be loaded. Please refresh the page.</p>';
        }
        return;
    }
    initTheme();
    initAuthUI();
    updateBadges();
    readUrlParams();
    showSkeletonAndLoad();
    initEventListeners();
    renderHomeRecentlyViewed();
});

function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const q = params.get('q');
    if (cat) currentCategory = cat;
    if (q) {
        searchQuery = q.trim();
        if (searchInput) searchInput.value = searchQuery;
    }
}

// ==========================================
// 4. AUTH LABEL
// ==========================================
function initAuthUI() {
    if (!navUserLabel) return;
    if (currentUser && currentUser.name) {
        navUserLabel.textContent = currentUser.name.split(' ')[0];
        if (navAuthBtn) navAuthBtn.title = `Logged in as ${currentUser.name} (Click for Account)`;
    } else {
        navUserLabel.textContent = 'Sign In';
    }
}

// ==========================================
// 5. THEME ENGINE
// ==========================================
function initTheme() {
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    savedTheme = savedTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    localStorage.setItem('nexora_theme', savedTheme);
    updateThemeIcon(savedTheme);
    showToast(`Switched to ${savedTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
}

function updateThemeIcon(theme) {
    if (!themeIcon) return;
    if (theme === 'dark') themeIcon.classList.replace('fa-moon', 'fa-sun');
    else themeIcon.classList.replace('fa-sun', 'fa-moon');
}

// ==========================================
// 6. TOAST NOTIFICATIONS (XSS-safe)
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
// 7. SKELETON LOADER & PRODUCT RENDERING
// ==========================================
function showSkeletonAndLoad() {
    if (!productContainer) return;
    productContainer.innerHTML = Array.from({ length: 8 }, () => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-img"></div>
            <div class="skeleton skeleton-text-lg"></div>
            <div class="skeleton skeleton-text-md"></div>
            <div class="skeleton skeleton-text-sm"></div>
            <div class="skeleton skeleton-btn"></div>
        </div>`).join('');
    setTimeout(applyFilterAndSort, 250);
}

function getFilteredAndSortedProducts() {
    const q = searchQuery.toLowerCase();
    const cat = currentCategory.toLowerCase();

    const filtered = products.filter(p => {
        const matchesCategory = cat === 'all' || String(p.category).toLowerCase() === cat;
        const matchesSearch = !q ||
            String(p.title).toLowerCase().includes(q) ||
            String(p.category).toLowerCase().includes(q) ||
            String(p.brand).toLowerCase().includes(q) ||
            String(p.description).toLowerCase().includes(q);
        return matchesCategory && matchesSearch;
    });

    if (currentSort === 'price-low-high') filtered.sort((a, b) => a.price - b.price);
    else if (currentSort === 'price-high-low') filtered.sort((a, b) => b.price - a.price);
    else if (currentSort === 'rating-high-low') filtered.sort((a, b) => b.rating - a.rating);

    return filtered;
}

function applyFilterAndSort() {
    const filtered = getFilteredAndSortedProducts();
    const total = filtered.length;

    if (activeCategoryLabel) {
        if (searchQuery) activeCategoryLabel.textContent = `Search: "${searchQuery}" (${total} items)`;
        else if (currentCategory === 'all') activeCategoryLabel.textContent = `All Products (${total})`;
        else activeCategoryLabel.textContent = `${currentCategory} (${total})`;
    }

    const totalPages = Math.ceil(total / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    renderProducts(filtered.slice(start, start + itemsPerPage));
    renderPagination(totalPages);
}

function renderProducts(items) {
    if (!productContainer) return;

    if (items.length === 0) {
        productContainer.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <i class="fa-solid fa-box-open" style="font-size: 50px; color: var(--text-muted); margin-bottom: 15px;"></i>
                <h3>No Matching Products Found</h3>
                <p style="color: var(--text-muted); margin: 8px 0 20px;">Try searching with another keyword or explore our categories.</p>
                <button onclick="resetFilters()" class="btn-add-cart" style="width: auto; margin: 0 auto; padding: 10px 24px;">View All Products</button>
            </div>`;
        return;
    }

    productContainer.innerHTML = items.map(p => {
        const wished = wishlist.includes(p.id);
        const discount = getDiscount(p);
        const title = escapeHTML(p.title);
        const outOfStock = getMaxQty(p) <= 0;

        return `
            <div class="product-card" data-id="${p.id}">
                ${p.badge ? `<span class="product-badge">${escapeHTML(p.badge)}</span>` : ''}

                <button class="wishlist-toggle-btn ${wished ? 'active' : ''}"
                        onclick="toggleWishlist(${p.id})"
                        title="${wished ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                        aria-label="${wished ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                        aria-pressed="${wished}">
                    <i class="${wished ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>

                <div class="product-image-wrap" role="button" tabindex="0" aria-label="Quick view ${title}" onclick="openProductModal(${p.id})">
                    <img src="${escapeHTML(p.image)}" alt="${title}" loading="lazy" ${IMG_ERR}>
                    <div class="quick-view-overlay"><span><i class="fa-solid fa-eye"></i> Quick View</span></div>
                </div>

                <div class="product-info">
                    <span class="product-brand-tag">${escapeHTML(p.brand)} &bull; ${escapeHTML(p.category)}</span>
                    <h3 class="product-title" role="button" tabindex="0" onclick="openProductModal(${p.id})">${title}</h3>

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
                        <button class="btn-add-cart" onclick="addToCart(${p.id})" ${outOfStock ? 'disabled' : ''}>
                            <i class="fa-solid fa-cart-shopping"></i> ${outOfStock ? 'Out of Stock' : 'Add'}
                        </button>
                        <a href="pages/product.html?id=${p.id}" class="btn-view-details" title="Full Product Page" aria-label="Full product page">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                </div>
            </div>`;
    }).join('');
}

function renderPagination(totalPages) {
    if (!paginationContainer) return;
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let html = `<button class="page-btn" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)) {
            html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" ${p === currentPage ? 'aria-current="page"' : ''} onclick="goToPage(${p})">${p}</button>`;
        } else if (p === currentPage - 3 || p === currentPage + 3) {
            html += `<span style="padding: 0 4px; color: var(--text-muted);">&bull;&bull;&bull;</span>`;
        }
    }

    html += `<button class="page-btn" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;
    paginationContainer.innerHTML = html;
}

function goToPage(page) {
    currentPage = Math.max(1, page);
    applyFilterAndSort();
    const section = $('featured-products');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
// 8. SEARCH WITH HIGHLIGHTING & HISTORY
// ==========================================
function highlightMatch(text, query) {
    const safeText = escapeHTML(text);
    if (!query) return safeText;
    const escapedQuery = escapeHTML(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safeText.replace(new RegExp(`(${escapedQuery})`, 'gi'), '<span class="highlight">$1</span>');
}

function tagPill(term, iconClass) {
    const t = escapeHTML(term);
    return `<button type="button" class="tag-pill" data-term="${t}"><i class="${iconClass}" style="font-size: 11px;"></i> ${t}</button>`;
}

function renderSearchSuggestionsBox(query = '') {
    if (!searchSuggestions) return;
    let html = '';

    if (query.length >= 2) {
        const q = query.toLowerCase();
        const matches = products.filter(p =>
            String(p.title).toLowerCase().includes(q) ||
            String(p.brand).toLowerCase().includes(q) ||
            String(p.category).toLowerCase().includes(q)
        ).slice(0, 6);

        if (matches.length > 0) {
            html += `<div class="suggestion-header"><span>Matching Products</span></div>`;
            html += matches.map(p => `
                <div class="suggestion-item" role="button" tabindex="0" onclick="selectSuggestion(${p.id})">
                    <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.title)}" ${IMG_ERR}>
                    <div class="suggestion-info">
                        <div class="suggestion-title">${highlightMatch(p.title, query)}</div>
                        <div class="suggestion-price">${formatPrice(p.price)} &bull; <small style="color:var(--text-muted)">${escapeHTML(p.brand)}</small></div>
                    </div>
                </div>`).join('');
        }
    }

    html += `
        <div class="suggestion-header"><span>Popular Trending Searches</span></div>
        <div class="tags-row">${POPULAR_SEARCHES.map(t => tagPill(t, 'fa-solid fa-fire text-danger')).join('')}</div>`;

    if (searchHistory.length > 0) {
        html += `
            <div class="suggestion-header">
                <span>Recent Searches</span>
                <button type="button" onclick="clearSearchHistory()">Clear</button>
            </div>
            <div class="tags-row">${searchHistory.map(t => tagPill(t, 'fa-solid fa-clock-rotate-left')).join('')}</div>`;
    }

    searchSuggestions.innerHTML = html;
    searchSuggestions.classList.add('active');
}

function saveToHistory(term) {
    if (term.length < 2) return;
    searchHistory = [term, ...searchHistory.filter(t => t.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    safeSet('nexora_search_history', searchHistory);
}

// Commits a search (Enter / button / tag click): saves history, closes box, filters
function commitSearch(term) {
    handleDebouncedSearch.cancel();
    searchQuery = term.trim();
    currentPage = 1;
    saveToHistory(searchQuery);
    if (searchSuggestions) searchSuggestions.classList.remove('active');
    applyFilterAndSort();
}

// Live filtering while typing (does NOT save history)
const handleDebouncedSearch = debounce((query) => {
    searchQuery = query;
    currentPage = 1;
    renderSearchSuggestionsBox(query);
    applyFilterAndSort();
}, 250);

function applySearchTag(term) {
    if (searchInput) searchInput.value = term;
    commitSearch(term);
}

function clearSearchHistory() {
    searchHistory = [];
    localStorage.removeItem('nexora_search_history');
    renderSearchSuggestionsBox(searchInput ? searchInput.value.trim() : '');
}

function selectSuggestion(productId) {
    if (searchSuggestions) searchSuggestions.classList.remove('active');
    openProductModal(productId);
}

// ==========================================
// 9. RECENTLY VIEWED (HOMEPAGE)
// ==========================================
function renderHomeRecentlyViewed() {
    const container = $('home-recently-viewed-container');
    const section = $('home-recently-viewed-section');
    if (!container || !section) return;

    const ids = safeParse('nexora_recent', []);
    const items = ids.slice(0, 4).map(id => getProductById(id)).filter(Boolean);
    if (items.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    container.innerHTML = items.map(p => {
        const discount = getDiscount(p);
        const title = escapeHTML(p.title);
        return `
            <div class="product-card">
                ${p.badge ? `<span class="product-badge">${escapeHTML(p.badge)}</span>` : ''}
                <a class="product-image-wrap" href="pages/product.html?id=${p.id}" aria-label="${title}">
                    <img src="${escapeHTML(p.image)}" alt="${title}" loading="lazy" ${IMG_ERR}>
                </a>
                <div class="product-info">
                    <span class="product-brand-tag">${escapeHTML(p.brand)}</span>
                    <h3 class="product-title"><a href="pages/product.html?id=${p.id}" style="color: inherit; text-decoration: none;">${title}</a></h3>
                    <div class="price-row">
                        <span class="current-price">${formatPrice(p.price)}</span>
                        ${discount > 0 ? `<span class="discount-pill">${discount}% OFF</span>` : ''}
                    </div>
                    <button class="btn-add-cart" onclick="addToCart(${p.id})">
                        <i class="fa-solid fa-cart-shopping"></i> Add To Cart
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ==========================================
// 10. CART (with stock limits)
// ==========================================
function addToCart(productId, quantity = 1) {
    const product = getProductById(productId);
    if (!product) return;

    const max = getMaxQty(product);
    const existing = cart.find(item => item.id === productId);
    const newQty = (existing ? existing.quantity : 0) + quantity;

    if (max <= 0) {
        showToast(`"${product.title}" is out of stock`, 'info');
        return;
    }
    if (newQty > max) {
        showToast(`Only ${max} unit(s) of "${product.title}" available`, 'info');
        return;
    }

    if (existing) existing.quantity = newQty;
    else cart.push({ id: productId, quantity });

    saveCart();
    updateBadges();
    showToast(`Added "${product.title}" to Cart!`);

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
    saveCart();
    updateBadges();
    renderCartDrawer();
}

function removeFromCart(productId) {
    const product = getProductById(productId);
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateBadges();
    renderCartDrawer();
    if (product) showToast(`Removed "${product.title}" from Cart`, 'info');
}

function saveCart() {
    safeSet('nexora_cart', cart);
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
// 11. WISHLIST
// ==========================================
function toggleWishlist(productId) {
    const product = getProductById(productId);
    if (!product) return;

    const index = wishlist.indexOf(productId);
    if (index > -1) {
        wishlist.splice(index, 1);
        showToast(`Removed "${product.title}" from Wishlist`, 'info');
    } else {
        wishlist.push(productId);
        showToast(`Added "${product.title}" to Wishlist!`);
    }

    safeSet('nexora_wishlist', wishlist);
    updateBadges();
    applyFilterAndSort();
}

// ==========================================
// 12. QUICK VIEW MODAL & RECENTLY VIEWED
// ==========================================
function trackRecentlyViewed(productId) {
    let recent = safeParse('nexora_recent', []).filter(id => id !== productId);
    recent.unshift(productId);
    safeSet('nexora_recent', recent.slice(0, 8));
    renderHomeRecentlyViewed();
}

function openProductModal(productId) {
    const p = getProductById(productId);
    if (!p || !modalProductContent) return;

    trackRecentlyViewed(productId);
    const discount = getDiscount(p);
    const max = getMaxQty(p);
    const title = escapeHTML(p.title);

    let stockHtml;
    if (max <= 0) stockHtml = '<i class="fa-solid fa-circle-xmark"></i> Out of Stock';
    else if (max <= 5) stockHtml = `<i class="fa-solid fa-circle-check"></i> Only ${max} left in stock - order soon!`;
    else stockHtml = '<i class="fa-solid fa-circle-check"></i> In Stock & Ready to Ship';

    modalProductContent.innerHTML = `
        <div class="modal-product-grid">
            <div class="modal-product-img"><img src="${escapeHTML(p.image)}" alt="${title}" ${IMG_ERR}></div>
            <div class="modal-product-details">
                <span class="product-brand-tag">${escapeHTML(p.brand)} &bull; ${escapeHTML(p.category)}</span>
                <h2>${title}</h2>
                <div class="product-rating">
                    <span class="stars">${renderStars(p.rating)}</span>
                    <span class="rating-num">${p.rating}</span>
                    <span class="reviews-count">(${p.reviewsCount} customer reviews)</span>
                </div>
                <div class="price-row modal-price">
                    <span class="current-price">${formatPrice(p.price)}</span>
                    ${discount > 0 ? `<span class="original-price">${formatPrice(p.originalPrice)}</span>
                    <span class="discount-pill">${discount}% OFF</span>` : ''}
                </div>
                <p class="product-desc">${escapeHTML(p.description)}</p>
                <div class="stock-status">${stockHtml}</div>
                <div class="modal-actions">
                    <button class="btn-add-cart" style="flex: 2; padding: 12px;" ${max <= 0 ? 'disabled' : ''} onclick="addToCart(${p.id}); closeProductModal();">
                        <i class="fa-solid fa-cart-shopping"></i> Add To Cart
                    </button>
                    <a href="pages/product.html?id=${p.id}" class="modal-view-full-btn">Details Page <i class="fa-solid fa-arrow-right"></i></a>
                </div>
            </div>
        </div>`;

    if (productModal) {
        lastFocusedEl = document.activeElement;
        productModal.classList.add('active');
        productModal.setAttribute('role', 'dialog');
        productModal.setAttribute('aria-modal', 'true');
        document.body.style.overflow = 'hidden';
        if (closeProductModalBtn) closeProductModalBtn.focus();
    }
}

function closeProductModal() {
    if (!productModal || !productModal.classList.contains('active')) return;
    productModal.classList.remove('active');
    document.body.style.overflow = '';
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') lastFocusedEl.focus();
}

// ==========================================
// 13. UI HELPERS
// ==========================================
function updateBadges() {
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountEl) cartCountEl.textContent = total;
    if (wishlistCountEl) wishlistCountEl.textContent = wishlist.length;
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

function filterByCategory(categoryName) {
    currentCategory = categoryName;
    searchQuery = '';
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    showSkeletonAndLoad();
    const section = $('featured-products');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFilters() {
    currentCategory = 'all';
    searchQuery = '';
    currentSort = 'default';
    currentPage = 1;
    if (searchInput) searchInput.value = '';
    if (sortSelect) sortSelect.value = 'default';
    showSkeletonAndLoad();
}

// ==========================================
// 14. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    if (searchInput) {
        searchInput.addEventListener('focus', () => renderSearchSuggestionsBox(searchInput.value.trim()));
        searchInput.addEventListener('input', e => handleDebouncedSearch(e.target.value.trim()));
        searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitSearch(searchInput.value);
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput) commitSearch(searchInput.value);
        });
    }

    // Tag pills (popular / recent) - safe, no inline JS with user text
    if (searchSuggestions) {
        searchSuggestions.addEventListener('click', e => {
            const pill = e.target.closest('[data-term]');
            if (pill) applySearchTag(pill.dataset.term);
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', e => {
            currentSort = e.target.value;
            currentPage = 1;
            applyFilterAndSort();
        });
    }

    if (resetFilterBtn) resetFilterBtn.addEventListener('click', resetFilters);

    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

    if (closeProductModalBtn) closeProductModalBtn.addEventListener('click', closeProductModal);
    if (productModal) {
        productModal.addEventListener('click', e => {
            if (e.target === productModal) closeProductModal();
        });
    }

    // Close search box on outside click
    document.addEventListener('click', e => {
        if (searchSuggestions && !e.target.closest('.search-wrapper')) {
            searchSuggestions.classList.remove('active');
        }
    });

    // Global keyboard handling
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeCart();
            closeProductModal();
            if (searchSuggestions) searchSuggestions.classList.remove('active');
            return;
        }

        // Make non-button role="button" elements keyboard-clickable
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]:not(button)')) {
            e.preventDefault();
            e.target.click();
            return;
        }

        // "/" focuses the search bar
        const tag = (e.target.tagName || '').toLowerCase();
        if (e.key === '/' && searchInput && !['input', 'textarea', 'select'].includes(tag)) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // Category dropdown links (add data-category to each link for multi-word names)
    document.querySelectorAll('.mega-dropdown a, .menu a[data-category]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const category = link.getAttribute('data-category') || link.textContent.trim();
            filterByCategory(category);
        });
    });

    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', () => {
            const cat = card.getAttribute('data-category');
            if (cat) filterByCategory(cat);
        });
    });

    const heroBtn = $('hero-shop-btn');
    if (heroBtn) {
        heroBtn.addEventListener('click', () => {
            const section = $('featured-products');
            if (section) section.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // Keep cart/wishlist in sync across browser tabs
    window.addEventListener('storage', e => {
        if (!['nexora_cart', 'nexora_wishlist'].includes(e.key)) return;
        cart = safeParse('nexora_cart', []);
        wishlist = safeParse('nexora_wishlist', []);
        updateBadges();
        if (cartDrawer && cartDrawer.classList.contains('active')) renderCartDrawer();
        applyFilterAndSort();
    });
}