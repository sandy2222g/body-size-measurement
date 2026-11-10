import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GARMENTS, BUNDLES, recommendSize, recommendBundle, recommendBra, bundleToCsv, bundleToText, isValidBody,
  type BodyMeasurements,
} from '../src/lib/sizing.ts';

const g = (id: string) => GARMENTS.find((x) => x.id === id)!;
const body = (o: Partial<BodyMeasurements> = {}): BodyMeasurements => ({
  chest: 94, waist: 75, hips: 101, shoulder_width: 40, arm_length: 61, inseam: 80, ...o,
});

test('typical woman maps to M across tops, dress and skirt', () => {
  for (const id of ['tshirt', 'dress', 'skirt', 'trousers']) {
    assert.equal(recommendSize(g(id), body(), 'female')!.size, 'M', id);
  }
});

test('typical man maps to M tops', () => {
  const r = recommendSize(g('tshirt'), body({ chest: 100, waist: 85 }), 'male')!;
  assert.equal(r.size, 'M');
});

test('size is monotonic in chest', () => {
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  let prev = -1;
  for (let c = 78; c <= 124; c += 2) {
    const s = recommendSize(g('tshirt'), body({ chest: c, waist: c - 20 }), 'female')!.size;
    const i = order.indexOf(s);
    assert.ok(i >= prev, `chest ${c} -> ${s}`);
    prev = i;
  }
});

test('fit preference shifts sizes the right way', () => {
  const b = body({ chest: 97.5, waist: 78.5 });
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const slim = order.indexOf(recommendSize(g('tshirt'), b, 'female', 'slim')!.size);
  const relaxed = order.indexOf(recommendSize(g('tshirt'), b, 'female', 'relaxed')!.size);
  assert.ok(relaxed >= slim);
  assert.ok(relaxed > slim, 'relaxed should be larger than slim near a boundary');
});

test('dress and skirt are not offered for men', () => {
  assert.equal(recommendSize(g('dress'), body(), 'male'), null);
  assert.equal(recommendSize(g('skirt'), body(), 'male'), null);
});

test('boundary measurement reports being between sizes', () => {
  const r = recommendSize(g('tshirt'), body({ chest: 90, waist: 71 }), 'female')!;
  assert.equal(r.between, true);
  assert.ok(r.alternate);
});

test('out of range measurements are flagged', () => {
  const r = recommendSize(g('tshirt'), body({ chest: 160, waist: 140 }), 'female')!;
  assert.equal(r.outOfRange, true);
  assert.equal(r.size, 'XXL');
});

test('length categories', () => {
  assert.equal(recommendSize(g('jacket'), body({ arm_length: 55 }), 'female')!.length, 'Short');
  assert.equal(recommendSize(g('jacket'), body({ arm_length: 61 }), 'female')!.length, 'Regular');
  assert.equal(recommendSize(g('jeans'), body({ inseam: 90 }), 'male')!.length, 'Long');
  assert.equal(recommendSize(g('tshirt'), body(), 'male')!.length, null);
});

test('jeans use waist-inch labels', () => {
  assert.match(recommendSize(g('jeans'), body({ waist: 84, hips: 104 }), 'male')!.size, /^W\d\d$/);
});

test('bundles respect gender', () => {
  const work = BUNDLES.find((b) => b.id === 'work')!;
  assert.equal(recommendBundle(work, body(), 'female').length, 5);
  assert.equal(recommendBundle(work, body(), 'male').length, 3);
});

test('bra: band estimated without underbust, cup with it', () => {
  const est = recommendBra(body({ chest: 96 }));
  assert.equal(est.underbustEstimated, true);
  assert.equal(est.cup, null);
  assert.equal(est.bandEU % 5, 0);
  const meas = recommendBra(body({ chest: 96, underbust: 78 }));
  assert.equal(meas.underbustEstimated, false);
  assert.equal(meas.bandEU, 80);
  assert.equal(meas.cup, 'D'); // diff 18cm
  assert.equal(recommendBra(body({ chest: 88, underbust: 78 })).cup, 'AA'); // diff 10
  assert.equal(recommendBra(body({ chest: 90, underbust: 78 })).cup, 'A'); // diff 12
  assert.equal(recommendBra(body({ chest: 92, underbust: 78 })).cup, 'B'); // diff 14
});

test('exports', () => {
  const casual = BUNDLES[0];
  const res = recommendBundle(casual, body(), 'female');
  const csv = bundleToCsv(casual, res, null);
  assert.equal(csv.split('\n').length, res.length + 1);
  assert.match(bundleToText(casual, res, recommendBra(body())), /T-Shirt: M/);
});

test('isValidBody', () => {
  assert.equal(isValidBody(body()), true);
  assert.equal(isValidBody({ ...body(), chest: NaN }), false);
  assert.equal(isValidBody(null), false);
});
