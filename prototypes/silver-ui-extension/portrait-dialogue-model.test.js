const assert = require('node:assert/strict');
const model = require('./portrait-dialogue-model.js');
assert.deepEqual(model.paginate('あいうえおかきくけこ', 3, 2), ['あいう\nえおか', 'きくけ\nこ']);
assert.deepEqual(model.paginate('あい\nうえ', 4, 2), ['あい\nうえ']);
assert.deepEqual(model.paginate('', 4, 2), ['']);
assert.deepEqual(model.paginate('abcdef', 4, 1, text => text.length * 2), ['ab', 'cd', 'ef']);
assert.throws(() => model.paginate('文', 0, 2), RangeError);
assert.throws(() => model.paginate('文', 3, 0), RangeError);
const original = model.makeState();
const next = model.advance(original);
assert.equal(next.index, 1);
assert.equal(model.lines[next.index].side, 'right');
assert.deepEqual(original.entries, [0]);
assert.equal(model.advance(model.advance(next)).index, 0);
for (const line of model.lines) {
  assert.equal(model.paginate(line.text, 18, 3).join('').replaceAll('\n', ''), line.text.replaceAll('\n', ''));
}
console.log('portrait-dialogue-model: passed');
