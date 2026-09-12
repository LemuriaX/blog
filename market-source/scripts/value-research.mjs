import { valuationScenario } from '../lib/value-math.ts';

export function renderValueResearch(report, review) {
  const value = report.markets.cn.valueAnalysis;
  if (
    review.date !== report.date ||
    review.revision !== report.revision ||
    review.valuation.observedAt !== value.valuationDate ||
    JSON.stringify(review.valuation.benchmarks) !==
      JSON.stringify(value.benchmarks)
  ) {
    throw Error('Value research inputs do not match the current report');
  }
  const links = (ids) =>
    ids
      .map((id) => {
        const source = report.markets.cn.sources.find((s) => s.id === id);
        if (!source) throw Error(`Unknown research source ${id}`);
        return `[${source.label}](${source.url})`;
      })
      .join('、');
  const metric = (v) => (v === null ? '—' : v.toFixed(2));
  const scenarios = [
    { growth: 10, exitPe: 40 },
    { growth: 20, exitPe: 50 },
    { growth: 30, exitPe: 60 },
  ].map((s) => ({
    ...s,
    ...valuationScenario(value.stress.entryPe, s.exitPe, s.growth, 3),
  }));
  return `# A股价格与价值核验 · ${report.date}

本期修订专门核验价格、盈利和现金流之间的关系。信息截止日为${report.informationCutoff.cn}，取数与复核在${review.retrievedAt}完成。没有将后来发布的信息补入本周判断。

## 比较基准与研究范围

统一估值观测日：${value.valuationDate}。

${value.scopeNote}

${value.methodNote}

| 指数 | 代码 / 样本数 | PE（TTM） | PB | 历史股息率 | 直接来源 |
| --- | --- | ---: | ---: | ---: | --- |
${value.benchmarks.map((b) => `| ${b.name} | ${b.code} / ${b.samples} | ${metric(b.pe)} | ${metric(b.pb)} | ${metric(b.dividendYield)}${b.dividendYield === null ? '' : '%'} | ${links(b.refs)} |`).join('\n')}

估值是价格参照，尚不是价值结论。本期以六份同日中证单张为横截面，以交易所半年报统计、公司原始报表、统计局行业数据检验盈利与现金流，再用不同提供商的股息率说明寻找口径冲突。它们覆盖不同问题，不能互相充当相同口径的独立复证。转载同一公告也不计为第二份独立证据。

未取得覆盖各指数的成分股自由现金流、一致预期及长期估值序列，因此研究只能形成有条件的判断。没有输出目标价、历史低估分位或统一的安全边际分数。

## 五类资产的支持证据与反证

${value.cases
  .map(
    (c) => `### ${c.title}：${c.verdict}

价格参照：${c.metric}。

**支持证据。** ${c.support.text} 来源：${links(c.support.refs)}。

**最强反证。** ${c.challenge.text} 来源：${links(c.challenge.refs)}。

**综合判断。** ${c.resolution}

**样本边界。** ${c.limitation}

**后续可检验条件。** ${c.watch}`,
  )
  .join('\n\n')}

## 估值压力测试：增长与退出价格必须同时成立

以科创50的${value.stress.entryPe}倍PE为起点。以下每股盈利增速和三年后PE均为假设，不是预测或一致预期。来源：${links(value.stress.refs)}。

在固定篮子、忽略分红税费和调样的条件下：

- 三年价格倍数 = (1 + 每股盈利年增速)³ × 退出PE ÷ 起始PE。
- 年化价格回报 = 三年价格倍数的三次方根 − 1。
- 盈亏平衡年增速 = (起始PE ÷ 退出PE)的三次方根 − 1。

| 假设每股盈利年增速 | 假设退出PE | 三年价格回报 | 年化价格回报 |
| ---: | ---: | ---: | ---: |
${scenarios.map((s) => `| ${s.growth}% | ${s.exitPe}倍 | ${s.total.toFixed(2)}% | ${s.annualized.toFixed(2)}% |`).join('\n')}

当退出PE为50倍时，三年价格持平需要每股盈利年增长${valuationScenario(value.stress.entryPe, 50, 20, 3).breakEvenGrowth.toFixed(2)}%。这些计算说明估值收缩可能消耗增长带来的回报，不能据此确定未来价格。企业总利润增速不等于指数每股盈利增速；增发、成分调整、亏损样本和聚合算法都会影响实际结果。

## 冲突裁决与未解决的问题

${value.conflicts.map((c) => `**${c.title}** ${c.text} 来源：${links(c.refs)}。`).join('\n\n')}

核验中排除的数值：

${review.exclusions.map((e) => `- ${e}`).join('\n')}

## 可复核输入

原表单位、样本、财报页码、PDF字节哈希及计算输入保存在[本期结构化研究输入](./value-inputs.json)。美的原表为千元，转亿元除以100000；茅台原表为元，转亿元除以100000000。两份财报均核对了财务指标表及紧邻解释，避免只摘取增幅。

中证六份单张均标示8月31日；文件Last-Modified元数据为9月2日，正式公开日未单列，故publishedAt保留null。该元数据只用于辨认取得的文件版本，不冒充正式发布日期。单张URL可能随后更新，存档哈希用于辨认本次版本。易方达页面仅方法说明可读，实时数值未加载，未采用搜索摘要中的股息率。
`;
}
