// Strings for /tools/sharpe-ratio-calculator/.
// `ui` is handed to src/scripts/sharpe-calculator.ts as JSON, so it holds
// templates only. Every number is filled in from the inputs or the calc
// library. The source of the standard error formula is Lo (2002); the
// citation is in `formula.source` and was checked against the paper.
import { defineStrings } from './strings';

export const sharpe = defineStrings({
  en: {
    title: 'Sharpe ratio calculator',
    description:
      'Paste a list of returns and get the mean, sample standard deviation, the Sharpe ratio per period and annualised, with its standard error, 95% interval and t statistic.',
    lede: 'The Sharpe ratio of a series of returns, annualised, and how much of it could be sampling noise.',
    noscript:
      'The calculator needs JavaScript. What you see is the first worked example; the formula and examples below can be done on paper.',
    exampleNote: 'The list the calculator opens with is an example: twelve invented monthly returns, not the record of any account or strategy.',
    fields: {
      returns: 'Returns per period, in percent',
      returnsHint: 'Separate them with commas, spaces or line breaks. 1.5 means +1.5% and -2 means −2%. Use a point for decimals.',
      riskFree: 'Risk-free rate per period',
      riskFreeHint: 'For the same period as the returns. Leave it at 0 to compare against nothing.',
      periods: 'Periods per year',
      periodsUnit: 'a year',
      periodsHint: 'Daily returns: 365 for crypto, 252 for stocks. Weekly: 52. Monthly: 12.',
    },
    ui: {
      distinct:
        '{n} returns give a Sharpe ratio of {sr} per period, which is {annual} annualised (× √{periods}). The 95% interval runs from {low} to {high} and does not include 0.',
      notDistinct:
        '{n} returns give a Sharpe ratio of {sr} per period, which is {annual} annualised (× √{periods}). The 95% interval runs from {low} to {high} and includes 0: this record cannot tell this Sharpe ratio from zero.',
      small:
        'Only {n} returns, fewer than {min}. The standard error is a large-sample formula; with this few returns the real uncertainty is larger than shown.',
      range: '{low} to {high}',
      axisIn:
        'A linear axis from {min} to {max}. The annualised Sharpe ratio is {annual}. Its 95% interval runs from {low} to {high}, which includes 0.',
      axisOut:
        'A linear axis from {min} to {max}. The annualised Sharpe ratio is {annual}. Its 95% interval runs from {low} to {high}, which does not include 0.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        tooFew: 'Enter at least two returns. A sample standard deviation needs two.',
        tooMany: 'This calculator takes at most {max} returns, and the list has {n}.',
        rejected: 'Not read as a number: {tokens}. Enter percentages such as 1.5 or -2, separated by commas, spaces or line breaks.',
        flat: 'Every return is the same, so the standard deviation is 0 and the Sharpe ratio is not defined. Enter returns that vary.',
        riskFreeRate: 'Enter a risk-free rate per period between −100% and 100%. Use 0 to leave it out.',
        periodsPerYear: 'Enter how many periods make a year, above 0: for example 365, 252, 52 or 12.',
      },
    },
    result: {
      label: 'Annualised Sharpe ratio',
      caption: 'The rest of the result',
      count: 'Number of returns',
      mean: 'Mean return per period',
      deviation: 'Standard deviation per period (sample, n − 1)',
      sharpe: 'Sharpe ratio per period',
      factor: 'Annualisation factor, √periods',
      se: 'Standard error of the annualised ratio',
      interval: '95% interval, annualised',
      t: 't statistic',
      axis: 'Annualised Sharpe ratio and its 95% interval',
      band: '95% interval',
      point: 'Estimate',
      zero: 'Zero',
    },
    assumptions: [
      'Returns are treated as independent and identically distributed. Serial correlation changes both the annualised figure and its error.',
      'The standard deviation is the sample one: the squared distances from the mean are divided by n − 1.',
      'The risk-free rate is constant, and it is per period.',
      'The standard error and the interval are large-sample approximations (Lo, 2002).',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro: 'The Sharpe ratio is the mean return above the risk-free rate, divided by how much the returns vary.',
      lines: [
        'mean = sum of returns ÷ n',
        'standard deviation = √( sum of (return − mean)² ÷ (n − 1) )',
        'Sharpe ratio per period = (mean − risk-free rate) ÷ standard deviation',
        'annualised Sharpe ratio = Sharpe ratio per period × √(periods per year)',
      ],
      terms: [
        { term: 'n', text: 'The number of returns in the list.' },
        {
          term: 'Standard deviation',
          text: 'The sample version, which divides by n − 1 instead of n because the mean was estimated from the same returns. With twelve returns the two versions differ by about {gap}.',
        },
        {
          term: 'Risk-free rate',
          text: 'What the money would have earned per period without risk. It is subtracted from the mean, and it has to be for the same period as the returns.',
        },
        {
          term: 'Periods per year',
          text: 'How many of your periods make a year: 365 for daily returns of a market that trades every day, 252 for daily stock returns, 52 for weekly, 12 for monthly.',
        },
      ],
      annualHead: 'What the square root assumes',
      annual:
        'Multiplying by the square root of the number of periods assumes the returns are independent: the mean then grows with the number of periods and the deviation with its square root. Lo (2002) shows that the rule is correct only in that case. When one period’s return says something about the next, the true annual figure is different; in his sample of hedge funds, serial correlation in monthly returns overstated the annual Sharpe ratio by as much as 65%.',
      errorHead: 'How much of it is noise',
      errorIntro:
        'A Sharpe ratio worked out from a sample is an estimate, and it comes with a sampling error. For independent returns its standard error, in large samples, is:',
      errorLines: [
        'standard error = √( (1 + Sharpe ratio² ÷ 2) ÷ n )',
        '95% interval = Sharpe ratio ± 1.96 × standard error',
        't statistic = Sharpe ratio per period × √n',
      ],
      errorNote:
        'These are per-period figures; the annualised ratio and its standard error are both multiplied by √(periods per year). If the interval includes 0, the record is too short or too noisy to tell this Sharpe ratio from none at all. The t statistic is the usual test of whether the mean excess return is zero; below about 2 it does not pass at the 5% level.',
      years:
        'One consequence: t = annualised Sharpe ratio × √(years of data). An annualised Sharpe ratio of 1 needs about four years of returns before t reaches 2. A ratio of 2 needs about one year.',
      source:
        'Source: Andrew W. Lo, “The Statistics of Sharpe Ratios”, Financial Analysts Journal 58(4), July/August 2002, pp. 36–52. The standard error is its equation 9, the interval its equation 10.',
      sourceLink: 'doi.org/10.2469/faj.v58.n4.2453',
      leftOut:
        'What this leaves out: serial correlation, skew and fat tails (a strategy that collects small gains and takes a rare large loss can show a high Sharpe ratio for years), the gap between backtested and traded returns, and how many strategies were tried before this one. A high Sharpe ratio on a short record is not evidence about the next period.',
    },
    examples: {
      first: 'Example 1: twelve monthly returns',
      second: 'Example 2: five weekly returns and a risk-free rate',
      setup: 'Returns in percent: {list}. Risk-free rate {rf} per period, {periods} periods a year.',
      workMean: 'mean = {sum} ÷ {n} = {mean}',
      workSquares: 'sum of (return − mean)² = {squares}',
      workDeviation: 'standard deviation = √({squares} ÷ {nm1}) = {sd}',
      workSharpe: 'Sharpe ratio per period = ({mean} − {rf}) ÷ {sd} = {sr}',
      workAnnual: 'annualised = {sr} × √{periods} = {annual}',
      workError: 'standard error = √((1 + {sr}² ÷ 2) ÷ {n}) = {se}; annualised, {seAnnual}',
      workInterval: '95% interval = {annual} ± 1.96 × {seAnnual} = {low} to {high}',
      workT: 't = {sr} × √{n} = {t}',
      result:
        'The annualised Sharpe ratio is {annual}, and its 95% interval runs from {low} to {high}. The interval includes 0: {n} returns cannot tell this ratio from zero. The t statistic is {t}.',
      rounding:
        'The steps show intermediate values rounded to four decimals. The calculator carries full precision, so working from the rounded steps can differ in the last digit.',
    },
    mistakes: [
      {
        title: 'Annualising with the wrong number of periods',
        text: 'The factor is the square root of how many of your periods make a year. Daily crypto returns use 365, because the market trades every day. Using 252 makes the annual figure {gapDays} smaller.',
      },
      {
        title: 'Mixing periods',
        text: 'The returns, the risk-free rate and the periods per year have to describe the same period. A risk-free rate of {rfYear} a year is {rfDay} a day with 365 periods, not {rfYear}.',
      },
      {
        title: 'Trusting a short record',
        text: 'In example 1 the annualised ratio is {annual} and its 95% interval runs from {low} to {high}. A record that short is compatible with a losing strategy and with an excellent one.',
      },
      {
        title: 'Dividing by n instead of n − 1',
        text: 'Tools differ. In a spreadsheet STDEV.S divides by n − 1 and STDEV.P by n; NumPy’s std divides by n unless you pass ddof=1. With the returns of example 1 the n version gives {sdPop} instead of {sd}, and a Sharpe ratio per period of {srPop} instead of {sr}.',
      },
      {
        title: 'Reading the ratio as a forecast',
        text: 'The Sharpe ratio describes the returns you pasted. It says nothing about returns that have not happened, and it cannot see a risk that has not shown up in the sample yet, such as a liquidation.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '夏普值計算機',
    description:
      '貼上一串報酬率，算出平均報酬、樣本標準差、每期夏普值與年化夏普值，並附上標準誤、95% 區間和 t 值，讓你知道這段紀錄夠不夠長、能不能下結論。',
    lede: '一串報酬率的夏普值與年化夏普值，以及這個數字有多少可能只是抽樣的雜訊。',
    noscript: '這個計算機需要 JavaScript。現在看到的是第一個例題；下方的公式和例題可以自己用紙筆算。',
    exampleNote: '計算機一開始帶入的是例子：十二個虛構的月報酬率，不是任何帳戶或策略的紀錄。',
    fields: {
      returns: '每期報酬率（%）',
      returnsHint: '用逗號、空白或換行分隔。1.5 代表 +1.5%，-2 代表 −2%。小數請用小數點。',
      riskFree: '每期的無風險利率',
      riskFreeHint: '期間要和報酬率一樣。不想比較的話就留 0。',
      periods: '每年期數',
      periodsUnit: '期',
      periodsHint: '日報酬：加密貨幣用 365，股票用 252。週報酬 52，月報酬 12。',
    },
    ui: {
      distinct:
        '{n} 筆報酬算出來，每期夏普值是 {sr}，年化（× √{periods}）是 {annual}。95% 區間從 {low} 到 {high}，不包含 0。',
      notDistinct:
        '{n} 筆報酬算出來，每期夏普值是 {sr}，年化（× √{periods}）是 {annual}。95% 區間從 {low} 到 {high}，包含 0：這段紀錄還分不出這個夏普值和 0 的差別。',
      small: '只有 {n} 筆報酬，少於 {min} 筆。標準誤是大樣本公式，筆數這麼少的時候，實際的不確定性比這裡顯示的還大。',
      range: '{low} 到 {high}',
      axisIn: '一條從 {min} 到 {max} 的線性座標軸。年化夏普值是 {annual}，95% 區間從 {low} 到 {high}，包含 0。',
      axisOut: '一條從 {min} 到 {max} 的線性座標軸。年化夏普值是 {annual}，95% 區間從 {low} 到 {high}，不包含 0。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        tooFew: '至少要輸入兩筆報酬，樣本標準差需要兩筆才算得出來。',
        tooMany: '這個計算機最多接受 {max} 筆報酬，現在有 {n} 筆。',
        rejected: '這些讀不出數字：{tokens}。請輸入 1.5、-2 這樣的百分比，用逗號、空白或換行分隔。',
        flat: '每一筆報酬都一樣，標準差是 0，夏普值沒有定義。請輸入有變化的報酬。',
        riskFreeRate: '每期的無風險利率要在 −100% 到 100% 之間。不計的話請填 0。',
        periodsPerYear: '請輸入一年有幾期，要大於 0，例如 365、252、52 或 12。',
      },
    },
    result: {
      label: '年化夏普值',
      caption: '其他結果',
      count: '報酬筆數',
      mean: '每期平均報酬',
      deviation: '每期標準差（樣本，n − 1）',
      sharpe: '每期夏普值',
      factor: '年化倍數（√期數）',
      se: '年化夏普值的標準誤',
      interval: '95% 區間（年化）',
      t: 't 值',
      axis: '年化夏普值與它的 95% 區間',
      band: '95% 區間',
      point: '估計值',
      zero: '零',
    },
    assumptions: [
      '假設每一期的報酬彼此獨立、來自同一個分配。報酬如果有序列相關，年化後的數字和它的誤差都會不一樣。',
      '標準差用的是樣本標準差：離均差平方和除以 n − 1。',
      '無風險利率是固定的，而且是每期的利率。',
      '標準誤和區間是大樣本近似（Lo，2002）。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '夏普值是平均報酬減掉無風險利率之後，再除以報酬的波動程度。',
      lines: [
        '平均報酬 = 各期報酬的總和 ÷ n',
        '標準差 = √( (各期報酬 − 平均報酬)² 的總和 ÷ (n − 1) )',
        '每期夏普值 = (平均報酬 − 無風險利率) ÷ 標準差',
        '年化夏普值 = 每期夏普值 × √(每年期數)',
      ],
      terms: [
        { term: 'n', text: '這串報酬一共有幾筆。' },
        {
          term: '標準差',
          text: '這裡用樣本標準差，除以 n − 1 而不是 n，因為平均報酬也是從同一串報酬估出來的。只有十二筆的時候，兩種算法大約差 {gap}。',
        },
        { term: '無風險利率', text: '同一段期間，不承擔風險也拿得到的報酬。它會從平均報酬裡扣掉，期間必須和報酬率一致。' },
        { term: '每年期數', text: '一年裡有幾個這樣的期間：天天都有交易的市場，日報酬用 365；股票的日報酬用 252；週報酬 52；月報酬 12。' },
      ],
      annualHead: '乘上根號，背後假設了什麼',
      annual:
        '乘以期數的平方根，前提是各期報酬彼此獨立：這時平均報酬隨期數等比例放大，標準差則隨期數的平方根放大。Lo（2002）證明這個換算只有在這個前提下才正確。如果這一期的報酬和下一期有關聯，真正的年化數字就不是這樣；在他研究的避險基金樣本裡，月報酬的序列相關讓年化夏普值最多被高估 65%。',
      errorHead: '這個數字有多少是雜訊',
      errorIntro: '從樣本算出來的夏普值只是估計值，本身有抽樣誤差。報酬彼此獨立時，它在大樣本下的標準誤是：',
      errorLines: ['標準誤 = √( (1 + 夏普值² ÷ 2) ÷ n )', '95% 區間 = 夏普值 ± 1.96 × 標準誤', 't 值 = 每期夏普值 × √n'],
      errorNote:
        '這幾條算的是每期的數字；年化夏普值和它的標準誤都要再乘上 √(每年期數)。區間如果包含 0，代表這段紀錄太短或雜訊太大，還分不出這個夏普值和「完全沒有」的差別。t 值就是檢定「平均超額報酬是不是 0」的那個統計量，大約低於 2 的時候，在 5% 的顯著水準下過不了關。',
      years: '由此可以推出：t 值 = 年化夏普值 × √(資料的年數)。年化夏普值 1，大約要四年的報酬資料 t 值才會到 2；年化夏普值 2，大約要一年。',
      source:
        '出處：Andrew W. Lo，〈The Statistics of Sharpe Ratios〉，Financial Analysts Journal 第 58 卷第 4 期（2002 年 7、8 月號），第 36 到 52 頁。標準誤是該文的式 9，區間是式 10。',
      sourceLink: 'doi.org/10.2469/faj.v58.n4.2453',
      leftOut:
        '這裡沒有算進去的：序列相關、偏態與厚尾（平常小賺、偶爾大賠的策略，可以連續好幾年都有很高的夏普值）、回測報酬和實際交易報酬的落差，以及在這個策略之前試過多少個策略。紀錄很短的時候，夏普值再高也不能說明下一期會怎樣。',
    },
    examples: {
      first: '例題 1：十二個月報酬',
      second: '例題 2：五個週報酬，加上無風險利率',
      setup: '報酬率（%）：{list}。每期無風險利率 {rf}，每年 {periods} 期。',
      workMean: '平均報酬 = {sum} ÷ {n} = {mean}',
      workSquares: '(各期報酬 − 平均報酬)² 的總和 = {squares}',
      workDeviation: '標準差 = √({squares} ÷ {nm1}) = {sd}',
      workSharpe: '每期夏普值 = ({mean} − {rf}) ÷ {sd} = {sr}',
      workAnnual: '年化夏普值 = {sr} × √{periods} = {annual}',
      workError: '標準誤 = √((1 + {sr}² ÷ 2) ÷ {n}) = {se}；年化之後是 {seAnnual}',
      workInterval: '95% 區間 = {annual} ± 1.96 × {seAnnual} = {low} 到 {high}',
      workT: 't 值 = {sr} × √{n} = {t}',
      result: '年化夏普值是 {annual}，95% 區間從 {low} 到 {high}。區間包含 0：{n} 筆報酬還分不出這個夏普值和 0 的差別。t 值是 {t}。',
      rounding: '例題裡的中間數字只顯示到小數第四位，計算機內部用的是完整精度，所以照著這些數字手算，最後一位可能會差 1。',
    },
    mistakes: [
      {
        title: '年化時用錯期數',
        text: '年化倍數是「一年有幾期」的平方根。加密貨幣天天都有交易，日報酬要用 365。如果用了 252，年化後的數字會少 {gapDays}。',
      },
      {
        title: '期間沒有對齊',
        text: '報酬率、無風險利率和每年期數，講的必須是同一種期間。年利率 {rfYear} 的無風險利率，換成每年 365 期是每天 {rfDay}，不是 {rfYear}。',
      },
      {
        title: '相信很短的紀錄',
        text: '例題 1 的年化夏普值是 {annual}，95% 區間卻是從 {low} 到 {high}。這麼短的紀錄，說它是賠錢的策略說得通，說它是很好的策略也說得通。',
      },
      {
        title: '標準差除以 n 而不是 n − 1',
        text: '每個工具的算法不一樣。試算表的 STDEV.S 除以 n − 1，STDEV.P 除以 n；NumPy 的 std 除以 n，要傳 ddof=1 才會除以 n − 1。用例題 1 的報酬，除以 n 算出來的標準差是 {sdPop} 而不是 {sd}，每期夏普值是 {srPop} 而不是 {sr}。',
      },
      {
        title: '把夏普值當成預測',
        text: '夏普值描述的是你貼上的這些報酬。它沒有說還沒發生的報酬會怎樣，也看不到樣本裡還沒出現過的風險，例如爆倉。',
      },
    ],
    allTools: '所有計算機',
  },
});
