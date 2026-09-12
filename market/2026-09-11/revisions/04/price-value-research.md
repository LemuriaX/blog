# A股价格与价值核验 · 2026-09-11

本期修订专门核验价格、盈利和现金流之间的关系。信息截止日为2026-09-11，取数与复核在2026-09-13完成。没有将后来发布的信息补入本周判断。

## 比较基准与研究范围

统一估值观测日：2026-08-31。

统一比较8月31日中证官方单张；不是9月11日即时估值。PE为滚动市盈率，PB为市净率，股息率为历史分红口径。

官方指标按个股“计算用股本”计算。未取得同口径历史序列，不给历史分位；红利单张的PE、PB为空，保留缺失。不同指数的行业结构与盈利周期不同，不能只按倍数高低排序。

| 指数 | 代码 / 样本数 | PE（TTM） | PB | 历史股息率 | 直接来源 |
| --- | --- | ---: | ---: | ---: | --- |
| 沪深300 | 000300 / 300 | 14.65 | 1.44 | 2.27% | [中证指数：沪深3008月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000300factsheet.pdf) |
| 中证红利 | 000922 / 100 | — | — | 4.07% | [中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf) |
| 800工业 | 000930 / 196 | 20.07 | 1.71 | 1.81% | [中证指数：800工业8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000930factsheet.pdf) |
| 科创50 | 000688 / 50 | 79.82 | 8.18 | 0.26% | [中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf) |
| 800消费 | 000932 / 36 | 19.69 | 3.23 | 4.10% | [中证指数：800消费8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000932factsheet.pdf) |
| 800地产 | 399965 / 9 | 39.19 | 0.51 | 0.62% | [中证指数：800地产8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/399965factsheet.pdf) |

估值是价格参照，尚不是价值结论。本期以六份同日中证单张为横截面，以交易所半年报统计、公司原始报表、统计局行业数据检验盈利与现金流，再用不同提供商的股息率说明寻找口径冲突。它们覆盖不同问题，不能互相充当相同口径的独立复证。转载同一公告也不计为第二份独立证据。

未取得覆盖各指数的成分股自由现金流、一致预期及长期估值序列，因此研究只能形成有条件的判断。没有输出目标价、历史低估分位或统一的安全边际分数。

## 计算复核与文字判断

以下结果由原始输入重新计算，存储值不一致则停止生成。它们用于约束结论，不映射成确定性、安全垫或攻守分数。

| 计算 | 算式 | 复算值 | 解释边界 |
| --- | --- | ---: | --- |
| 长鑫科技占整个科创板当期利润比例 | 776 / 1448.87 * 100 | 53.56 % | 非新增利润贡献，非科创50成分股权重 |
| 中证红利能源与原材料权重 | 26.3 + 13.9 | 40.20 % | 同日指数行业权重之和，不代表未来利润或分红占比。 |
| 科创50三年估值情景 | (1 + g)^3 * exitPE / 79.82 - 1 | 0.082435 小数回报 | 每股盈利、固定篮子、不计分红税费与调样；非预测 |
| 红利股息率相对沪深300的差值 | 4.07 - 2.27 | 1.80 个百分点 | 同日历史股息率之差，不是安全边际、预期超额收益或无风险利差。 |

