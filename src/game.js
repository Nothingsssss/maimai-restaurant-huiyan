(function () {
  'use strict';

  // ===== 游戏数据 =====
  const INGREDIENTS = [
    { id: 'bun', name: '面包', emoji: '🍞' },
    { id: 'beef', name: '牛肉饼', emoji: '🥩' },
    { id: 'cheese', name: '芝士', emoji: '🧀' },
    { id: 'friedChicken', name: '炸鸡腿', emoji: '🍗' },
    { id: 'grilledChicken', name: '板烧鸡腿', emoji: '🍖' },
    { id: 'lettuce', name: '生菜', emoji: '🥬' }
  ];

  const DIRECT_ITEMS = ['fries', 'nuggets', 'cola'];

  const DISHES = {
    cheeseburger: {
      id: 'cheeseburger',
      name: '吉士汉堡包',
      emoji: '🍔',
      price: 16,
      recipe: { bun: 1, beef: 1, cheese: 1 }
    },
    doubleCheeseburger: {
      id: 'doubleCheeseburger',
      name: '双层吉士汉堡',
      emoji: '🍔',
      price: 23,
      recipe: { bun: 1, beef: 2, cheese: 1 }
    },
    mcChicken: {
      id: 'mcChicken',
      name: '麦辣鸡腿汉堡',
      emoji: '🍔',
      price: 22,
      recipe: { bun: 1, friedChicken: 1 }
    },
    bigMac: {
      id: 'bigMac',
      name: '巨无霸',
      emoji: '🍔',
      price: 28,
      recipe: { bun: 1, beef: 2, cheese: 1, lettuce: 1 }
    },
    grilledChickenBurger: {
      id: 'grilledChickenBurger',
      name: '板烧鸡腿堡',
      emoji: '🍔',
      price: 24,
      recipe: { bun: 1, grilledChicken: 1, lettuce: 1 }
    },
    fries: {
      id: 'fries',
      name: '中薯条',
      emoji: '🍟',
      price: 12,
      direct: true
    },
    nuggets: {
      id: 'nuggets',
      name: '麦乐鸡5块',
      emoji: '🍗',
      price: 13,
      direct: true
    },
    cola: {
      id: 'cola',
      name: '可乐中杯',
      emoji: '🥤',
      price: 9,
      direct: true
    }
  };

  const DISH_IDS = Object.keys(DISHES);
  const BURGER_IDS = DISH_IDS.filter(id => !DISHES[id].direct);
  const DIRECT_IDS = DISH_IDS.filter(id => DISHES[id].direct);

  const CUSTOMER_TAGS = {
    saver: { name: '省钱小能手', basePatience: 110, couponRate: 0.96, emoji: '🧮' },
    chill: { name: '佛系干饭人', basePatience: 180, couponRate: 0.08, emoji: '😌' },
    rush: { name: '打工赶时间', basePatience: 75, couponRate: 0.35, emoji: '⏱️' },
    blogger: { name: '探店博主', basePatience: 120, couponRate: 0.78, emoji: '📸' },
    checker: { name: '认真核对客', basePatience: 90, couponRate: 0.65, emoji: '🧐' },
    regular: { name: '麦麦熟客', basePatience: 140, couponRate: 0.55, emoji: '⭐' }
  };

  const TAG_KEYS = Object.keys(CUSTOMER_TAGS);

  const REPUTATION_LEVELS = {
    1: { tip: 1, comp: 10 },
    2: { tip: 2, comp: 5 },
    3: { tip: 3, comp: 4.6 },
    4: { tip: 4, comp: 4.2 },
    5: { tip: 5, comp: 3.8 },
    6: { tip: 6, comp: 3.4 },
    7: { tip: 7, comp: 3 }
  };

  const SCALE_THRESHOLDS = [0, 80, 200, 400, 700];

  const GAME_CONFIG = {
    totalTime: 180,
    maxCustomers: 4,
    maxTrayItems: 12,
    maxIngredients: 6,
    couponChance: 0.80,
    singleCouponSave: 4,
    comboCouponSave: 6,
    spawnIntervalBase: 6,
    seed: null
  };

  // ===== 工具函数 =====
  function formatMoney(cents) {
    return '¥' + (cents / 100).toFixed(2);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function countRecipeMaterials(recipe) {
    return Object.values(recipe).reduce((a, b) => a + b, 0);
  }

  // ===== 简单 PRNG =====
  let rng = Math.random;

  function pickRandom(arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  // ===== 订单生成 =====
  function buildOrder(scaleLevel) {
    const hasCoupon = rng() < GAME_CONFIG.couponChance;
    const typeRoll = rng();
    let items = [];

    if (typeRoll < 0.20) {
      // 20% 单点
      const dish = pickRandom(DISH_IDS);
      items.push({ dish, qty: 1 });
    } else if (typeRoll < 0.65) {
      // 45% 汉堡 + 小食 + 可乐，可能升级为 2 份小食或 2 份饮料
      const burger = pickRandom(BURGER_IDS);
      items.push({ dish: burger, qty: 1 });
      const snackQty = rng() < 0.25 ? 2 : 1;
      const drinkQty = rng() < 0.15 ? 2 : 1;
      items.push({ dish: pickRandom(['fries', 'nuggets']), qty: snackQty });
      items.push({ dish: 'cola', qty: drinkQty });
    } else if (typeRoll < 0.85) {
      // 20% 两个同款汉堡 + 可乐（可能 2 杯）
      const burger = pickRandom(BURGER_IDS);
      items.push({ dish: burger, qty: 2 });
      items.push({ dish: 'cola', qty: rng() < 0.3 ? 2 : 1 });
    } else {
      // 15% 两个同款汉堡 + 薯条（可能 2 份）+ 可乐；Lv.3 后加鸡块
      const burger = pickRandom(BURGER_IDS);
      items.push({ dish: burger, qty: 2 });
      items.push({ dish: 'fries', qty: rng() < 0.25 ? 2 : 1 });
      items.push({ dish: 'cola', qty: rng() < 0.15 ? 2 : 1 });
      if (scaleLevel >= 3) {
        items.push({ dish: 'nuggets', qty: rng() < 0.2 ? 2 : 1 });
      }
    }

    const originalPrice = items.reduce((sum, it) => sum + DISHES[it.dish].price * it.qty, 0);
    const isCombo = items.length > 1 || items.some(it => it.qty > 1);
    const couponD = hasCoupon ? Math.min(isCombo ? GAME_CONFIG.comboCouponSave : GAME_CONFIG.singleCouponSave, originalPrice) : 0;

    return {
      items,
      hasCoupon,
      couponD,
      originalPrice
    };
  }

  function findNutrition(name, cache) {
    if (!cache || !Array.isArray(cache.items)) return null;
    const n = name.toLowerCase().replace(/[堡包]/g, '').trim();
    for (const item of cache.items) {
      if (!item.name) continue;
      const candidate = item.name.toLowerCase().replace(/[堡包]/g, '').trim();
      if (candidate === n || candidate.includes(n) || n.includes(candidate)) {
        return item;
      }
    }
    return null;
  }

  function renderNutritionItem(item) {
    if (!item) return '<span style="color:#999">未匹配</span>';
    const parts = [];
    if (item.energyKcal != null) parts.push(`能量 ${item.energyKcal} kcal`);
    if (item.proteinG != null) parts.push(`蛋白质 ${item.proteinG} g`);
    if (item.fatG != null) parts.push(`脂肪 ${item.fatG} g`);
    if (item.carbsG != null) parts.push(`碳水 ${item.carbsG} g`);
    if (item.sodiumMg != null) parts.push(`钠 ${item.sodiumMg} mg`);
    if (item.perServing) parts.push(`每份 ${item.perServing}`);
    else if (item.per100g) parts.push(`每100g ${item.per100g}`);
    return parts.length ? parts.join(' · ') : '<span style="color:#999">暂无公开营养字段</span>';
  }

  // ===== 游戏状态 =====
  class Game {
    constructor() {
      this.reset();
    }

    reset() {
      this.money = 0;
      this.totalEarnings = 0;
      this.reputationLevel = 2;
      this.restaurantLevel = 1;
      this.completedOrders = 0;
      this.goodReviews = 0;
      this.normalReviews = 0;
      this.badReviews = 0;
      this.rejectedCount = 0;
      this.couponComplaints = 0;
      this.foodComplaints = 0;
      this.gameTime = 0;
      this.isOpen = false;
      this.paused = false;
      this.customers = [];
      this.making = [];
      this.tray = { burgers: [], snacks: {} };
      this.logs = [];
      this.nextCustomerId = 1;
      this.spawnTimer = 0;
      this.lastTick = 0;
      this.currentCustomerId = null;
      this.bestScore = this.loadBestScore();
      this.mcdCache = null;
      this.practiceMode = false;
    }

    loadBestScore() {
      try {
        const v = localStorage.getItem('maimai_best_score');
        return v ? parseInt(v, 10) : 0;
      } catch (e) {
        return 0;
      }
    }

    saveBestScore() {
      try {
        if (this.money > this.bestScore) {
          localStorage.setItem('maimai_best_score', String(this.money));
          this.bestScore = this.money;
        }
      } catch (e) {}
    }

    log(msg, type = 'info') {
      const timeStr = this.practiceMode ? '练习' : `${Math.floor(this.gameTime / 60)}:${String(Math.floor(this.gameTime % 60)).padStart(2, '0')}`;
      this.logs.unshift(`[${timeStr}] ${msg}`);
      if (this.logs.length > 50) this.logs.pop();
    }

    start(options = {}) {
      this.reset();
      this.practiceMode = !!options.practice;
      const seed = options.seed ?? GAME_CONFIG.seed ?? Date.now();
      rng = seededRandom(hashString(String(seed)));
      this.isOpen = true;
      this.paused = false;
      this.lastTick = performance.now();

      // 初始两位顾客：第一位巨无霸，第二位板烧鸡腿堡
      this.spawnCustomer(false, 'bigMac');
      this.spawnCustomer(false, 'grilledChickenBurger');

      requestAnimationFrame((t) => this.tick(t));
      this.log(this.practiceMode ? '自由练习开始，不计时不催单' : '营业开始！观察订单并推荐优惠吧~');
    }

    tick(now) {
      if (!this.isOpen) return;
      if (this.paused) {
        this.lastTick = now;
        requestAnimationFrame((t) => this.tick(t));
        return;
      }
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      if (!this.practiceMode) {
        this.gameTime += dt;
      }

      // 顾客耐心
      for (const c of this.customers) {
        if (c.state === 'waiting' || c.state === 'accepted' || c.state === 'direct') {
          c.patience -= dt;
          if (c.patience <= 0) {
            this.customerLeave(c, 'timeout');
          }
        }
      }

      // 生成新顾客
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.customers.length < GAME_CONFIG.maxCustomers && this.gameTime < GAME_CONFIG.totalTime) {
        this.spawnCustomer();
        const interval = Math.max(2, GAME_CONFIG.spawnIntervalBase - this.restaurantLevel * 0.6 + this.badReviews * 0.4);
        this.spawnTimer = interval + rng() * 2;
      }

      // 打烊
      if (!this.practiceMode && this.gameTime >= GAME_CONFIG.totalTime && this.customers.filter(c => c.state !== 'left' && c.state !== 'served').length === 0) {
        this.endDay();
        return;
      }

      this.render();
      requestAnimationFrame((t) => this.tick(t));
    }

    spawnCustomer(random = true, forcedDish = null) {
      const tagKey = pickRandom(TAG_KEYS);
      const tag = CUSTOMER_TAGS[tagKey];
      let order;
      if (forcedDish) {
        order = { items: [{ dish: forcedDish, qty: 1 }], hasCoupon: false, couponD: 0, originalPrice: DISHES[forcedDish].price };
      } else {
        order = buildOrder(this.restaurantLevel);
      }
      const extraPatience = (order.items.reduce((s, i) => s + i.qty, 0) - 1) * 30;
      const customer = {
        id: this.nextCustomerId++,
        tagKey,
        tag,
        order,
        maxPatience: tag.basePatience + extraPatience,
        patience: tag.basePatience + extraPatience,
        state: 'waiting',
        recommended: null,
        lockedTip: 0,
        lockedComp: 0,
        deliveredItems: [],
        reviewGiven: false,
        processed: false
      };
      this.customers.push(customer);
      this.log(`顾客 #${customer.id} ${tag.name} 到来`);
    }

    acceptOrder(customerId, recommend) {
      const c = this.customers.find(x => x.id === customerId);
      if (!c || c.state !== 'waiting' || c.processed) return;
      c.processed = true;
      c.state = recommend ? 'accepted' : 'direct';
      c.recommended = recommend;
      c.acceptedAt = this.gameTime;
      const rep = REPUTATION_LEVELS[this.reputationLevel];
      c.lockedTip = rep.tip;
      c.lockedComp = rep.comp;
      this.currentCustomerId = customerId;
      if (recommend && c.order.hasCoupon) {
        this.log(`#${c.id} 已推荐优惠组合`);
      } else if (!recommend && c.order.hasCoupon) {
        this.log(`#${c.id} 直接接单，未推荐优惠`);
      } else {
        this.log(`#${c.id} 已接单`);
      }
    }

    rejectOrder(customerId) {
      const c = this.customers.find(x => x.id === customerId);
      if (!c || c.state !== 'waiting' || c.processed) return;
      c.processed = true;
      c.state = 'rejected';
      this.badReviews++; // 拒单记为评价-1，按需求：评价-1
      this.rejectedCount++;
      this.log(`#${c.id} 拒单，评价 -1`);
      setTimeout(() => this.removeCustomer(customerId), 600);
    }

    customerLeave(c, reason) {
      if (c.state === 'left' || c.state === 'served' || c.state === 'rejected') return;
      c.state = 'left';
      if (reason === 'timeout' && !c.reviewGiven) {
        c.reviewGiven = true;
        this.badReviews++;
        this.log(`#${c.id} 等不及离开了，差评 -1`);
      }
      setTimeout(() => this.removeCustomer(c.id), 600);
    }

    removeCustomer(id) {
      this.customers = this.customers.filter(c => c.id !== id);
      if (this.currentCustomerId === id) {
        this.currentCustomerId = null;
      }
    }

    // ===== 备餐 =====
    canTakeIngredient() {
      if (!this.isOpen || this.paused) return false;
      return this.customers.some(c => c.state === 'accepted' || c.state === 'direct');
    }

    addIngredient(id) {
      if (!this.canTakeIngredient()) return;
      if (this.making.length >= GAME_CONFIG.maxIngredients) {
        this.log('材料太多啦，先组合或清空');
        return;
      }
      this.making.push(id);
      this.tryCompleteBurger();
    }

    addDirect(dishId) {
      if (!this.canTakeIngredient()) return;
      const total = this.tray.burgers.length + Object.values(this.tray.snacks).reduce((a, b) => a + b, 0) + this.making.length;
      if (total >= GAME_CONFIG.maxTrayItems) {
        this.log('托盘已满，先出餐');
        return;
      }
      this.tray.snacks[dishId] = (this.tray.snacks[dishId] || 0) + 1;
    }

    getNeededBurgers(customerId) {
      const c = this.customers.find(x => x.id === customerId);
      if (!c || c.state === 'waiting' || c.state === 'left' || c.state === 'served' || c.state === 'rejected') return {};
      const needed = {};
      for (const it of c.order.items) {
        if (BURGER_IDS.includes(it.dish)) needed[it.dish] = (needed[it.dish] || 0) + it.qty;
      }
      // 减去已交付
      for (const it of c.deliveredItems) {
        if (needed[it.dish]) needed[it.dish] -= it.qty;
      }
      return needed;
    }

    tryCompleteBurger() {
      // 统计材料
      const counts = {};
      for (const ing of this.making) counts[ing] = (counts[ing] || 0) + 1;

      // 找出材料完全匹配的汉堡：keys 与 values 都相等
      let matched = null;
      for (const id of BURGER_IDS) {
        const recipe = DISHES[id].recipe;
        const recipeKeys = Object.keys(recipe);
        const countKeys = Object.keys(counts);
        if (recipeKeys.length !== countKeys.length) continue;
        if (!recipeKeys.every(k => counts[k] === recipe[k])) continue;
        matched = id;
        break;
      }
      if (!matched) return;

      // 仅当匹配的汉堡是当前选中顾客所需时才自动组合，避免大汉堡被小配方提前截断
      const needed = this.getNeededBurgers(this.currentCustomerId);
      if (!needed[matched]) {
        return;
      }

      const total = this.tray.burgers.length + Object.values(this.tray.snacks).reduce((a, b) => a + b, 0);
      if (total >= GAME_CONFIG.maxTrayItems) {
        this.log('托盘已满，先出餐');
        return;
      }
      this.tray.burgers.push(matched);
      this.making = [];
      this.log(`${DISHES[matched].name} 制作完成`);
    }

    manualCombine() {
      // 把当前材料强行组合成「问题汉堡」或直接失败
      if (this.making.length === 0) return;
      const counts = {};
      for (const ing of this.making) counts[ing] = (counts[ing] || 0) + 1;
      let matched = null;
      for (const id of BURGER_IDS) {
        const recipe = DISHES[id].recipe;
        const recipeKeys = Object.keys(recipe);
        const countKeys = Object.keys(counts);
        if (recipeKeys.length !== countKeys.length) continue;
        if (!recipeKeys.every(k => counts[k] === recipe[k])) continue;
        matched = id;
        break;
      }
      if (matched) {
        const total = this.tray.burgers.length + Object.values(this.tray.snacks).reduce((a, b) => a + b, 0);
        if (total >= GAME_CONFIG.maxTrayItems) {
          this.log('托盘已满，先出餐');
          return;
        }
        this.tray.burgers.push(matched);
        this.making = [];
        this.log(`${DISHES[matched].name} 组合完成`);
      } else {
        // 不合格餐品，作为 badBurger 放入托盘
        const total = this.tray.burgers.length + Object.values(this.tray.snacks).reduce((a, b) => a + b, 0);
        if (total >= GAME_CONFIG.maxTrayItems) {
          this.log('托盘已满');
          return;
        }
        this.tray.burgers.push('__bad__');
        this.making = [];
        this.log('组合成不合格餐品，会收到投诉');
      }
    }

    clearMaking() {
      if (this.making.length > 0) {
        this.making = [];
        this.log('清空制作中的材料');
      }
    }

    clearTray() {
      this.tray = { burgers: [], snacks: {} };
      this.making = [];
      this.log('清空整盘');
    }

    removeTrayBurger(index) {
      this.tray.burgers.splice(index, 1);
    }

    removeTraySnack(id) {
      if (this.tray.snacks[id] > 0) {
        this.tray.snacks[id]--;
        if (this.tray.snacks[id] === 0) delete this.tray.snacks[id];
      }
    }

    selectCustomer(id) {
      const c = this.customers.find(x => x.id === id);
      if (!c || c.state === 'left' || c.state === 'served' || c.state === 'rejected') return;
      this.currentCustomerId = id;
    }

    // ===== 出餐 =====
    serveCustomer(customerId) {
      const c = this.customers.find(x => x.id === customerId);
      if (!c || c.state === 'waiting' || c.state === 'left' || c.state === 'served' || c.state === 'rejected') return;
      if (this.making.length > 0) {
        this.log('还有未完成材料，请先组合或清空');
        return;
      }

      // 构建订单需求
      const needed = {};
      for (const it of c.order.items) needed[it.dish] = (needed[it.dish] || 0) + it.qty;
      const delivered = {};
      for (const it of c.deliveredItems) delivered[it.dish] = (delivered[it.dish] || 0) + it.qty;

      // 构建托盘快照
      const trayBurgers = [...this.tray.burgers];
      const traySnacks = { ...this.tray.snacks };

      // 匹配校验
      const matched = {};
      const wrongItems = [];

      // 汉堡匹配：优先按名字匹配，badBurger 算错
      for (const burger of trayBurgers) {
        if (burger === '__bad__') {
          wrongItems.push('问题汉堡');
          continue;
        }
        const need = (needed[burger] || 0) - (matched[burger] || 0);
        if (need > 0) {
          matched[burger] = (matched[burger] || 0) + 1;
        } else {
          wrongItems.push(DISHES[burger].name);
        }
      }

      // 小食饮料匹配
      for (const [dishId, qty] of Object.entries(traySnacks)) {
        const need = (needed[dishId] || 0) - (matched[dishId] || 0);
        const use = Math.min(qty, need);
        if (use > 0) {
          matched[dishId] = (matched[dishId] || 0) + use;
        }
        if (use < qty) {
          wrongItems.push(`${DISHES[dishId].name}×${qty - use}`);
        }
      }

      // 计算缺口
      const short = [];
      for (const [dishId, need] of Object.entries(needed)) {
        const have = (matched[dishId] || 0) + (delivered[dishId] || 0);
        if (have < need) short.push(`${DISHES[dishId].name}×${need - have}`);
      }

      if (wrongItems.length > 0) {
        // 错误/多余 → 餐品投诉一次
        this.foodComplaints++;
        this.badReviews++;
        c.reviewGiven = true;
        const penalty = c.order.originalPrice;
        this.money -= penalty;
        this.log(`#${c.id} 收到错误/多余餐品：${wrongItems.join('，')}，扣 ${formatMoney(penalty)}`);
        this.showFloat(wrongItems.join(' '), -penalty);
        this.clearTray();
        this.finishCustomer(c, 'wrong');
        return;
      }

      if (short.length > 0) {
        this.log(`#${c.id} 还缺：${short.join('，')}`);
        return;
      }

      // 全部正确且完整
      this.clearTray();
      this.finishCustomer(c, 'complete');
    }

    finishCustomer(c, result) {
      if (result === 'complete') {
        const p = c.order.originalPrice;
        let tip = 0;
        let compensation = 0;
        let review = 'normal';

        // 优惠投诉判定
        if (c.order.hasCoupon && !c.recommended) {
          if (rng() < c.tag.couponRate) {
            this.couponComplaints++;
            compensation = Math.round(p * c.lockedComp);
            review = 'bad';
            this.log(`#${c.id} 优惠投诉！补偿 ${formatMoney(compensation)}`);
            this.showFloat('优惠投诉', -(compensation));
          }
        }

        // 评价判定
        if (review !== 'bad') {
          const ratio = c.patience / c.maxPatience;
          if (ratio > 0.75) {
            review = 'good';
          } else {
            review = 'normal';
          }
        }

        // 小费
        if (c.recommended && c.order.hasCoupon) {
          tip = Math.round(c.order.couponD * c.lockedTip * 100);
          this.log(`#${c.id} 推荐优惠成功，小费 +${formatMoney(tip)}`);
          this.showFloat(`小费 +${formatMoney(tip)}`, tip, 'gold');
        }

        const net = p * 100 - compensation + tip;
        this.money += net;
        this.totalEarnings += Math.max(0, p * 100 + tip);
        this.completedOrders++;
        if (review === 'good') this.goodReviews++;
        else if (review === 'normal') this.normalReviews++;
        else this.badReviews++;

        this.updateScale();
        this.saveBestScore();

        if (review === 'bad') {
          this.showFloat('差评', 0, 'red');
        } else if (review === 'good') {
          this.showFloat('好评', p * 100, 'green');
        } else {
          this.showFloat('收入', p * 100, 'green');
        }
      }

      c.state = 'served';
      c.reviewGiven = true;
      setTimeout(() => this.removeCustomer(c.id), 500);
    }

    updateScale() {
      let newLevel = 1;
      for (let i = SCALE_THRESHOLDS.length - 1; i >= 0; i--) {
        if (this.totalEarnings >= SCALE_THRESHOLDS[i] * 100) {
          newLevel = i + 1;
          break;
        }
      }
      if (newLevel > this.restaurantLevel) {
        this.restaurantLevel = newLevel;
        this.log(`餐厅规模升到 Lv.${newLevel}！顾客会更多样`);
      }
    }

    updateReputation() {
      // 评价等级由好评差评综合决定，边界 1-7
      const score = this.goodReviews - this.badReviews;
      this.reputationLevel = clamp(score + 2, 1, 7);
    }

    showFloat(text, amount, colorClass = 'green') {
      if (typeof document === 'undefined') return;
      const app = document.getElementById('game-app');
      if (!app) return;
      const el = document.createElement('div');
      el.className = `float-text float-${colorClass}`;
      el.textContent = amount === 0 ? text : `${text} ${amount > 0 ? '+' : ''}${formatMoney(amount)}`;
      const rect = app.getBoundingClientRect();
      el.style.left = (rect.left + rect.width / 2 + (Math.random() * 80 - 40)) + 'px';
      el.style.top = (rect.top + rect.height / 2) + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    endDay() {
      this.isOpen = false;
      this.updateReputation();
      this.saveBestScore();
      this.renderSettlement();
    }

    // ===== 渲染 =====
    render() {
      this.updateReputation();
      document.getElementById('hud-time').textContent = this.practiceMode ? '自由练习' : `营业 ${Math.max(0, GAME_CONFIG.totalTime - Math.floor(this.gameTime))}s`;
      document.getElementById('hud-money').textContent = formatMoney(this.money);
      document.getElementById('hud-scale').textContent = `规模 Lv.${this.restaurantLevel}`;
      document.getElementById('hud-rep').textContent = `评价 Lv.${this.reputationLevel}`;

      this.renderCustomers();
      this.renderKitchen();
      this.renderSidebar();
    }

    renderCustomers() {
      const container = document.getElementById('customer-row');
      container.innerHTML = '';
      for (const c of this.customers) {
        const el = document.createElement('div');
        el.className = `customer-card ${this.currentCustomerId === c.id ? 'active' : ''} ${c.state === 'left' || c.state === 'served' || c.state === 'rejected' ? 'leaving' : ''}`;

        const ratio = clamp(c.patience / c.maxPatience, 0, 1);
        const patienceClass = ratio > 0.25 ? (ratio > 0.75 ? '' : 'warn') : 'danger';
        const orderText = c.order.items.map(it => `${DISHES[it.dish].emoji} ${DISHES[it.dish].name}${it.qty > 1 ? '×' + it.qty : ''}`).join('<br>');
        const deliveredText = c.deliveredItems.length > 0 ? `<br><span style="color:#999">已交：${c.deliveredItems.map(it => `${DISHES[it.dish].name}×${it.qty}`).join(' ')}</span>` : '';

        let actions = '';
        if (c.state === 'waiting') {
          if (c.order.hasCoupon) {
            actions = `
              <button class="btn btn-gold" data-action="recommend" data-id="${c.id}">推荐优惠</button>
              <button class="btn btn-primary" data-action="accept" data-id="${c.id}">直接接单</button>
              <button class="btn btn-muted" data-action="reject" data-id="${c.id}">拒单</button>
            `;
          } else {
            actions = `
              <button class="btn btn-primary" data-action="accept" data-id="${c.id}">接单制作</button>
              <button class="btn btn-muted" data-action="reject" data-id="${c.id}">拒单</button>
            `;
          }
        } else if (c.state === 'accepted' || c.state === 'direct') {
          actions = `<button class="btn btn-green" data-action="serve" data-id="${c.id}">整盘出餐</button>`;
        }

        const couponHint = c.order.hasCoupon
          ? `<div class="coupon-hint">💡 可省 ¥${c.order.couponD}</div>`
          : '';

        el.innerHTML = `
          <div class="patience-wrap">
            <div class="patience-bar ${patienceClass}" style="height:${Math.round(ratio * 100)}%"></div>
            <div class="patience-text">${Math.ceil(c.patience)}</div>
          </div>
          <div class="customer-avatar">${c.tag.emoji}</div>
          <div class="customer-tag">${c.tag.name}</div>
          <div class="order-id">#${c.id}</div>
          <div class="order-items">${orderText}${deliveredText}</div>
          <div class="order-price">${formatMoney(c.order.originalPrice * 100)}</div>
          ${couponHint}
          <div class="customer-actions">${actions}</div>
        `;
        container.appendChild(el);
      }
    }

    renderKitchen() {
      // 材料区
      const ingContainer = document.getElementById('ingredient-row');
      const canUse = this.canTakeIngredient();
      ingContainer.innerHTML = INGREDIENTS.map(ing => `
        <button class="ingredient-btn" data-ing="${ing.id}" ${!canUse ? 'disabled' : ''}>
          ${ing.emoji} ${ing.name}
        </button>
      `).join('');

      // 小食饮料
      const snackContainer = document.getElementById('snack-row');
      snackContainer.innerHTML = DIRECT_IDS.map(id => `
        <button class="ingredient-btn" data-direct="${id}" ${!canUse ? 'disabled' : ''}>
          ${DISHES[id].emoji} ${DISHES[id].name}
        </button>
      `).join('');

      // 制作中
      const makingEl = document.getElementById('making-zone');
      if (this.making.length === 0) {
        makingEl.innerHTML = '<div class="empty-tip">点击材料开始制作汉堡</div>';
      } else {
        makingEl.innerHTML = this.making.map(id => {
          const ing = INGREDIENTS.find(x => x.id === id);
          return `<span class="tray-item">${ing.emoji} ${ing.name}</span>`;
        }).join('');
      }

      // 已备汉堡
      const burgerEl = document.getElementById('burger-zone');
      if (this.tray.burgers.length === 0) {
        burgerEl.innerHTML = '<div class="empty-tip">完成的汉堡会放在这里</div>';
      } else {
        burgerEl.innerHTML = this.tray.burgers.map((id, idx) => {
          if (id === '__bad__') return `<span class="tray-item" style="border-color:var(--red)">❌ 问题汉堡<span class="remove" data-rmburger="${idx}">−</span></span>`;
          return `<span class="tray-item">${DISHES[id].emoji} ${DISHES[id].name}<span class="remove" data-rmburger="${idx}">−</span></span>`;
        }).join('');
      }

      // 小食饮料区
      const snackTrayEl = document.getElementById('snack-zone');
      const snackEntries = Object.entries(this.tray.snacks);
      if (snackEntries.length === 0) {
        snackTrayEl.innerHTML = '<div class="empty-tip">小食/饮料会放在这里</div>';
      } else {
        snackTrayEl.innerHTML = snackEntries.map(([id, qty]) => `
          <span class="tray-item">${DISHES[id].emoji} ${DISHES[id].name}×${qty}<span class="remove" data-rmsnack="${id}">−</span></span>
        `).join('');
      }

      // 当前订单缺什么
      const current = this.customers.find(c => c.id === this.currentCustomerId && (c.state === 'accepted' || c.state === 'direct'));
      const needEl = document.getElementById('need-hint');
      if (current) {
        const needed = {};
        for (const it of current.order.items) needed[it.dish] = (needed[it.dish] || 0) + it.qty;
        const trayCounts = {};
        for (const b of this.tray.burgers) {
          if (b !== '__bad__') trayCounts[b] = (trayCounts[b] || 0) + 1;
        }
        for (const [id, qty] of Object.entries(this.tray.snacks)) trayCounts[id] = (trayCounts[id] || 0) + qty;

        const short = [];
        const extra = [];
        for (const id of new Set([...Object.keys(needed), ...Object.keys(trayCounts)])) {
          const need = needed[id] || 0;
          const have = trayCounts[id] || 0;
          if (have < need) short.push(`${DISHES[id].name}×${need - have}`);
          if (have > need) extra.push(`${DISHES[id].name}×${have - need}`);
        }

        let text = '';
        if (short.length === 0 && extra.length === 0) {
          text = '✅ 已配齐，可以整盘出餐';
        } else {
          if (short.length) text += `缺：${short.join('，')} `;
          if (extra.length) text += `多：${extra.join('，')}`;
        }
        needEl.textContent = text;
      } else {
        needEl.textContent = this.customers.some(c => c.state === 'accepted' || c.state === 'direct') ? '点击顾客卡选中订单' : '先接单再备餐';
      }

      // 统计底部
      document.getElementById('stat-orders').textContent = `完成 ${this.completedOrders}`;
      document.getElementById('stat-reviews').textContent = `👍${this.goodReviews} 😐${this.normalReviews} 👎${this.badReviews}`;
      document.getElementById('stat-tip').textContent = `小费×${REPUTATION_LEVELS[this.reputationLevel].tip}`;
      document.getElementById('stat-comp').textContent = `补偿×${REPUTATION_LEVELS[this.reputationLevel].comp}`;
    }

    renderSidebar() {
      const current = this.customers.find(c => c.id === this.currentCustomerId && (c.state === 'accepted' || c.state === 'direct'));
      const recipeEl = document.getElementById('current-recipe');
      if (current) {
        const items = current.order.items.map(it => {
          const d = DISHES[it.dish];
          if (d.direct) return `<div><span class="recipe-name">${d.emoji} ${d.name}×${it.qty}</span> <span class="recipe-ing">直接取餐</span></div>`;
          const ingText = Object.entries(d.recipe).map(([k, v]) => {
            const ing = INGREDIENTS.find(i => i.id === k);
            return `${ing.name}${v > 1 ? '×' + v : ''}`;
          }).join(' + ');
          return `<div><span class="recipe-name">${d.emoji} ${d.name}×${it.qty}</span><br><span class="recipe-ing">${ingText}</span></div>`;
        }).join('');
        recipeEl.innerHTML = `<strong>当前订单 #${current.id}</strong><br>${items}`;
      } else {
        recipeEl.innerHTML = '<div class="empty-tip">选中顾客查看配方</div>';
      }

      const nutritionEl = document.getElementById('nutrition-ref');
      if (this.mcdCache && this.mcdCache.status !== 'offline-no-token' && this.mcdCache.status !== 'offline-cache') {
        const targetDishes = current ? [...new Set(current.order.items.map(it => it.dish))] : DISH_IDS;
        const lines = targetDishes.map(id => {
          const d = DISHES[id];
          const item = findNutrition(d.name, this.mcdCache);
          return `<div><strong>${d.emoji} ${d.name}</strong><br>${renderNutritionItem(item)}</div>`;
        }).join('<br>');
        const meta = `<div style="font-size:11px;color:#999;margin-bottom:6px">来源：${this.mcdCache.tool} · ${this.mcdCache.updatedAt} · ${this.mcdCache.status}</div>`;
        nutritionEl.innerHTML = meta + lines;
      } else {
        const status = this.mcdCache ? this.mcdCache.status : 'offline';
        nutritionEl.innerHTML = `<div class="empty-tip">当前为 ${status} 模式。运行 <code>npm run mcp:sync</code> 并配置 MCD_MCP_TOKEN 后，可在此显示麦当劳真实餐品营养信息。</div>`;
      }

      const logEl = document.getElementById('game-log');
      logEl.innerHTML = this.logs.map(l => `<div class="log-entry">${l}</div>`).join('');
    }

    renderSettlement() {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal">
          <h2>🌙 打烊结算</h2>
          <p class="big">最终余额：${formatMoney(this.money)}</p>
          <p>本机最佳：${formatMoney(this.bestScore)}</p>
          <p>基础餐费收入：${formatMoney(this.totalEarnings)}</p>
          <p>完成订单：${this.completedOrders}</p>
          <p>好评 / 普通 / 差评：${this.goodReviews} / ${this.normalReviews} / ${this.badReviews}</p>
          <p>拒单：${this.rejectedCount} | 优惠投诉：${this.couponComplaints} | 餐品投诉：${this.foodComplaints}</p>
          <p>餐厅规模：Lv.${this.restaurantLevel} | 评价等级：Lv.${this.reputationLevel}</p>
          <button class="btn btn-primary" id="restart-btn" style="width:100%;margin-top:10px">再开一局</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('restart-btn').addEventListener('click', () => {
        overlay.remove();
        this.showStartScreen();
      });
    }

    showStartScreen() {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const cacheInfo = this.mcdCache ? `缓存数据更新时间：${this.mcdCache.updatedAt}<br>来源工具：${this.mcdCache.tool}<br>状态：${this.mcdCache.status}` : '离线练习（无 MCP 缓存）';
      overlay.innerHTML = `
        <div class="modal">
          <h2>🍟 麦麦餐厅</h2>
          <p>观察订单 → 推荐优惠 → 按配方备餐 → 整盘出餐 → 赚取小费与好评</p>
          <p style="font-size:12px;color:var(--muted)">${cacheInfo}</p>
          <button class="btn btn-primary" id="start-btn" style="width:100%;margin-bottom:8px">开始营业（3分钟）</button>
          <button class="btn btn-blue" id="practice-btn" style="width:100%;margin-bottom:8px">自由练习（不计时）</button>
          <div style="margin-top:10px;font-size:12px;color:var(--muted)">
            <label>固定种子（测试用）：</label>
            <input id="seed-input" type="text" style="width:100%;padding:6px;border:1px solid var(--border);border-radius:6px;margin-top:4px" placeholder="留空随机">
          </div>
          <p style="font-size:11px;color:#999;margin-top:10px">本游戏价格为游戏设定，不代表现实售价。</p>
        </div>
      `;
      document.body.appendChild(overlay);
      document.getElementById('start-btn').addEventListener('click', () => {
        const seed = document.getElementById('seed-input').value;
        overlay.remove();
        this.start({ seed });
      });
      document.getElementById('practice-btn').addEventListener('click', () => {
        const seed = document.getElementById('seed-input').value;
        overlay.remove();
        this.start({ practice: true, seed });
      });
    }
  }

  const MaiMaiGame = {
    Game,
    INGREDIENTS,
    DIRECT_ITEMS,
    DISHES,
    CUSTOMER_TAGS,
    REPUTATION_LEVELS,
    SCALE_THRESHOLDS,
    GAME_CONFIG
  };
  if (typeof globalThis !== 'undefined') globalThis.MaiMaiGame = MaiMaiGame;
  if (typeof window !== 'undefined') window.MaiMaiGame = MaiMaiGame;

  // ===== 初始化 =====
  let game;
  function initApp() {
    // 尝试读取 MCP 缓存（构建时嵌入）
    if (window.MCD_MENU_CACHE) {
      game = new Game();
      game.mcdCache = window.MCD_MENU_CACHE;
    } else {
      game = new Game();
    }

    // 绑定事件委托
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action], [data-ing], [data-direct], [data-rmburger], [data-rmsnack], #btn-clear-making, #btn-clear-tray, #btn-combine, #pause-btn');
      if (!target) return;

      if (target.dataset.action) {
        const id = parseInt(target.dataset.id, 10);
        if (target.dataset.action === 'recommend') game.acceptOrder(id, true);
        if (target.dataset.action === 'accept') game.acceptOrder(id, false);
        if (target.dataset.action === 'reject') game.rejectOrder(id);
        if (target.dataset.action === 'serve') game.serveCustomer(id);
        return;
      }

      if (target.dataset.ing) {
        game.addIngredient(target.dataset.ing);
        return;
      }
      if (target.dataset.direct) {
        game.addDirect(target.dataset.direct);
        return;
      }
      if (target.dataset.rmburger !== undefined) {
        game.removeTrayBurger(parseInt(target.dataset.rmburger, 10));
        return;
      }
      if (target.dataset.rmsnack) {
        game.removeTraySnack(target.dataset.rmsnack);
        return;
      }
      if (target.id === 'btn-clear-making') game.clearMaking();
      if (target.id === 'btn-clear-tray') game.clearTray();
      if (target.id === 'btn-combine') game.manualCombine();
      if (target.id === 'pause-btn') {
        game.paused = !game.paused;
        target.textContent = game.paused ? '继续' : '暂停';
      }
    });

    // 点击顾客卡本身可选中（不包括按钮）
    document.getElementById('customer-row').addEventListener('click', (e) => {
      const card = e.target.closest('.customer-card');
      if (!card) return;
      if (e.target.closest('button')) return;
      const idEl = card.querySelector('.order-id');
      if (!idEl) return;
      const id = parseInt(idEl.textContent.replace('#', ''), 10);
      game.selectCustomer(id);
    });

    // 失焦暂停
    window.addEventListener('blur', () => {
      if (game && game.isOpen) game.paused = true;
      const pb = document.getElementById('pause-btn');
      if (pb) pb.textContent = '继续';
    });
    window.addEventListener('focus', () => {
      if (game && game.isOpen) {
        game.lastTick = performance.now();
      }
    });

    game.showStartScreen();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }
})();
