const userSelect = document.getElementById("userSelect");
const refreshBtn = document.getElementById("refreshBtn");
const recGrid = document.getElementById("recGrid");
const recEmpty = document.getElementById("recEmpty");
const recMeta = document.getElementById("recMeta");
const catGrid = document.getElementById("catGrid");
const userHint = document.getElementById("userHint");
const scenarioRow = document.getElementById("scenarioRow");
const scenarioChips = document.getElementById("scenarioChips");
const scenarioChipsInline = document.getElementById("scenarioChipsInline");
const activityList = document.getElementById("activityList");
const activityEmpty = document.getElementById("activityEmpty");
const detailsModal = document.getElementById("detailsModal");
const detailsCloseBtn = document.getElementById("detailsCloseBtn");
const detailsImage = document.getElementById("detailsImage");
const detailsTitle = document.getElementById("detailsTitle");
const detailsMeta = document.getElementById("detailsMeta");
const detailsPrice = document.getElementById("detailsPrice");
const detailsDesc = document.getElementById("detailsDesc");
const detailsTags = document.getElementById("detailsTags");
const cartModal = document.getElementById("cartModal");
const openCartBtn = document.getElementById("openCartBtn");
const cartCloseBtn = document.getElementById("cartCloseBtn");
const cartList = document.getElementById("cartList");
const cartEmpty = document.getElementById("cartEmpty");
const cartCountBadge = document.getElementById("cartCountBadge");
const cartItemsMeta = document.getElementById("cartItemsMeta");
const cartSubtotal = document.getElementById("cartSubtotal");
const cartVat = document.getElementById("cartVat");
const cartTotal = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");
const checkoutBtn = document.getElementById("checkoutBtn");

const IMG_FALLBACK =
  "https://placehold.co/600x400/1f2330/9aa3b5/png?text=Jarir";
let catalogById = new Map();
let detailsProductId = null;

async function fetchJson(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

async function postJson(path, payload) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `POST ${path} ${r.status}`);
  return data;
}

function money(p) {
  return `${p.price.toLocaleString("en-SA")} ${p.currency}`;
}

function moneyValue(v) {
  return `${Math.round(v).toLocaleString("en-SA")} SAR`;
}

function cartStorageKey() {
  return `jarir_cart_${userSelect.value || "guest"}`;
}

function getCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartStorageKey()) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setCart(items) {
  localStorage.setItem(cartStorageKey(), JSON.stringify(items));
}

function addToCart(productId) {
  const pid = String(productId);
  const items = getCart();
  const idx = items.findIndex((x) => String(x.productId) === pid);
  if (idx >= 0) items[idx].qty += 1;
  else items.push({ productId: pid, qty: 1 });
  setCart(items);
  renderCart();
}

function updateCartQty(productId, delta) {
  const pid = String(productId);
  const items = getCart();
  const idx = items.findIndex((x) => String(x.productId) === pid);
  if (idx < 0) return;
  items[idx].qty += delta;
  if (items[idx].qty <= 0) items.splice(idx, 1);
  setCart(items);
  renderCart();
}

function clearCart() {
  setCart([]);
  renderCart();
}

