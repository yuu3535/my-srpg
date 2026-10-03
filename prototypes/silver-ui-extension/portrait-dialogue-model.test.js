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
const narration = model.advance(model.advance(next));
assert.equal(model.lines[narration.index].side, 'none');
assert.equal(model.advance(narration).index, 0);
assert.equal(model.isHighlighted('left', 'left'), true);
assert.equal(model.isHighlighted('left', 'right'), false);
assert.equal(model.isHighlighted('right', 'right'), true);
assert.equal(model.isHighlighted('right', 'left'), false);
assert.equal(model.isHighlighted('none', 'left'), true);
assert.equal(model.isHighlighted('none', 'right'), true);
assert.match(model.framePath(408, 100, 20, 'left'), /H 49 L 20 117\.5 L 26 99\.5/);
assert.match(model.framePath(408, 100, 20, 'right'), /H 382 L 388 117\.5 L 359 99\.5/);
assert.doesNotMatch(model.framePath(408, 100, 20, 'none'), / L /);
assert.throws(() => model.framePath(NaN, 100, 20, 'left'), RangeError);
assert.match(model.framePath(408, 100, 20, 'left', 52), /H 101 L 72 117\.5 L 78 99\.5/);
assert.match(model.framePath(408, 100, 20, 'right', 87), /H 295 L 301 117\.5 L 272 99\.5/);
assert.equal(model.framePath(408, 100, 20, 'none', 220), model.framePath(408, 100, 20, 'none'));
assert.equal(model.framePath(320, 100, 24, 'left', 999), model.framePath(320, 100, 24, 'left', 236));
assert.throws(() => model.framePath(408, 100, 20, 'left', NaN), RangeError);
for (const width of [320, 408, 440]) {
  for (const height of [100, 156]) {
    for (const radius of [0, 20, 36]) {
      for (const side of ['left', 'right', 'none']) {
        const path = model.framePath(width, height, radius, side);
        assert.equal(path.endsWith(' Z'), true);
        assert.doesNotMatch(path, /NaN|undefined/);
      }
    }
  }
}
for (const line of model.lines) {
  assert.equal(model.paginate(line.text, 18, 3).join('').replaceAll('\n', ''), line.text.replaceAll('\n', ''));
}
console.log('portrait-dialogue-model: passed');
