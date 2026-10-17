import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { createHero, HERO_OBJECTS } from '../src/lib/animations/hero.js';
import { createRipple } from '../src/lib/animations/ripples.js';
import { createTitleEffects } from '../src/lib/animations/title.js';

// Minimal decorative DOM adapter: these cases prove ownership, not real browser
// layout, font rasterization, hit-mask accuracy, or GPU visual fidelity.
function fixture() {
  const ledger = { writes: 0, canvases: 0, calls: [] };
  class Element extends EventTarget {
    /** @param {string} tag @param {any} doc */
    constructor(tag, doc) {
      super();
      this.tagName = tag;
      this.ownerDocument = doc;
      /** @type {any[]} */ this.children = [];
      /** @type {any} */ this.parentElement = null;
      /** @type {Record<string, any>} */ this.attrs = {};
      /** @type {Record<string, any[]>} */ this.callbacks = {};
      this.className = '';
      this.complete = false;
      this.naturalWidth = 0;
      this.naturalHeight = 0;
      this.src = '';
      this.offsetWidth = 150;
      this.offsetHeight = 68;
      this.width = 0;
      this.height = 0;
      /** @type {any} */ this.style = new Proxy({ setProperty() { ledger.writes++; } }, {
        set(target, key, value) { ledger.writes++; target[key] = value; return true; }
      });
      this.classList = {
        add: (name) => { ledger.writes++; this.className += ' ' + name; },
        remove: (name) => { ledger.writes++; this.className = this.className.split(' ').filter(x => x !== name).join(' '); },
        toggle: (name, enabled) => enabled ? this.classList.add(name) : this.classList.remove(name)
      };
    }
    /** @param {any} callback @param {any} [options] */
    addEventListener(type, callback, options) {
      (this.callbacks[type] ||= []).push(callback);
      super.addEventListener(type, callback, options);
    }
    append(...items) { for (const item of items) { ledger.writes++; item.parentElement = this; this.children.push(item); } }
    remove() { ledger.writes++; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); }
    setAttribute(name, value) { ledger.writes++; this.attrs[name] = value; }
    getAttribute(name) { return this.attrs[name] ?? null; }
    removeAttribute(name) { ledger.writes++; delete this.attrs[name]; if (name === 'src') this.src = ''; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [
        ...(child.className.split(' ').includes(selector.slice(1)) ? [child] : []),
        ...child.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 1440, bottom: 1200 }; }
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    getContext() {
      return {
        setTransform(...args) { ledger.calls.push(['transform', ...args]); },
        clearRect() { ledger.calls.push(['clear']); },
        beginPath() {},
        ellipse(...args) { ledger.calls.push(['ellipse', ...args]); },
        stroke() {}
      };
    }
  }
  /** @type {any} */
  const doc = {
    defaultView: { HTMLElement: Element, devicePixelRatio: 2, getComputedStyle: () => ({ fontSize: '56' }) },
    createElement(tag) { if (tag === 'canvas') ledger.canvases++; return new Element(tag, doc); }
  };
  const root = new Element('div', doc), hero = new Element('section', doc);
  const layer = new Element('div', doc), fallback = new Element('div', doc);
  hero.className = 'hero'; layer.className = 'objects-layer'; fallback.className = 'hero-object-static';
  fallback.style.visibility = '';
  root.append(hero); hero.append(layer); layer.append(fallback);
  return /** @type {any} */ ({ root, hero, layer, fallback, doc, ledger });
}

