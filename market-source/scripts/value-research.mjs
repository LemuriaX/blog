import { valuationScenario } from '../lib/value-math.ts';

export function verifyResearchCalculations(review) {
  const fact = (scope) => {
    const matches = review.financialFacts.filter(
      (f) => f.scope === scope && f.metric === '净利润',
    );
    if (
      matches.length !== 1 ||
      matches[0].unit !== '亿元' ||
      !Number.isFinite(matches[0].value)
    )
      throw Error('Missing or ambiguous profit input');
    return matches[0].value;
  };
  const dividend = review.valuation.benchmarks.find((b) => b.code === '000922');
  const broad = review.valuation.benchmarks.find((b) => b.code === '000300');
  const technology = review.valuation.benchmarks.find(
    (b) => b.code === '000688',
  );
  const weights = review.indexFacts?.find(
    (f) => f.code === '000922' && f.observedAt === review.valuation.observedAt,
  )?.sectorWeights;
  if (!weights) throw Error('Missing sector weight inputs');
  const scenario = review.calculations.find(
    (c) => c.name === '科创50三年估值情景',
  );
  const computed = [
    [
      '长鑫科技占整个科创板当期利润比例',
      (fact('长鑫科技') / fact('整个科创板')) * 100,
    ],
    ['中证红利能源与原材料权重', weights.energy + weights.materials],
    [
      '科创50三年估值情景',
      valuationScenario(
        technology.pe,
        scenario.exitPe,
        scenario.growth * 100,
        3,
      ).total / 100,
    ],
    [
      '红利股息率相对沪深300的差值',
      dividend.dividendYield - broad.dividendYield,
    ],
  ];
  return computed.map(([name, result]) => {
    const matches = review.calculations.filter((c) => c.name === name);
    if (
      matches.length !== 1 ||
      !Number.isFinite(result) ||
      Math.abs(matches[0].value - result) > 1e-9
    )
      throw Error(`Calculation mismatch: ${name}`);
    return { ...matches[0], value: result };
  });
}

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
  const verifiedCalculations = verifyResearchCalculations(review);
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

## 计算复核与文字判断

以下结果由原始输入重新计算，存储值不一致则停止生成。它们用于约束结论，不映射成确定性、安全垫或攻守分数。

| 计算 | 算式 | 复算值 | 解释边界 |
| --- | --- | ---: | --- |
${verifiedCalculations.map((c) => `| ${c.name} | ${c.formula} | ${c.value.toFixed(c.unit === '小数回报' ? 6 : 2)} ${c.unit} | ${c.limitation ?? '同日指数行业权重之和，不代表未来利润或分红占比。'} |`).join('\n')}

数据来源：${links(['PV-01', 'PV-02', 'PV-04', 'PV-07'])}。

网页的“确定性”描述盈利与现金流证据是否充分，“安全垫”描述价格是否已覆盖可识别风险。前者不等于成功概率，后者不等于账面折价或历史股息率；现有输入不足以计算它们的客观百分比。攻守是依据这些证据形成的文字决策，不从几项比例机械加权。

**${value.stance.label}。** ${value.stance.reason} 来源：${links(value.stance.refs)}。

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
