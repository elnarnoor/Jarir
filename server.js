const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function readJsonSafe(file) {
  const p = path.join(DATA_DIR, file);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJsonSafe(file, data) {
  const p = path.join(DATA_DIR, file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

let cache = { products: null, users: null, interactions: null, at: 0 };
const CACHE_MS = 5000;

function loadData() {
  const now = Date.now();
  if (cache.products && now - cache.at < CACHE_MS) {
    return { products: cache.products, users: cache.users, interactions: cache.interactions };
  }
  cache.products = readJsonSafe("products.json");
  cache.users = readJsonSafe("users.json");
  cache.interactions = readJsonSafe("interactions.json");
  cache.at = now;
  return { products: cache.products, users: cache.users, interactions: cache.interactions };
}

function invalidateCache() {
  cache.at = 0;
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * Simple content + collaborative-style scoring for pilot demo:
 * - Boost categories/brands the user engaged with (views, cart, purchases)
 * - Light "similar users" signal from co-occurrence in category purchases
 * - Diversity: slight penalty for over-represented category in results
 */
function recommendForUser(userId, limit = 12) {
  const { products, interactions } = loadData();
  const uid = String(userId);
  const userEvents = interactions.filter((e) => String(e.userId) === uid);

  const categoryWeight = {};
  const brandWeight = {};
  const seenProductIds = new Set();
  const typeWeight = { purchase: 3, cart: 2, view: 1 };

  let lastPurchaseCategory = null;
  for (let i = interactions.length - 1; i >= 0; i--) {
    const e = interactions[i];
    if (String(e.userId) !== uid || e.type !== "purchase") continue;
    const lp = products.find((x) => String(x.id) === String(e.productId));
    if (lp) {
      lastPurchaseCategory = lp.category;
      break;
    }
  }

  for (const ev of userEvents) {
    const w = typeWeight[ev.type] || 1;
    const p = products.find((x) => String(x.id) === String(ev.productId));
    if (!p) continue;
    seenProductIds.add(String(p.id));
    categoryWeight[p.category] = (categoryWeight[p.category] || 0) + w;
    brandWeight[p.brand] = (brandWeight[p.brand] || 0) + w * 0.7;
  }

  // Co-purchase / co-view in same category (pseudo collaborative)
  const catUsers = {};
  for (const ev of interactions) {
    if (ev.type !== "purchase" && ev.type !== "cart") continue;
    const p = products.find((x) => String(x.id) === String(ev.productId));
    if (!p) continue;
    if (!catUsers[p.category]) catUsers[p.category] = new Set();
    catUsers[p.category].add(String(ev.userId));
  }

  const myCats = new Set(Object.keys(categoryWeight));
  const neighborBoost = {};
  for (const cat of myCats) {
    const usersInCat = catUsers[cat];
    if (!usersInCat) continue;
    for (const ev of interactions) {
      if (!usersInCat.has(String(ev.userId)) || String(ev.userId) === uid) continue;
      if (ev.type !== "purchase") continue;
      neighborBoost[String(ev.productId)] = (neighborBoost[String(ev.productId)] || 0) + 0.35;
    }
  }

  const maxPerCategoryDefault = 4;
  const maxPerCategoryPurchaseFocus = 10;

  const catCountInResults = {};
  const scored = products
    .filter((p) => !seenProductIds.has(String(p.id)))
    .map((p) => {
      let score = 0;
      score += (categoryWeight[p.category] || 0) * 2.2;
      score += brandWeight[p.brand] || 0;
      score += (p.popularityScore || 0) * 0.08;
      score += neighborBoost[String(p.id)] || 0;
      if (lastPurchaseCategory && p.category === lastPurchaseCategory) {
        score += 6;
      }
      // Prefer items with tags overlapping user's implied interests
      const tags = p.tags || [];
      for (const t of tags) {
        for (const c of Object.keys(categoryWeight)) {
          if (t.toLowerCase().includes(c.slice(0, 4).toLowerCase())) score += 0.4;
        }
      }
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score);

  const out = [];
  for (const row of scored) {
    const cat = row.product.category;
    const n = catCountInResults[cat] || 0;
    const cap = lastPurchaseCategory && cat === lastPurchaseCategory ? maxPerCategoryPurchaseFocus : maxPerCategoryDefault;
    if (n >= cap && out.length < limit) continue;
    catCountInResults[cat] = n + 1;
    out.push({ ...row.product, _score: Math.round(row.score * 100) / 100 });
    if (out.length >= limit) break;
  }

  return { recommendations: out, lastPurchaseCategory: lastPurchaseCategory || null };
}

const SEGMENT_PERSONA = {
  electronics_enthusiast: { lead: "The Connected", accent: "Curator" },
  office_student: { lead: "The Focused", accent: "Scholar" },
  omnichannel: { lead: "The Renaissance", accent: "Reader" },
  gaming: { lead: "The Strategic", accent: "Player" },
  streaming: { lead: "The Expressive", accent: "Creator" },
  education: { lead: "The Emerging", accent: "Learner" },
};

function buildUserProfile(userId) {
  const { users, products, interactions } = loadData();
  const uid = String(userId);
  const user = users.find((u) => String(u.id) === uid);
  if (!user) return null;

  const userEvents = interactions.filter((e) => String(e.userId) === uid);
  const typeWeight = { purchase: 3, cart: 2, view: 1 };

  const categoryWeight = {};
  const brandWeight = {};
  const tagCounts = {};
  let views = 0;
  let carts = 0;
  let purchases = 0;
  const uniqueProducts = new Set();

  for (const ev of userEvents) {
    if (ev.type === "view") views += 1;
    if (ev.type === "cart") carts += 1;
    if (ev.type === "purchase") purchases += 1;
    const p = products.find((x) => String(x.id) === String(ev.productId));
    if (!p) continue;
    uniqueProducts.add(String(p.id));
    const w = typeWeight[ev.type] || 1;
    categoryWeight[p.category] = (categoryWeight[p.category] || 0) + w;
    brandWeight[p.brand] = (brandWeight[p.brand] || 0) + w;
    for (const t of p.tags || []) {
      tagCounts[t] = (tagCounts[t] || 0) + w;
    }
  }

  const categoriesSorted = Object.entries(categoryWeight).sort((a, b) => b[1] - a[1]);
  const persona = SEGMENT_PERSONA[user.segment] || { lead: "The Curious", accent: "Explorer" };

  const padAxes = ["Books", "Tech", "Lifestyle", "Creative"];
  const topPairs = categoriesSorted.slice(0, 4);
  const axisEntries = [];
  for (let i = 0; i < 4; i += 1) {
    if (topPairs[i]) axisEntries.push(topPairs[i]);
    else axisEntries.push([padAxes[i] || `Area ${i + 1}`, 0.15]);
  }

  const maxW = Math.max(...axisEntries.map(([, w]) => w), 1);
  const tasteAxes = axisEntries.map(([name]) => name);
  const tasteScores = axisEntries.map(([, w]) => Math.min(100, Math.round((w / maxW) * 100)));

  const topBrands = Object.entries(brandWeight)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, w]) => ({ name, weight: Math.round(w * 10) / 10 }));

  const interestTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, w]) => ({ tag, weight: Math.round(w * 10) / 10 }));

  const dom = categoriesSorted[0];
  const sec = categoriesSorted[1];
  let summary =
    userEvents.length === 0
      ? "No behavior captured yet — run a discovery path or interact with products to shape this profile."
      : `From ${userEvents.length} events across ${uniqueProducts.size} products, your clearest pull is toward ${dom ? dom[0] : "general discovery"}${sec ? `, with a secondary lean into ${sec[0]}` : ""}.`;

  let insight =
    "Add views, cart adds, or purchases so we can describe how you balance practical buys with exploratory browsing.";
  if (dom) {
    if (purchases >= 3) {
      insight = `Purchase intent is strong in ${dom[0]} — we weight that shelf heavily when ranking what to show next.`;
    } else if (carts >= 2) {
      insight = `You hesitate before checkout in ${dom[0]}; we surface adjacent categories that often convert after cart adds.`;
    } else {
      insight = `You browse broadly but linger on ${dom[0]} — narrative and assortment depth there will feel most “you.”`;
    }
  }

  const aiConfidence = Math.min(96, 52 + Math.min(44, userEvents.length * 2 + uniqueProducts.size));

  const tasteSynthesis =
    dom && sec
      ? `${dom[0]} leads your mix; ${sec[0]} provides balance in the pilot model.`
      : "Keep exploring — your taste map sharpens with each interaction.";

  return {
    userId: uid,
    displayName: user.name,
    segment: user.segment,
    personaLead: persona.lead,
    personaAccent: persona.accent,
    summary,
    tasteAxes,
    tasteScores,
    tasteSynthesis,
    topBrands,
    interestTags,
    insight,
    aiConfidence,
    stats: {
      views,
      carts,
      purchases,
      uniqueProducts: uniqueProducts.size,
      totalEvents: userEvents.length,
    },
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/catalog") {
    try {
      const { products } = loadData();
      sendJson(res, 200, { products });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/users") {
    try {
      const { users } = loadData();
      sendJson(res, 200, { users });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/profile" && method === "GET") {
    const userId = parsed.query.userId;
    if (!userId) {
      sendJson(res, 400, { error: "userId required" });
      return;
    }
    try {
      const profile = buildUserProfile(userId);
      if (!profile) {
        sendJson(res, 404, { error: "Unknown userId." });
        return;
      }
      sendJson(res, 200, { profile });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/scenarios" && method === "GET") {
    try {
      const scenarios = readJsonSafe("scenarios.json");
      sendJson(res, 200, { scenarios });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/scenarios/apply" && method === "POST") {
    collectRequestBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const userId = String(payload.userId || "").trim();
        const scenarioId = String(payload.scenarioId || "").trim();
        if (!userId || !scenarioId) {
          sendJson(res, 400, { error: "Required: userId, scenarioId." });
          return;
        }
        const scenarios = readJsonSafe("scenarios.json");
        const scenario = scenarios.find((s) => s.id === scenarioId);
        if (!scenario || !Array.isArray(scenario.events)) {
          sendJson(res, 404, { error: "Unknown scenarioId." });
          return;
        }
        const { users, products, interactions } = loadData();
        if (!users.some((u) => String(u.id) === userId)) {
          sendJson(res, 404, { error: "Unknown userId." });
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const allowedTypes = new Set(["view", "cart", "purchase"]);
        const appended = [];
        for (const ev of scenario.events) {
          const productId = String(ev.productId || "").trim();
          const type = String(ev.type || "").trim();
          if (!allowedTypes.has(type) || !products.some((p) => String(p.id) === productId)) {
            sendJson(res, 400, { error: `Invalid scenario event: ${JSON.stringify(ev)}` });
            return;
          }
          appended.push({ userId, productId, type, ts: today });
        }
        const updated = [...interactions, ...appended];
        writeJsonSafe("interactions.json", updated);
        invalidateCache();
        sendJson(res, 201, {
          ok: true,
          scenarioId,
          userId,
          added: appended.length,
          interactions: appended,
          totalInteractions: updated.length,
        });
      })
      .catch((e) => {
        sendJson(res, 400, { error: `Invalid JSON payload: ${e.message}` });
      });
    return;
  }

  if (pathname === "/api/interactions" && method === "GET") {
    const userId = parsed.query.userId;
    const limit = Math.min(50, Math.max(1, parseInt(String(parsed.query.limit || "12"), 10) || 12));
    if (!userId) {
      sendJson(res, 400, { error: "userId required" });
      return;
    }
    try {
      const { interactions, products } = loadData();
      const uid = String(userId);
      const mine = interactions.filter((e) => String(e.userId) === uid);
      const tail = mine.slice(-limit).reverse();
      const withNames = tail.map((e) => {
        const p = products.find((x) => String(x.id) === String(e.productId));
        return {
          ...e,
          productName: p ? p.name : e.productId,
        };
      });
      sendJson(res, 200, { userId: uid, count: withNames.length, interactions: withNames });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/recommendations") {
    const userId = parsed.query.userId;
    const limit = Math.min(24, Math.max(1, parseInt(String(parsed.query.limit || "12"), 10) || 12));
    if (!userId) {
      sendJson(res, 400, { error: "userId required" });
      return;
    }
    try {
      const { recommendations, lastPurchaseCategory } = recommendForUser(userId, limit);
      sendJson(res, 200, {
        userId: String(userId),
        count: recommendations.length,
        recommendations,
        lastPurchaseCategory,
      });
    } catch (e) {
      sendJson(res, 500, { error: String(e.message) });
    }
    return;
  }

  if (pathname === "/api/interactions" && method === "POST") {
    collectRequestBody(req)
      .then((rawBody) => {
        const payload = rawBody ? JSON.parse(rawBody) : {};
        const userId = String(payload.userId || "").trim();
        const productId = String(payload.productId || "").trim();
        const type = String(payload.type || "").trim();
        const allowedTypes = new Set(["view", "cart", "purchase"]);

        if (!userId || !productId || !allowedTypes.has(type)) {
          sendJson(res, 400, {
            error: "Invalid payload. Required: userId, productId, type(view|cart|purchase).",
          });
          return;
        }

        const { users, products, interactions } = loadData();
        const userExists = users.some((u) => String(u.id) === userId);
        const productExists = products.some((p) => String(p.id) === productId);
        if (!userExists || !productExists) {
          sendJson(res, 404, { error: "Unknown userId or productId." });
          return;
        }

        const newEvent = {
          userId,
          productId,
          type,
          ts: new Date().toISOString().slice(0, 10),
        };
        const updated = [...interactions, newEvent];
        writeJsonSafe("interactions.json", updated);
        invalidateCache();
        sendJson(res, 201, { ok: true, interaction: newEvent, totalInteractions: updated.length });
      })
      .catch((e) => {
        sendJson(res, 400, { error: `Invalid JSON payload: ${e.message}` });
      });
    return;
  }

  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      if (pathname.indexOf(".") === -1) {
        sendFile(res, path.join(PUBLIC_DIR, "index.html"));
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
      return;
    }
    sendFile(res, filePath);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Jarir recommendation pilot: http://0.0.0.0:${PORT}`);
});