function deferred() {
  /** @type {any} */ let resolve = () => {};
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('hero, ripple and title imports do not require browser globals', () => {
  const urls = ['hero', 'ripples', 'title'].map(name => new URL('../src/lib/animations/' + name + '.js', import.meta.url).href);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e',
    `delete globalThis.document; delete globalThis.window; delete globalThis.matchMedia; await Promise.all(${JSON.stringify(urls)}.map(url => import(url)));`
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('hero starts with complete source art and reduced motion stays still with no scheduler', () => {
  const f = fixture();
  const controller = createHero(f.root, { reducedMotion: true, platform: { requestFrame() { throw Error('child cannot schedule'); } } });
  assert.equal(HERO_OBJECTS.length, 10);
  const objects = f.layer.querySelectorAll('.obj');
  assert.equal(objects.length, 20);
  assert.equal(objects[0].style.transform, 'translate3d(407px, 318px, 0)');
  assert.equal(objects[0].style.opacity, '1');
  assert.equal(f.fallback.style.visibility, 'hidden');
  controller.update(0.05, { reducedMotion: true, finePointer: false });
  const stable = objects.map(node => node.style.transform);
  controller.update(10, { reducedMotion: true, finePointer: false });
  assert.deepEqual(objects.map(node => node.style.transform), stable);
  for (const node of objects.filter(node => node.style.visibility !== 'hidden')) assert.equal(Number(node.style.opacity), 1);
  controller.destroy();
  assert.equal(f.fallback.style.visibility, '');
  assert.equal(f.layer.children.length, 1);
});

test('hero ignores queued image callbacks and updates after abort, and restores fallback', () => {
  const f = fixture(), abort = new AbortController();
  const controller = createHero(f.root, { signal: abort.signal });
  const images = f.layer.querySelectorAll('.obj-inner').map(inner => inner.children[0]);
  const staleCallbacks = images.flatMap(image => image.callbacks.load || []);
  assert.equal(staleCallbacks.length, 10);
  abort.abort();
  const writes = f.ledger.writes, canvases = f.ledger.canvases;
  for (const callback of staleCallbacks) callback(); // Already delivered before listener removal.
  controller.update(0.05, { reducedMotion: false, finePointer: true, pointer: { cx: 500, cy: 500 } });
  controller.resize({ scale: 2 }); controller.destroy();
  assert.equal(f.ledger.writes, writes);
  assert.equal(f.ledger.canvases, canvases);
  assert.equal(f.fallback.style.visibility, '');
  assert.equal(f.layer.children.length, 1);
  for (const image of images) assert.equal(image.src, '');
});

test('ripples retain the source cap, pause clearing and terminal canvas release', () => {
  const f = fixture(), canvas = f.doc.createElement('canvas');
  const ripple = createRipple(canvas, {
    width: 1800, height: 1800, stage: f.hero, maxK: 1.25, scale: 1, platform: { random: () => 0.5 }
  });
  ripple.resize({ scale: 10, dpr: 2 });
  assert.equal(canvas.width, 2250);
  for (let i = 0; i < 80; i++) ripple.addAt(200, 200);
  assert.equal(ripple.ripples.length, 70);
  ripple.update(0.05, { cx: -1e4, cy: -1e4 });
  assert(f.ledger.calls.some(call => call[0] === 'ellipse'));
  ripple.update(0.05, { reducedMotion: true });
  assert.equal(ripple.ripples.length, 0);
  ripple.destroy();
  const calls = f.ledger.calls.length;
  ripple.update(0.05, { cx: 200, cy: 200 }); ripple.resize({ scale: 1, dpr: 1 }); ripple.addAt(200, 200);
  assert.equal(f.ledger.calls.length, calls);
  assert.equal(ripple.ripples.length, 0);
  assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
});

test('a pending font completion cannot write a heading after abort', async () => {
  const f = fixture(), abort = new AbortController(), fonts = deferred();
  const word3d = f.doc.createElement('span'), workspace = f.doc.createElement('span');
  const host3d = f.doc.createElement('span'), hostWorkspace = f.doc.createElement('span');
  word3d.className = 'tw-3d'; workspace.className = 'tw-ws';
  host3d.className = hostWorkspace.className = 'title-overlay';
  word3d.append(host3d); workspace.append(hostWorkspace); f.root.append(word3d, workspace);
  const pending = createTitleEffects(f.root, {
    signal: abort.signal, platform: { fontsReady: fonts.promise, loadFonts: () => Promise.resolve() }
  });
  abort.abort();
  const handle = await pending;
  const writes = f.ledger.writes;
  fonts.resolve(); await Promise.resolve(); await Promise.resolve();
  handle.resize(); handle.destroy();
  assert.equal(f.ledger.writes, writes);
  assert.equal(host3d.children.length + hostWorkspace.children.length, 0);
  assert.equal(f.ledger.canvases, 0);
});
