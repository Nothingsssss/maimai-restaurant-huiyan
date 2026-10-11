import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gamePath = path.resolve(__dirname, '..', 'src', 'index.html');

function loadGame() {
  // 提供浏览器全局最小模拟
  globalThis.localStorage = {
    data: {},
    getItem(k) { return this.data[k] ?? null; },
    setItem(k, v) { this.data[k] = String(v); }
  };
  globalThis.window = globalThis;
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  const makeEl = () => ({
    addEventListener: () => {},
    setAttribute: () => {},
    textContent: '',
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    className: '',
    focus: () => {},
    setPointerCapture: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 840 }),
    getContext: () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      globalAlpha: 1,
      beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
      arc: () => {}, ellipse: () => {}, rect: () => {}, roundRect: () => {}, strokeRect: () => {},
      fill: () => {}, stroke: () => {}, fillText: () => {}, strokeText: () => {}, setTransform: () => {},
      clearRect: () => {}, fillRect: () => {}, save: () => {}, restore: () => {},
      translate: () => {}, scale: () => {}, rotate: () => {},
      bezierCurveTo: () => {}
    }),
    children: [],
    firstElementChild: null,
    nextElementSibling: null,
    append: () => {},
    remove: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    dataset: {}
  });
  const elMock = () => {
    const el = makeEl();
    el.content = makeEl();
    return el;
  };
  globalThis.document = {
    getElementById: elMock,
    addEventListener: () => {},
    createElement: elMock,
    querySelectorAll: () => [],
    hidden: false
  };
  globalThis.requestAnimationFrame = () => {};
  globalThis.performance = { now: () => Date.now() };

  const html = fs.readFileSync(gamePath, 'utf-8');
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error('No script found in index.html');
  eval(scriptMatch[1]);
  return globalThis.Restaurant;
}