数据来源：[中证指数：沪深3008月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000300factsheet.pdf)、[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf)、[上交所：2026年半年报业绩综述](https://www.sse.com.cn/aboutus/mediacenter/hotandd/c/c_20260830_10830362.shtml)。

网页的“确定性”描述盈利与现金流证据是否充分，“安全垫”描述价格是否已覆盖可识别风险。前者不等于成功概率，后者不等于账面折价或历史股息率；现有输入不足以计算它们的客观百分比。攻守是依据这些证据形成的文字决策，不从几项比例机械加权。

**偏防守，留选择权。** 科技对盈利兑现的要求较高，红利与地产的安全边际仍待核实，新增资金宜放慢。外贸增长与优质信用利差收窄提供支撑，现有证据不足以支持全面退出。 来源：[中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf)、[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[中证指数：800地产8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/399965factsheet.pdf)、[央广网转引海关｜8月外贸](https://china.cnr.cn/news/20260909/t20260909_527808565.shtml)、[中债｜9月11日国债与AAA中票收益率](https://yield.chinabond.com.cn/cbweb-pbc-web/pbc/more?locale=cn_ZH)。

## 五类资产的支持证据与反证

### 制造与出口：盈利改善有依据，安全边际仍要落到公司

价格参照：800工业 PE 20.07倍 · 股息率1.81%。

**支持证据。** 上半年沪市制造业利润同比增长40.3%。美的经营现金流375.52亿元、同比增长0.73%，表明账面盈利之外仍有现金流入。 来源：[上交所：2026年半年报业绩综述](https://www.sse.com.cn/aboutus/mediacenter/hotandd/c/c_20260830_10830362.shtml)、[美的集团：2026年半年报摘要，第2页](https://static.cninfo.com.cn/finalpage/2026-08-29/1225531403.PDF)。

**最强反证。** 美的归母利润增长1.66%，扣非利润却下降25.31%；摘要说明汇兑损失与套期工具收益分列经常性、非经常性项目，不能把扣非降幅全当经营恶化。经营现金流也未扣资本开支。 来源：[美的集团：2026年半年报摘要，第2页](https://static.cninfo.com.cn/finalpage/2026-08-29/1225531403.PDF)。

**综合判断。** 20.07倍只提供价格参照，不能据此确认便宜。应把套期损益配对、资本开支与回款核清，再评价可分配现金。

**样本边界。** 800工业不是纯出口篮子；美的在中证行业分类中属可选消费，是公司反证案例，不是该指数盈利代表。

**后续可检验条件。** 下一次财报逐项对照应收、存货、套期损益与资本开支；只有经调整的现金创造能力跟上利润，才提高判断把握。

### 红利资产：现金回报有吸引力，不能把高息当保底

价格参照：中证红利 股息率4.07% · PE / PB缺失。

**支持证据。** 官方8月单张列示股息率4.07%，高于同日沪深300的2.27%；这是可核对的历史分红差异。 来源：[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[中证指数：沪深3008月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000300factsheet.pdf)。

**最强反证。** 能源与原材料权重合计40.2%，金融占24.2%；周期盈利与分红可能回落。另一平台9月11日给出4.91%，日期与算法未对齐，不能用它替换4.07%。 来源：[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[有知有行：中证红利数据（口径对照）](https://youzhiyouxing.cn/data/indices/000922.CSI)。

**综合判断。** 将红利作为逐家公司复核的候选，先查正常年份的分红覆盖、资本开支及负债；现有证据不足以断言整篮子低估。

**样本边界。** 指数股息率不是基金到手收益，也不是未来承诺；官方PE、PB缺失，本期不拼接其他平台数字。

**后续可检验条件。** 核对下一次分红公告及其现金来源，排除特殊分红和周期高点利润造成的高息错觉。

### 科技成长：高增长真实存在，价格对持续增长要求很高

价格参照：科创50 PE 79.82倍 · PB 8.18倍。

**支持证据。** 上交所披露整个科创板上半年净利润1448.87亿元，同比增长437.6%，支持产业盈利确有改善。 来源：[上交所：2026年半年报业绩综述](https://www.sse.com.cn/aboutus/mediacenter/hotandd/c/c_20260830_10830362.shtml)。

**最强反证。** 其中长鑫科技净利润776亿元，约占全板块当期利润53.6%；这是利润集中度，不是增长贡献。全科创板也不等于科创50，不能把437.6%直接当指数每股盈利增速。 来源：[上交所：2026年半年报业绩综述](https://www.sse.com.cn/aboutus/mediacenter/hotandd/c/c_20260830_10830362.shtml)、[中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf)。

**综合判断。** 估值需要多年每股盈利兑现来支撑。下方用盈利增长与估值收缩共同检验回报，不把高增长自动译成低风险。

**样本边界。** 缺同一组50只样本的可比扣非、现金流及一致预期，不能据全板块数据确定指数合理PE。

**后续可检验条件。** 下一次财报检查盈利是否扩散到更多成分股，以及每股盈利、回款能否同时增长。

### 主要消费：估值较成长温和，现金流质量需穿透核验

价格参照：800消费 PE 19.69倍 · 股息率4.10%。

**支持证据。** 同日官方股息率为4.10%。1—7月限额以上粮油食品零售额同比增长7.2%，说明消费细分需求并非同步走弱。 来源：[中证指数：800消费8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000932factsheet.pdf)、[国家统计局｜7月零售 · 08.17发布](https://www.stats.gov.cn/sj/zxfbhjd/202608/t20260817_1965052.html)。

**最强反证。** 茅台上半年归母利润下降1.95%，经营现金流却增长438.84%；报告解释后者主要来自财务子公司成员存款及受限同业存款变动，不能视为白酒回款同幅增长。 来源：[贵州茅台：2026年半年报，第5页](https://static.cninfo.com.cn/finalpage/2026-08-15/1225475868.PDF)。

**综合判断。** 可以继续筛选品牌和现金流，但不能把19.69倍或一次现金流跳升当作价值修复已完成的证据。

**样本边界。** 800消费是主要消费样本；零售统计、单一酒企和整个指数口径不同，均不能互相代替。

**后续可检验条件。** 后续拆分主营销售回款与财务子公司资金，观察库存、渠道及利润变化，确认历史股息能否延续。

### 地产：低PB尚不足以证明净资产折价可靠

价格参照：800地产 PB 0.51倍 · PE 39.19倍。

**支持证据。** 0.51倍PB反映市场给账面净资产较大折扣；7月末全国商品房待售面积同比下降0.8%，库存有小幅改善迹象。 来源：[中证指数：800地产8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/399965factsheet.pdf)、[国家统计局：1—7月房地产开发投资](https://www.stats.gov.cn/zwfwck/sjfb/202608/t20260817_1965053.html)。

**最强反证。** 1—7月全国新建商品房销售额下降13.1%，开发企业到位资金下降20.3%。低PB同时伴随39.19倍PE和0.62%历史股息率，现金兑现尚弱。 来源：[国家统计局：1—7月房地产开发投资](https://www.stats.gov.cn/zwfwck/sjfb/202608/t20260817_1965053.html)、[中证指数：800地产8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/399965factsheet.pdf)。

**综合判断。** 暂不将行业低PB解释为普遍安全边际。要先核验资产减值、受限现金和债务到期，再判断折价是否覆盖潜在损失。

**样本边界。** 指数仅9只股票，全国开发企业统计只能提示行业压力，不能直接替代这9家公司的资产负债表。

**后续可检验条件。** 后续同口径销售回款、融资和资产减值能否共同改善；单月销售回升不足以确认账面资产可兑现。

## 估值压力测试：增长与退出价格必须同时成立

以科创50的79.82倍PE为起点。以下每股盈利增速和三年后PE均为假设，不是预测或一致预期。来源：[中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf)。

在固定篮子、忽略分红税费和调样的条件下：

- 三年价格倍数 = (1 + 每股盈利年增速)³ × 退出PE ÷ 起始PE。
- 年化价格回报 = 三年价格倍数的三次方根 − 1。
- 盈亏平衡年增速 = (起始PE ÷ 退出PE)的三次方根 − 1。

| 假设每股盈利年增速 | 假设退出PE | 三年价格回报 | 年化价格回报 |
| ---: | ---: | ---: | ---: |
| 10% | 40倍 | -33.30% | -12.63% |
| 20% | 50倍 | 8.24% | 2.68% |
| 30% | 60倍 | 65.15% | 18.20% |

当退出PE为50倍时，三年价格持平需要每股盈利年增长16.87%。这些计算说明估值收缩可能消耗增长带来的回报，不能据此确定未来价格。企业总利润增速不等于指数每股盈利增速；增发、成分调整、亏损样本和聚合算法都会影响实际结果。

## 冲突裁决与未解决的问题

**红利股息率为什么不取平均？** 中证8月31日为4.07%，有知有行9月11日为4.91%。日期差异未剥离，算法也未完成对齐。易方达说明的整体法使用含限售股的A股总市值，与中证“计算用股本”口径不同。本期采用统一日期的官方表，其余只作为冲突线索，不判定某个平台错误。 来源：[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[有知有行：中证红利数据（口径对照）](https://youzhiyouxing.cn/data/indices/000922.CSI)、[易方达：股息率整体法说明](https://cdn.efunds.com.cn/eda/h5/itcenter/pd/indexYield/indexCal.html?isSite=1&tstamp=2025110605)。

**本期仍不能回答什么？** 缺9月11日同口径完整估值表、长期估值序列、所有成分股的可比自由现金流及一致预期。因此不给历史低估分位、目标价或统一安全边际分数。 来源：[中证指数：沪深3008月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000300factsheet.pdf)、[中证指数：中证红利8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000922factsheet.pdf)、[中证指数：800工业8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000930factsheet.pdf)、[中证指数：科创508月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000688factsheet.pdf)、[中证指数：800消费8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/000932factsheet.pdf)、[中证指数：800地产8月单张](https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/indices/detail/files/zh_CN/399965factsheet.pdf)。

核验中排除的数值：

- 中证红利官方PE/PB为--：保留null，不用第三方PE补齐。
- 易方达动态数值未加载，零占位与搜索摘要4.2%均未采用；只引用页面可读的方法说明。
- 第三方估值页存在整体法、等权及剔除负值等口径，未取得同日可重复匹配样本；不纳入统一估值表。
- 未取得可比长期序列，不发布历史分位；未将上半年利润增速直接用作未来EPS增速。
- 本次修订仍以9月11日为截止，不加入后来发布的8月地产或零售数据。

## 可复核输入

原表单位、样本、财报页码、PDF字节哈希及计算输入保存在[本期结构化研究输入](./value-inputs.json)。美的原表为千元，转亿元除以100000；茅台原表为元，转亿元除以100000000。两份财报均核对了财务指标表及紧邻解释，避免只摘取增幅。

中证六份单张均标示8月31日；文件Last-Modified元数据为9月2日，正式公开日未单列，故publishedAt保留null。该元数据只用于辨认取得的文件版本，不冒充正式发布日期。单张URL可能随后更新，存档哈希用于辨认本次版本。易方达页面仅方法说明可读，实时数值未加载，未采用搜索摘要中的股息率。
