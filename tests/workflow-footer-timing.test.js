import test from 'node:test';
import assert from 'node:assert/strict';
import { workflowStepAt, workflowProgressAt, WORKFLOW_DEMO_SECONDS } from '../src/lib/components/site/workflow-steps.js';
import { nextFooterMaterial, FOOTER_MATERIALS, FOOTER_MATERIAL_MS } from '../src/lib/components/site/footer-materials.js';

test('workflow captions change at 9s and 15s of the demo video', () => {
  assert.equal(workflowStepAt(0), 0);
  assert.equal(workflowStepAt(8.99), 0);
  assert.equal(workflowStepAt(9), 1);
  assert.equal(workflowStepAt(14.99), 1);
  assert.equal(workflowStepAt(15), 2);
  assert.equal(workflowStepAt(WORKFLOW_DEMO_SECONDS), 2);
});

test('workflow progress is linear across the whole video and clamped', () => {
  assert.equal(workflowProgressAt(0, 19.784), 0);
  assert.equal(workflowProgressAt(9.892, 19.784), .5);
  assert.equal(workflowProgressAt(19.784, 19.784), 1);
  assert.equal(workflowProgressAt(25, 19.784), 1);
  assert.equal(workflowProgressAt(5, Infinity), 0);
  assert.equal(workflowProgressAt(5, 0), 0);
});

test('footer N shows each material for 120ms in order and loops until the pointer leaves', () => {
  assert.equal(FOOTER_MATERIAL_MS, 120);
  assert.equal(FOOTER_MATERIALS.length, 9);
  let active = 0, shown = 1;
  const changes = [];
  for (let t = 0; t <= 2400; t += 1) {
    const next = nextFooterMaterial(active, t, shown);
    if (next !== active) { active = next; shown++; changes.push([t, next]); }
  }
  // 2400ms covers two full cycles of nine 120ms steps (2160ms) and wraps back to the start.
  assert.deepEqual(changes.slice(0, 9).map(([, i]) => i), [1, 2, 3, 4, 5, 6, 7, 8, 0]);
  assert.deepEqual(changes.slice(0, 9).map(([t]) => t), [120, 240, 360, 480, 600, 720, 840, 960, 1080]);
  assert.ok(changes.every(([, i]) => i >= 0), 'never returns to white on its own');
  assert.equal(nextFooterMaterial(-1, 5000), -1);
});

test('a stalled frame never skips a material', () => {
  assert.equal(nextFooterMaterial(0, 400, 1), 1);
  assert.equal(nextFooterMaterial(1, 400, 2), 2);
  assert.equal(nextFooterMaterial(0, -16, 1), 0);
});