function renderCart() {
  const items = getCart();
  const enriched = items
    .map((i) => ({ ...i, product: catalogById.get(String(i.productId)) }))
    .filter((i) => i.product);

  const count = enriched.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = enriched.reduce((sum, i) => sum + i.qty * i.product.price, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  cartCountBadge.textContent = String(count);
  const navCartBadge = document.getElementById("navCartBadge");
  if (navCartBadge) {
    navCartBadge.textContent = String(count);
    navCartBadge.hidden = count === 0;
  }
  cartItemsMeta.textContent = `${count} item${count === 1 ? "" : "s"}`;
  cartSubtotal.textContent = moneyValue(subtotal);
  cartVat.textContent = moneyValue(vat);
  cartTotal.textContent = moneyValue(total);

  cartList.innerHTML = enriched
    .map(
      (i) => `
      <li class="cart-item">
        <div class="cart-item-main">
          <strong>${escapeHtml(i.product.name)}</strong>
          <span class="meta">${escapeHtml(i.product.brand)} · ${money(i.product)}</span>
        </div>
        <div class="cart-qty">
          <button type="button" class="btn action" data-cart-action="dec" data-product-id="${i.product.id}">-</button>
          <span>${i.qty}</span>
          <button type="button" class="btn action" data-cart-action="inc" data-product-id="${i.product.id}">+</button>
        </div>
      </li>`
    )
    .join("");

  cartEmpty.hidden = enriched.length > 0;
}

function cardHtml(p, { rec = false } = {}) {
  const tags = (p.tags || []).slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join("");
  const score =
    rec && typeof p._score === "number"
      ? `<div class="score">Match score · ${p._score}</div>`
      : "";
  const src = String(p.image || "").replace(/"/g, "");
  return `
    <article class="card ${rec ? "rec" : ""}">
      <img class="card-img" src="${src}" alt="" loading="lazy" width="600" height="400" onerror="this.onerror=null;this.src='${IMG_FALLBACK}';" />
      <div class="card-body">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="meta">${escapeHtml(p.brand)} · ${escapeHtml(p.category)}</div>
        <div class="price">${money(p)}</div>
        ${score}
        <div class="tags">${tags}</div>
        <div class="actions">
          <button type="button" class="btn action" data-action="view" data-product-id="${p.id}">View</button>
          <button type="button" class="btn action primary" data-action="cart" data-product-id="${p.id}">Cart</button>
          <button type="button" class="btn action buy" data-action="purchase" data-product-id="${p.id}">Buy</button>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** First name for greeting from profile displayName (e.g. "Sara (Tech shopper)" → "Sara"). */
function heroGreetingName(displayName) {
  const s = String(displayName || "").trim();
  if (!s) return "there";
  const paren = s.indexOf(" (");
  const base = (paren >= 0 ? s.slice(0, paren) : s).trim();
  const first = base.split(/\s+/)[0];
  return first || "there";
}

function setHeroGreeting(displayName) {
  const el = document.getElementById("heroGreeting");
  if (!el) return;
  el.textContent = `Good morning, ${heroGreetingName(displayName)}`;
}

function setHeroGreetingFromSelectFallback() {
  const opt = userSelect?.options?.[userSelect.selectedIndex];
  const label = opt ? opt.textContent.trim() : "";
  setHeroGreeting(label);
}

let bottomNavActive = "home";

function syncBottomNav() {
  document.querySelectorAll(".stitch-bottom-nav [data-bottom-nav]").forEach((el) => {
    const key = el.getAttribute("data-bottom-nav");
    if (key === "cart") return;
    const active = bottomNavActive === key;
    el.classList.toggle("is-active", active);
    el.setAttribute("aria-current", active ? "page" : "false");
    const icon = el.querySelector(".stitch-bottom-nav__icon");
    if (icon) {
      icon.style.fontVariationSettings = active
        ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
        : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";
    }
  });
}

/**
 * @param {"browse"|"profile"} which
 * @param {"home"|"discover"|undefined} bottomSlot — when browse, which bottom item is highlighted (Stitch Home vs Discover)
 */
function setMainTab(which, bottomSlot) {
  const panelBrowse = document.getElementById("panelBrowse");
  const panelProfile = document.getElementById("panelProfile");
  const isBrowse = which === "browse";

  if (panelBrowse) panelBrowse.hidden = !isBrowse;
  if (panelProfile) panelProfile.hidden = isBrowse;

  if (which === "profile") {
    bottomNavActive = "profile";
  } else if (bottomSlot === "discover") {
    bottomNavActive = "discover";
  } else {
    bottomNavActive = "home";
  }
  syncBottomNav();
}

async function loadUsers() {
  const { users } = await fetchJson("/api/users");
  userSelect.innerHTML = users
    .map((u) => `<option value="${u.id}">${escapeHtml(u.name)}</option>`)
    .join("");
  setHeroGreetingFromSelectFallback();
}

async function loadCatalog() {
  const { products } = await fetchJson("/api/catalog");
  catalogById = new Map(products.map((p) => [String(p.id), p]));
  catGrid.innerHTML = products.map((p) => cardHtml(p)).join("");
}

const DEFAULT_REC_HINT =
  "Ranking uses weighted events (purchase > cart > view), category/brand affinity, popularity, and light co-purchase signals from peers in the same categories.";

async function loadRecommendations(hintOverride) {
  const uid = userSelect.value;
  recGrid.innerHTML = "";
  recEmpty.hidden = true;
  recMeta.textContent = "Loading…";

  const data = await fetchJson(`/api/recommendations?userId=${encodeURIComponent(uid)}&limit=12`);
  const items = data.recommendations || [];

  if (!items.length) {
    recEmpty.hidden = false;
    recMeta.textContent = "0 items";
    userHint.textContent = "This profile has no remaining picks (try another user).";
    return;
  }

  recGrid.innerHTML = items.map((p) => cardHtml(p, { rec: true })).join("");
  recMeta.textContent = `${items.length} personalized`;
  if (hintOverride) {
    userHint.textContent = hintOverride;
  } else if (data.lastPurchaseCategory) {
    userHint.textContent = `Latest purchase signals ${data.lastPurchaseCategory}. That shelf is boosted and purchased items stay off this list. ${DEFAULT_REC_HINT}`;
  } else {
    userHint.textContent = DEFAULT_REC_HINT;
  }
}

async function loadScenarios() {
  try {
    const { scenarios } = await fetchJson("/api/scenarios");
    if (!scenarios || !scenarios.length) {
      scenarioRow.hidden = true;
      return;
    }
    scenarioRow.hidden = false;
    const chipsHtml = scenarios
      .map(
        (s) =>
          `<button type="button" class="chip" data-scenario-id="${escapeHtml(s.id)}" data-scenario-label="${escapeHtml(s.label)}" title="${escapeHtml(s.description || "")}">${escapeHtml(s.label)}</button>`
      )
      .join("");
    scenarioChips.innerHTML = chipsHtml;
    if (scenarioChipsInline) scenarioChipsInline.innerHTML = chipsHtml;
  } catch {
    scenarioRow.hidden = true;
    if (scenarioChipsInline) scenarioChipsInline.innerHTML = "";
  }
}

async function loadRecentActivity() {
  const uid = userSelect.value;
  activityList.innerHTML = "";
  activityEmpty.hidden = true;
  try {
    const data = await fetchJson(`/api/interactions?userId=${encodeURIComponent(uid)}&limit=15`);
    const list = data.interactions || [];
    if (!list.length) {
      activityEmpty.hidden = false;
      return;
    }
    activityList.innerHTML = list
      .map(
        (e) => `
      <li>
        <span class="ev-type">${escapeHtml(e.type)}</span>
        <span class="ev-name">${escapeHtml(e.productName || e.productId)}</span>
        <span class="ev-ts">${escapeHtml(e.ts || "")}</span>
      </li>`
      )
      .join("");
  } catch {
    activityEmpty.hidden = false;
  }
}

function profileRadarPolygonPoints(scores) {
  const c = 50;
  const arms = [
    [0, -38],
    [38, 0],
    [0, 38],
    [-38, 0],
  ];
  const s = Array.isArray(scores) ? scores : [];
  return arms
    .map((arm, i) => {
      const t = Math.max(0, Math.min(100, Number(s[i]) || 0)) / 100;
      const x = c + arm[0] * t;
      const y = c + arm[1] * t;
      return `${x},${y}`;
    })
    .join(" ");
}

function brandInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const one = parts[0] || "?";
  return one.slice(0, 2).toUpperCase();
}

async function loadProfile() {
  const uid = userSelect.value;
  const summaryEl = document.getElementById("profileSummary");
  const poly = document.getElementById("profileRadarPoly");
  if (!summaryEl || !poly) return;

  try {
    const data = await fetchJson(`/api/profile?userId=${encodeURIComponent(uid)}`);
    const p = data.profile;
    if (!p) return;

    setHeroGreeting(p.displayName);

    const lead = document.getElementById("profilePersonaLead");
    const accent = document.getElementById("profilePersonaAccentWord");
    if (lead) lead.textContent = p.personaLead || "—";
    if (accent) accent.textContent = p.personaAccent || "";

    summaryEl.textContent = p.summary || "";

    const stats = p.stats || {};
    const statsEl = document.getElementById("profileStats");
    if (statsEl) {
      const pills = [
        ["Views", stats.views],
        ["Cart adds", stats.carts],
        ["Purchases", stats.purchases],
        ["Products touched", stats.uniqueProducts],
        ["Events", stats.totalEvents],
      ]
        .filter(([, v]) => v != null)
        .map(
          ([label, v]) =>
            `<span class="profile-stat-pill">${escapeHtml(label)} · ${escapeHtml(String(v))}</span>`
        );
      statsEl.innerHTML = pills.join("");
    }

    const axes = p.tasteAxes || [];
    for (let i = 0; i < 4; i += 1) {
      const ax = document.getElementById(`profileAxis${i}`);
      if (ax) ax.textContent = axes[i] != null ? String(axes[i]) : "";
    }

    poly.setAttribute("points", profileRadarPolygonPoints(p.tasteScores));

    const tasteSyn = document.getElementById("profileTasteSynthesis");
    if (tasteSyn) tasteSyn.textContent = p.tasteSynthesis || "—";

    const insight = document.getElementById("profileInsight");
    if (insight) insight.textContent = p.insight || "—";

    const confPct = document.getElementById("profileConfidencePct");
    if (confPct && typeof p.aiConfidence === "number") {
      confPct.textContent = `${p.aiConfidence}%`;
    }

    const brandsRow = document.getElementById("profileBrandsRow");
    if (brandsRow) {
      const brands = p.topBrands || [];
      if (!brands.length) {
        brandsRow.innerHTML =
          '<p class="profile-summary" style="margin:0;grid-column:1/-1">No brand affinity yet — interact with products to populate this row.</p>';
      } else {
        brandsRow.innerHTML = brands
          .map(
            (b) => `
          <div class="profile-brand">
            <div class="profile-brand-orb" aria-hidden="true">${escapeHtml(brandInitials(b.name))}</div>
            <p class="profile-brand-name">${escapeHtml(b.name)}</p>
            <p class="profile-brand-meta">Affinity · ${escapeHtml(String(b.weight))}</p>
          </div>`
          )
          .join("");
      }
    }

    const chipsEl = document.getElementById("profileInterestChips");
    if (chipsEl) {
      const tags = p.interestTags || [];
      if (!tags.length) {
        chipsEl.innerHTML =
          '<span class="profile-interest-chip">No tags yet — views and carts surface inferred interests.</span>';
      } else {
        chipsEl.innerHTML = tags
          .map(
            (t) =>
              `<span class="profile-interest-chip">${escapeHtml(t.tag)} <strong>${escapeHtml(String(t.weight))}</strong></span>`
          )
          .join("");
      }
    }
  } catch (e) {
    summaryEl.textContent = `Could not load profile: ${e.message}`;
    setHeroGreetingFromSelectFallback();
  }
}

function attachActionHandlers() {
  const saveInteraction = async (action, productId, userId) => {
    await postJson("/api/interactions", { userId, productId, type: action });
    let purchaseHint = null;
    if (action === "purchase") {
      const p = catalogById.get(String(productId));
      if (p) {
        purchaseHint = `Purchase recorded. “${p.name}” is removed from recommendations. More picks from ${p.category} are promoted based on your buy signal.`;
      }
    }
    await loadRecommendations(purchaseHint);
    await loadRecentActivity();
    await loadProfile();
    if (action === "purchase") {
      if (!purchaseHint) {
        userHint.textContent = `Purchase saved for ${userId}. Recommendations refreshed.`;
      }
    } else {
      userHint.textContent = `Saved ${action} event for ${userId}. Recommendations refreshed.`;
    }
    if (action === "cart") addToCart(productId);
  };

  const openProductDetails = (productId) => {
    const product = catalogById.get(String(productId));
    if (!product) return;
    detailsProductId = String(product.id);
    detailsTitle.textContent = product.name;
    detailsMeta.textContent = `${product.brand} · ${product.category}`;
    detailsPrice.textContent = money(product);
    detailsDesc.textContent = `Selected for demo: ${product.name} is a strong fit for ${product.category.toLowerCase()} shoppers and complements related items in this segment.`;
    detailsImage.src = product.image || IMG_FALLBACK;
    detailsImage.onerror = () => {
      detailsImage.onerror = null;
      detailsImage.src = IMG_FALLBACK;
    };
    detailsTags.innerHTML = (product.tags || [])
      .slice(0, 6)
      .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
      .join("");
    detailsModal.hidden = false;
  };

  const closeProductDetails = () => {
    detailsModal.hidden = true;
    detailsProductId = null;
  };

  const onClick = async (event) => {
    const btn = event.target.closest("button[data-action][data-product-id]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const productId = btn.getAttribute("data-product-id");
    const userId = userSelect.value;
    if (!action || !productId || !userId) return;

    if (action === "view") {
      openProductDetails(productId);
      return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      await saveInteraction(action, productId, userId);
      btn.textContent = "Saved";
      window.setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 500);
    } catch (e) {
      userHint.textContent = `Could not save interaction: ${e.message}`;
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };

  recGrid.addEventListener("click", onClick);
  catGrid.addEventListener("click", onClick);
  detailsCloseBtn.addEventListener("click", closeProductDetails);
  detailsModal.addEventListener("click", async (event) => {
    if (event.target === detailsModal) {
      closeProductDetails();
      return;
    }
    const btn = event.target.closest("button[data-details-action]");
    if (!btn || !detailsProductId) return;
    const action = btn.getAttribute("data-details-action");
    const userId = userSelect.value;
    if (!action || !userId) return;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      await saveInteraction(action, detailsProductId, userId);
      btn.textContent = "Saved";
      window.setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 500);
    } catch (e) {
      userHint.textContent = `Could not save interaction: ${e.message}`;
      btn.textContent = originalText;
      btn.disabled = false;
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailsModal.hidden) closeProductDetails();
    if (event.key === "Escape" && !cartModal.hidden) cartModal.hidden = true;
  });

  openCartBtn.addEventListener("click", () => {
    renderCart();
    cartModal.hidden = false;
  });
  cartCloseBtn.addEventListener("click", () => {
    cartModal.hidden = true;
  });
  cartModal.addEventListener("click", (event) => {
    if (event.target === cartModal) cartModal.hidden = true;
  });
  cartList.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-cart-action][data-product-id]");
    if (!btn) return;
    const action = btn.getAttribute("data-cart-action");
    const pid = btn.getAttribute("data-product-id");
    if (!action || !pid) return;
    updateCartQty(pid, action === "inc" ? 1 : -1);
  });
  clearCartBtn.addEventListener("click", () => {
    clearCart();
    userHint.textContent = "Cart cleared.";
  });
  checkoutBtn.addEventListener("click", async () => {
    const items = getCart();
    if (!items.length) {
      userHint.textContent = "Cart is empty.";
      return;
    }
    const userId = userSelect.value;
    for (const item of items) {
      for (let i = 0; i < item.qty; i += 1) {
        await postJson("/api/interactions", { userId, productId: item.productId, type: "purchase" });
      }
    }
    clearCart();
    await loadRecommendations(
      "Checkout complete. Purchased items are removed from this list; recommendations now lean into the categories you just bought."
    );
    await loadRecentActivity();
    await loadProfile();
    cartModal.hidden = true;
  });
}

async function init() {
  await loadUsers();
  await loadScenarios();
  await loadCatalog();
  await loadRecommendations();
  await loadRecentActivity();
  await loadProfile();
  renderCart();
  attachActionHandlers();

  const personalLibrary = document.getElementById("personalLibrary");
  const recommendationsSection = document.getElementById("recommendationsSection");
  if (personalLibrary && recommendationsSection) {
    personalLibrary.addEventListener("click", (e) => {
      const tile = e.target.closest("[data-library-focus]");
      if (!tile) return;
      setMainTab("browse", "home");
      recommendationsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      userHint.textContent = "Here are your personalized picks for this shopper profile.";
    });
  }

  const bottomNav = document.querySelector(".stitch-bottom-nav");
  const discoverySection = document.getElementById("discoverySection");
  const heroSection = document.querySelector(".hero");
  if (bottomNav) {
    bottomNav.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-bottom-nav]");
      if (!btn) return;
      const key = btn.getAttribute("data-bottom-nav");
      if (key === "home") {
        setMainTab("browse", "home");
        (heroSection || document.documentElement).scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (key === "discover") {
        setMainTab("browse", "discover");
        (discoverySection || heroSection)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (key === "profile") {
        setMainTab("profile");
        await loadProfile();
        document.getElementById("profileSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (key === "cart") {
        renderCart();
        cartModal.hidden = false;
      }
    });
    bottomNav.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const items = [...bottomNav.querySelectorAll("[data-bottom-nav]")];
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = e.key === "ArrowRight" ? items[(i + 1) % items.length] : items[(i - 1 + items.length) % items.length];
      next?.focus();
    });
  }
  syncBottomNav();

  scenarioChips.addEventListener("click", async (e) => {
    const chip = e.target.closest("button[data-scenario-id]");
    if (!chip) return;
    const scenarioId = chip.getAttribute("data-scenario-id");
    const userId = userSelect.value;
    if (!scenarioId || !userId) return;
    chip.disabled = true;
    try {
      const res = await postJson("/api/scenarios/apply", { userId, scenarioId });
      const label = chip.getAttribute("data-scenario-label") || scenarioId;
      userHint.textContent = `Applied “${label}”: +${res.added} events. Recommendations updated.`;
      await loadRecommendations();
      await loadRecentActivity();
      await loadProfile();
    } catch (err) {
      userHint.textContent = String(err.message);
    } finally {
      chip.disabled = false;
    }
  });
  if (scenarioChipsInline) {
    scenarioChipsInline.addEventListener("click", async (e) => {
      const chip = e.target.closest("button[data-scenario-id]");
      if (!chip) return;
      const scenarioId = chip.getAttribute("data-scenario-id");
      const userId = userSelect.value;
      if (!scenarioId || !userId) return;
      chip.disabled = true;
      try {
        const res = await postJson("/api/scenarios/apply", { userId, scenarioId });
        const label = chip.getAttribute("data-scenario-label") || scenarioId;
        userHint.textContent = `Applied “${label}”: +${res.added} events. Recommendations updated.`;
        await loadRecommendations();
        await loadRecentActivity();
        await loadProfile();
      } catch (err) {
        userHint.textContent = String(err.message);
      } finally {
        chip.disabled = false;
      }
    });
  }

  userSelect.addEventListener("change", async () => {
    await loadRecommendations();
    await loadRecentActivity();
    await loadProfile();
    renderCart();
  });
  refreshBtn.addEventListener("click", async () => {
    await loadRecommendations();
    await loadRecentActivity();
    await loadProfile();
  });
}

init().catch((e) => {
  recMeta.textContent = "Error";
  userHint.textContent = String(e.message);
});
