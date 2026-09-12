import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const expected = read('calculations.json');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const percentile = (rows) => {
  assert.ok(rows.length >= 504);
  assert.equal(new Set(rows.map((x) => x.date)).size, rows.length);
  assert.ok(rows.every((x, i) => !i || x.date > rows[i - 1].date));
  const value = rows.at(-1).value;
  return (
    ((rows.filter((x) => x.value < value).length +
      0.5 * rows.filter((x) => x.value === value).length) /
      rows.length) *
    100
  );
};
for (const market of ['cn', 'us']) {
  const prices = read(`price-${market}.json`),
    e = expected[market];
  assert.equal(prices.at(-1).date, '2026-09-11');
  near((prices.at(-1).value / prices.at(-21).value - 1) * 100, e.return20d);
  for (const period of e.periods)
    near(
      (prices.at(-1).value /
        prices.find((x) => x.date === period.start.date).value -
        1) *
        100,
      period.return,
    );
}
const prices = read('price-cn.json'),
  rv = [];
for (let i = 20; i < prices.length; i++) {
  const w = prices.slice(i - 20, i + 1),
    returns = w.slice(1).map((x, j) => Math.log(x.value / w[j].value));
  const mean = returns.reduce((a, b) => a + b) / 20;
  rv.push({
    date: prices[i].date,
    value:
      Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / 19) *
      Math.sqrt(252) *
      100,
  });
}
assert.deepEqual(rv, read('realized-volatility-cn.json'));
near(percentile(rv), expected.cn.volatility.percentile);
near(percentile(read('vix-us.json')), expected.us.volatility.percentile);
near(percentile(read('credit-us.json')), expected.us.credit.percentile);
near(38 - 39.3, expected.us.survey.value);
near((2.0443 - 1.6899) * 100, expected.cnCreditBp);
near((1417225 / 1502072 - 1) * 100, expected.usLeveragePct);
console.log(
  'Input series, return windows, volatility, percentiles and arithmetic verified.',
);