describe('麦麦餐厅核心规则', () => {
  let R;
  beforeEach(() => {
    delete globalThis.Restaurant;
    R = loadGame();
  });

  test('未接单不可出餐', () => {
    const g = new R({ seed: 'test1' });
    const c = g.customers.find(x => x.status === 'pending');
    assert(c);
    const r = g.deliver(c.id);
    assert.strictEqual(r, false);
    assert.strictEqual(g.served, 0);
  });

  test('推荐/直接接单/拒单', () => {
    const g = new R({ seed: 'test2' });
    const c = g.customers.find(x => x.status === 'pending');
    assert(c);
    assert.strictEqual(g.accept(c.id, 'tell'), true);
    assert.strictEqual(c.status, 'waiting');
    assert.strictEqual(c.decision, 'tell');

    const g2 = new R({ seed: 'test2b' });
    const c2 = g2.customers.find(x => x.status === 'pending');
    assert.strictEqual(g2.accept(c2.id, 'skip'), true);
    assert.strictEqual(c2.decision, 'skip');

    const g3 = new R({ seed: 'test2c' });
    const c3 = g3.customers.find(x => x.status === 'pending');
    const before = g3.ratingLevel;
    assert.strictEqual(g3.reject(c3.id), true);
    assert.strictEqual(c3.status, 'rejected');
    assert.strictEqual(g3.ratingLevel, before - 1);
  });

  test('重复点击只作用一次', () => {
    const g = new R({ seed: 'test3' });
    const c = g.customers.find(x => x.status === 'pending');
    g.accept(c.id, 'skip');
    const before = g.ratingLevel;
    g.reject(c.id); // 已接单，无法再拒
    assert.strictEqual(g.rejected, 0);
    assert.strictEqual(g.ratingLevel, before);
  });

  test('八种餐品配方校验正确：吉士汉堡包', () => {
    const g = new R({ seed: 'test4', initialOrders: [['cheese']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun');
    g.take('beef');
    g.take('slice');
    assert.strictEqual(g.tray.length, 1);
    assert.strictEqual(g.tray[0], 'cheese');
  });

  test('巨无霸不会被吉士汉堡包提前截断', () => {
    const g = new R({ seed: 'test5', initialOrders: [['bigmac']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun');
    g.take('beef');
    g.take('slice');
    assert.strictEqual(g.tray.length, 0, '材料未齐不应组合');
    g.take('beef');
    g.take('lettuce');
    assert.strictEqual(g.tray.length, 1);
    assert.strictEqual(g.tray[0], 'bigmac');
  });

  test('清材料保留已备餐品', () => {
    const g = new R({ seed: 'test6', initialOrders: [['cheese']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun');
    g.take('beef');
    g.take('slice');
    assert.strictEqual(g.tray.length, 1);
    g.take('bun');
    g.clearBench();
    assert.strictEqual(g.parts.length, 0);
    assert.strictEqual(g.tray.length, 1);
  });

  test('− 移除一份已备餐品', () => {
    const g = new R({ seed: 'test7', initialOrders: [['cheese', 'cheese']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun'); g.take('beef'); g.take('slice');
    g.take('bun'); g.take('beef'); g.take('slice');
    assert.strictEqual(g.tray.length, 2);
    g.removeFood('cheese');
    assert.strictEqual(g.tray.length, 1);
  });

  test('托盘容量保护', () => {
    const g = new R({ seed: 'test8' });
    const c = g.customers.find(x => x.status === 'pending');
    g.accept(c.id, c.coupon ? 'skip' : 'none');
    for (let i = 0; i < 15; i++) g.take('fries');
    assert.strictEqual(g.tray.length, 12);
  });

  test('错误配方投诉扣钱', () => {
    const g = new R({ seed: 'test9', initialOrders: [['cheese']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun');
    g.take('bun'); // 配方错误
    g.assemble();
    assert.strictEqual(g.tray[0], 'badBurger');
    const before = g.balance;
    g.deliver(c.id);
    assert.strictEqual(g.balance, before - c.price);
    assert.strictEqual(g.complaints, 1);
  });

  test('及时推荐的小费按 D×T', () => {
    const g = new R({ seed: 'test10', initialOrders: [['cheese', 'fries', 'coke']] });
    const c = g.customers[0];
    g.accept(c.id, 'tell');
    g.take('bun'); g.take('beef'); g.take('slice');
    g.take('fries'); g.take('coke');
    const before = g.balance;
    g.deliver(c.id);
    const expectedTip = Math.round(c.discount * c.rates.tip * 100) / 100;
    assert.strictEqual(g.tips, expectedTip);
    assert.strictEqual(g.balance, before + c.price + expectedTip);
    assert.strictEqual(g.good, 1);
  });

  test('跳过推荐无投诉只得 P', () => {
    const g = new R({ seed: 'test11', initialOrders: [['cheese', 'fries', 'coke']] });
    const c = g.customers[0];
    c.trait = { couponAttention: 0 };
    g.accept(c.id, 'skip');
    g.take('bun'); g.take('beef'); g.take('slice');
    g.take('fries'); g.take('coke');
    const before = g.balance;
    g.deliver(c.id);
    assert.strictEqual(g.tips, 0);
    assert.strictEqual(g.balance, before + c.price);
  });

  test('两汉堡两小食两饮料一次交付', () => {
    const g = new R({ seed: 'test12', initialOrders: [['cheese', 'cheese', 'fries', 'fries', 'coke', 'coke']] });
    const c = g.customers[0];
    c.coupon = false;
    g.accept(c.id, 'none');
    g.take('bun'); g.take('beef'); g.take('slice');
    g.take('bun'); g.take('beef'); g.take('slice');
    g.take('fries'); g.take('fries');
    g.take('coke'); g.take('coke');
    assert.strictEqual(g.tray.length, 6);
    g.deliver(c.id);
    assert.strictEqual(g.served, 1);
  });

  test('规模升级阈值检查', () => {
    const g = new R({ seed: 'test13' });
    g.earned = 800;
    assert.strictEqual(g.level, 5);
  });

  test('打烊后不能再接', () => {
    const g = new R({ seed: 'test14' });
    g.over = true;
    const c = g.customers.find(x => x.status === 'pending');
    assert.strictEqual(g.accept(c.id, 'none'), false);
  });
});
