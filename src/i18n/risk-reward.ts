// Strings for /tools/risk-reward-calculator/.
// `ui` is handed to src/scripts/risk-reward-calculator.ts as JSON, so it
// holds templates only. Every figure is filled in from the inputs, computed
// with src/lib/calc/risk-reward.ts on the page, or is the default fee rate
// ({fee}), which the page passes in and the reader can change.
import { defineStrings } from './strings';

export const riskReward = defineStrings({
  en: {
    title: 'Risk reward calculator',
    description:
      'Risk reward calculator: turn entry, stop and target prices into an R multiple and the win rate that breaks even, before and after trading fees.',
    lede: 'The reward as a multiple of the risk, and the win rate at which trades like this break even once the fees are paid.',
    noscript:
      'The calculator needs JavaScript. What you see is worked example 1; the formulas and the examples below can be done on paper.',
    fields: {
      entry: 'Entry price',
      stop: 'Stop price',
      stopHint: 'Below the entry for a long, above it for a short.',
      target: 'Target price',
      targetHint: 'On the other side of the entry from the stop.',
      fee: 'Fee rate per side',
      feeHint: 'The default of {fee} (taker) is an assumption. Check Bybit’s fee table for your rate.',
    },
    ui: {
      riskBar: 'Risk: entry to stop',
      rewardBar: 'Reward: entry to target',
      barLabel:
        'Two bars on one scale, where the full width is {max} of the entry price. Risk, from the entry to the stop: {risk}. Reward, from the entry to the target: {reward}.',
      figure: '{ratio}R',
      long: 'Long. You risk {risk} USDT per unit to make {reward}, a risk to reward of 1:{ratio}. Trades like this break even at a win rate of {be} before fees and {beNet} after fees of {fee} per side.',
      short:
        'Short. You risk {risk} USDT per unit to make {reward}, a risk to reward of 1:{ratio}. Trades like this break even at a win rate of {be} before fees and {beNet} after fees of {fee} per side.',
      unpaid:
        'The target is {ratio} times the risk before fees. After fees of {fee} per side a trade that reaches the target still loses {loss} USDT per unit, so no win rate breaks even.',
      usdt: '{value} USDT',
      priceShare: '{value} USDT ({pct})',
      none: 'None',
      beMeter: 'Break-even win rate after fees: {be} of the trades have to reach the target.',
      beMeterNone: 'After fees no win rate breaks even.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        entryPrice: 'Enter an entry price above 0.',
        stopPrice: 'Enter a stop price above 0 that is different from the entry price.',
        targetPrice: 'Enter a target price above 0 that is different from the entry price.',
        sameSide:
          'The target has to be on the other side of the entry from the stop: above the entry for a long, below it for a short.',
        feeRate: 'Enter a fee rate of 0% or more and below 100%.',
      },
    },
    result: {
      label: 'Reward as a multiple of the risk',
      caption: 'Risk, reward and break-even win rates',
      risk: 'Risk per unit, entry to stop',
      reward: 'Reward per unit, entry to target',
      be: 'Break-even win rate before fees',
      beNet: 'Break-even win rate after fees',
      ratioNet: 'Reward as a multiple of the risk, after fees',
      feeStop: 'Fees in and out if stopped, per unit',
      feeTarget: 'Fees in and out at the target, per unit',
      meterEnd: 'Every trade wins',
    },
    // Shown in the result panel. {fee} is the page's assumed rate.
    assumptions: [
      'Amounts are per one unit of the coin, 1 BTC on BTCUSDT. Position size multiplies the risk, the reward and the fees alike, so the ratios do not depend on it.',
      'The stop and the target fill at their prices. A stop that fills beyond its price makes the risk larger and the ratio smaller.',
      'The fee rate starts at an assumed taker rate of {fee} per side, charged on the traded value going in and coming out. Change it under Advanced settings. Funding is not counted.',
      'The break-even win rate says how often trades like this have to reach the target. It says nothing about how often they will.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'Three prices define the trade. The distance from the entry to the stop is what you risk, and the distance from the entry to the target is what you stand to make. Their ratio is the reward in multiples of the risk, written R:',
      lines: [
        'risk = |entry price − stop price|',
        'reward = |target price − entry price|',
        'R = reward ÷ risk',
        'break-even win rate = 1 ÷ (1 + R)',
      ],
      why: 'The last line answers the question of when the wins pay for the losses. Over many trades with a win rate w, the wins bring in w × R and the losses cost (1 − w) × 1, both in units of the risk. The two are equal when w = 1 ÷ (1 + R).',
      tableCaption: 'Every row is computed with the last formula, before fees.',
      tableRatio: 'Reward as a multiple of the risk',
      tableBe: 'Break-even win rate',
      ratio: '{ratio}R',
      feeIntro:
        'Fees are charged on the traded value when the position is opened and again when it is closed. They make every loss larger and every win smaller, so the win rate needed goes up:',
      feeLines: [
        'fees if stopped = (entry price + stop price) × fee rate',
        'fees at the target = (entry price + target price) × fee rate',
        'net risk = risk + fees if stopped',
        'net reward = reward − fees at the target',
        'break-even win rate after fees = net risk ÷ (net risk + net reward)',
      ],
      feeNote:
        'The fees follow the price, not the distance to the stop. Against a small risk they are a large share, so the closer the stop, the more they move the result. Example 2 is such a case.',
      terms: [
        {
          term: 'R',
          text: 'The reward divided by the risk. A target 2.5 times as far from the entry as the stop is 2.5R, often written as a risk to reward of 1:2.5.',
        },
        {
          term: 'Break-even win rate',
          text: 'The share of trades that has to reach the target for the wins to pay for the losses. Above it the expected result is positive, below it negative.',
        },
        {
          term: 'Fee rate per side',
          text: 'Charged on the traded value when you open and again when you close. The default of {fee} per side is an assumption for taker orders; Bybit’s fee table shows the rate for your account.',
        },
      ],
      sources:
        'Where the formulas come from: the ratio is a definition, and the break-even win rate is the one line of algebra shown above, so there is no paper to cite. The fee lines use the same convention and the same assumed rate as the position size calculator on this site.',
      leftOut:
        'How often the target is reached. A far target makes the ratio larger and is reached less often, so the ratio alone cannot tell a good trade from a bad one. Also left out: funding paid or received while the position is open, slippage on the stop, partial exits, and a stop that is moved after the entry.',
    },
    examples: {
      first: 'Example 1: a long with a target at {ratio}R',
      second: 'Example 2: a short with a stop {riskPct} away',
      setupLong: 'Long. Entry {entry}, stop {stop}, target {target}, fee rate {fee} per side.',
      setupShort: 'Short. Entry {entry}, stop {stop}, target {target}, fee rate {fee} per side.',
      workRisk: 'risk = |{entry} − {stop}| = {risk} USDT per unit',
      workReward: 'reward = |{target} − {entry}| = {reward} USDT per unit',
      workRatio: 'R = {reward} ÷ {risk} = {ratio}',
      workBe: 'break-even win rate = 1 ÷ (1 + {ratio}) = {be}',
      workFeeStop: 'fees if stopped = ({entry} + {stop}) × {fee} = {feeStop} USDT',
      workFeeTarget: 'fees at the target = ({entry} + {target}) × {fee} = {feeTarget} USDT',
      workNet: 'net risk = {netRisk} USDT, net reward = {netReward} USDT',
      workBeNet: 'break-even win rate after fees = {netRisk} ÷ ({netRisk} + {netReward}) = {beNet}',
      result:
        'The target is {ratio} times the risk. Before fees, trades like this break even when {be} of them reach the target. After fees it takes {beNet}.',
      resultTight:
        'The stop is only {riskPct} from the entry, so the fees of {feeStop} USDT on a stopped trade are {feeShare} of the {risk} USDT at risk. The break-even win rate goes from {be} to {beNet}.',
    },
    mistakes: [
      {
        title: 'Judging a trade by the ratio alone',
        text: 'A risk to reward of 1:{ratio} says what the trade pays if the target is reached, and nothing about how often that happens. Example 1 breaks even at a win rate of {beNet} after fees. Whether your trades reach their targets that often is a separate question.',
      },
      {
        title: 'Leaving out the fees on a tight stop',
        text: 'In example 2 the fees are {feeShare2} of the risk and move the break-even win rate from {be2} to {beNet2}. In example 1, with the stop {riskPct} away, the same fee rate moves it from {be} to {beNet}.',
      },
      {
        title: 'Stretching the target to improve the ratio',
        text: 'Moving the target of example 1 from {target} to {targetFar} raises the ratio from {ratio}R to {ratioFar}R. The price then has to travel {rewardPctFar} instead of {rewardPct} before it touches the stop.',
      },
      {
        title: 'Taking the break-even win rate for a goal',
        text: 'At the break-even win rate the expected result is zero. The win rate has to be above {beNet} for the expectation to be positive, and a run of trades with a positive expectation still has losing streaks and drawdowns.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '風險報酬比計算機',
    description:
      '輸入進場價、停損價和目標價，算出這筆單的報酬是風險的幾倍（R 倍數），以及勝率要多少才不賠。同時列出扣掉來回手續費前後的損益兩平勝率。',
    lede: '這筆單的報酬是風險的幾倍，扣掉手續費之後，勝率要多少才不賠。',
    noscript: '這個計算機需要 JavaScript。現在看到的是例題 1 的結果；下方的公式和例題可以自己用紙筆算。',
    fields: {
      entry: '進場價',
      stop: '停損價',
      stopHint: '做多填在進場價下方，做空填在上方。',
      target: '目標價',
      targetHint: '要和停損價分別在進場價的兩邊。',
      fee: '單邊手續費率',
      feeHint: '預設的 {fee}（吃單）是假設值，請到 Bybit 的費率表查你自己的費率。',
    },
    ui: {
      riskBar: '風險：進場到停損',
      rewardBar: '報酬：進場到目標',
      barLabel: '同一個比例尺上的兩條橫條，整條代表進場價的 {max}。風險（進場到停損）{risk}，報酬（進場到目標）{reward}。',
      figure: '{ratio}R',
      long: '做多。每單位冒 {risk} USDT 的風險去賺 {reward} USDT，風險報酬比是 1:{ratio}。這樣的交易，不計手續費時勝率要 {be} 才不賠；算進單邊 {fee} 的手續費之後要 {beNet}。',
      short:
        '做空。每單位冒 {risk} USDT 的風險去賺 {reward} USDT，風險報酬比是 1:{ratio}。這樣的交易，不計手續費時勝率要 {be} 才不賠；算進單邊 {fee} 的手續費之後要 {beNet}。',
      unpaid:
        '不計手續費時，目標是風險的 {ratio} 倍。算進單邊 {fee} 的手續費之後，就算價格走到目標，每單位還是賠 {loss} USDT，所以勝率再高都不會打平。',
      usdt: '{value} USDT',
      priceShare: '{value} USDT ({pct})',
      none: '沒有',
      beMeter: '扣手續費後的損益兩平勝率：{be} 的交易要走到目標價。',
      beMeterNone: '扣掉手續費之後，沒有任何勝率可以打平。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        entryPrice: '進場價要大於 0。',
        stopPrice: '停損價要大於 0，而且不能等於進場價。',
        targetPrice: '目標價要大於 0，而且不能等於進場價。',
        sameSide: '目標價要和停損價分別在進場價的兩邊：做多時高於進場價，做空時低於進場價。',
        feeRate: '手續費率要在 0% 以上、小於 100%。',
      },
    },
    result: {
      label: '報酬是風險的幾倍',
      caption: '風險、報酬與損益兩平勝率',
      risk: '每單位風險（進場到停損）',
      reward: '每單位報酬（進場到目標）',
      be: '損益兩平勝率（不計手續費）',
      beNet: '損益兩平勝率（扣手續費後）',
      ratioNet: '扣手續費後，報酬是風險的幾倍',
      feeStop: '停損出場的來回手續費（每單位）',
      feeTarget: '目標價出場的來回手續費（每單位）',
      meterEnd: '每一筆都獲利',
    },
    assumptions: [
      '金額都是每 1 單位幣的數字，在 BTCUSDT 就是 1 BTC。倉位大小會把風險、報酬和手續費放大同樣的倍數，所以比值跟倉位大小無關。',
      '假設停損和目標都剛好成交在設定的價格。停損成交在更差的價格，風險會變大，比值會變小。',
      '單邊手續費率預設是吃單的假設值 {fee}，進場和出場各以成交金額計算一次，可以在進階參數裡修改。資金費沒有計入。',
      '損益兩平勝率告訴你這樣的交易要有多少比例走到目標價，沒有告訴你實際上會有多少比例走到。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '一筆交易由三個價格決定。進場價到停損價的距離是你冒的風險，進場價到目標價的距離是你可能賺到的報酬。兩者相除，就是報酬是風險的幾倍，寫成 R：',
      lines: ['風險 = |進場價 − 停損價|', '報酬 = |目標價 − 進場價|', 'R = 報酬 ÷ 風險', '損益兩平勝率 = 1 ÷ (1 + R)'],
      why: '最後一行回答的是「贏的要多常出現，才夠付輸的」。做很多筆、勝率是 w 的話，贏的部分帶進 w × R，輸的部分賠掉 (1 − w) × 1，單位都是風險。兩邊相等的時候 w = 1 ÷ (1 + R)。',
      tableCaption: '每一列都是用最後一條公式算出來的，不計手續費。',
      tableRatio: '報酬是風險的幾倍',
      tableBe: '損益兩平勝率',
      ratio: '{ratio}R',
      feeIntro: '手續費在開倉和平倉時各收一次，以成交金額計算。它讓每一筆虧損變大、每一筆獲利變小，所以需要的勝率會提高：',
      feeLines: [
        '停損出場的手續費 = (進場價 + 停損價) × 手續費率',
        '目標價出場的手續費 = (進場價 + 目標價) × 手續費率',
        '淨風險 = 風險 + 停損出場的手續費',
        '淨報酬 = 報酬 − 目標價出場的手續費',
        '扣手續費後的損益兩平勝率 = 淨風險 ÷ (淨風險 + 淨報酬)',
      ],
      feeNote: '手續費跟著價格走，不是跟著停損距離走。風險越小，手續費佔的比例越大，所以停損設得越近，結果被手續費推得越遠。例題 2 就是這種情況。',
      terms: [
        { term: 'R', text: '報酬除以風險。目標價離進場價的距離是停損的 2.5 倍，就是 2.5R，也常寫成風險報酬比 1:2.5。' },
        { term: '損益兩平勝率', text: '要有多少比例的交易走到目標價，贏的才夠付輸的。勝率比它高，期望值是正的；比它低，期望值是負的。' },
        {
          term: '單邊手續費率',
          text: '開倉和平倉各收一次，以成交金額計算。預設的單邊 {fee} 是吃單的假設值，你帳戶適用的費率請看 Bybit 的費率表。',
        },
      ],
      sources:
        '公式的來源：R 是定義，損益兩平勝率是上面那一行代數推出來的，所以沒有論文可以引用。手續費的算法和預設費率，跟本站的倉位大小計算機用的是同一套。',
      leftOut:
        '目標價多常被碰到。目標訂得越遠，比值越大，也越不容易走到，所以只看比值分不出一筆交易的好壞。另外沒有算進去的還有：持倉期間付出或收到的資金費、停損的滑價、分批出場，以及進場之後移動停損。',
    },
    examples: {
      first: '例題 1：做多，目標是 {ratio}R',
      second: '例題 2：做空，停損只離進場價 {riskPct}',
      setupLong: '做多。進場價 {entry}，停損價 {stop}，目標價 {target}，單邊手續費率 {fee}。',
      setupShort: '做空。進場價 {entry}，停損價 {stop}，目標價 {target}，單邊手續費率 {fee}。',
      workRisk: '風險 = |{entry} − {stop}| = 每單位 {risk} USDT',
      workReward: '報酬 = |{target} − {entry}| = 每單位 {reward} USDT',
      workRatio: 'R = {reward} ÷ {risk} = {ratio}',
      workBe: '損益兩平勝率 = 1 ÷ (1 + {ratio}) = {be}',
      workFeeStop: '停損出場的手續費 = ({entry} + {stop}) × {fee} = {feeStop} USDT',
      workFeeTarget: '目標價出場的手續費 = ({entry} + {target}) × {fee} = {feeTarget} USDT',
      workNet: '淨風險 = {netRisk} USDT，淨報酬 = {netReward} USDT',
      workBeNet: '扣手續費後的損益兩平勝率 = {netRisk} ÷ ({netRisk} + {netReward}) = {beNet}',
      result: '目標是風險的 {ratio} 倍。不計手續費時，這樣的交易要有 {be} 走到目標價才不賠；扣掉手續費之後要 {beNet}。',
      resultTight:
        '停損只離進場價 {riskPct}，所以停損出場的手續費 {feeStop} USDT 就佔了 {risk} USDT 風險的 {feeShare}。損益兩平勝率從 {be} 變成 {beNet}。',
    },
    mistakes: [
      {
        title: '只看比值就判斷一筆交易',
        text: '風險報酬比 1:{ratio} 說的是走到目標價時賺多少，沒有說多常走得到。例題 1 扣掉手續費之後，勝率要 {beNet} 才不賠。你的交易有沒有那麼常走到目標價，是另一個問題。',
      },
      {
        title: '停損設得很近，卻沒算手續費',
        text: '例題 2 的手續費佔風險的 {feeShare2}，損益兩平勝率從 {be2} 變成 {beNet2}。例題 1 的停損離進場價 {riskPct}，同樣的費率只讓它從 {be} 變成 {beNet}。',
      },
      {
        title: '把目標拉遠，讓比值變好看',
        text: '把例題 1 的目標價從 {target} 移到 {targetFar}，比值從 {ratio}R 變成 {ratioFar}R。但價格要先走 {rewardPctFar} 而不是 {rewardPct}，而且中途不能碰到停損。',
      },
      {
        title: '把損益兩平勝率當成目標',
        text: '勝率剛好等於損益兩平勝率時，期望值是 0。勝率要高過 {beNet}，期望值才是正的；而期望值是正的交易，過程中一樣會有連虧和回撤。',
      },
    ],
    allTools: '所有計算機',
  },
});
