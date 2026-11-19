// Strings for /tools/leverage-calculator/.
// `ui` is handed to src/scripts/leverage-calculator.ts as JSON, so it holds
// templates only. Every number ({lev}, {pct}, {mmr}, {limit}, {date}, ...) is
// filled in from the inputs, the calc library or the risk-limit snapshot,
// never typed here.
import { defineStrings } from './strings';

export const leverage = defineStrings({
  en: {
    title: 'Leverage calculator',
    description:
      'Find the highest leverage that keeps your stop ahead of liquidation on a BTCUSDT perpetual. Enter side, entry price and stop price; both distances are drawn to scale.',
    lede: 'The highest leverage at which your stop is hit before liquidation, for a BTCUSDT perpetual on Bybit, isolated margin.',
    noscript:
      'The calculator needs JavaScript. What you see is the worked example for a long with a stop {pct} below entry; the formula and examples below can be done on paper.',
    fields: {
      side: 'Side',
      long: 'Long',
      short: 'Short',
      entry: 'Entry price',
      stop: 'Stop price',
      mmr: 'Maintenance margin rate',
      mmrHint: 'Risk tier 1, positions up to {limit} USDT. Bybit data from {date}.',
    },
    ui: {
      stopBar: 'Stop distance',
      liqBar: 'Liquidation distance at {lev}x',
      barLabel:
        'Two bars on one scale that starts at 0. The full width is {max} of the entry price. The stop is {stop} from the entry. At {lev}x the liquidation price is {liq} from the entry.',
      liqRow: 'Liquidation price at {lev}x',
      figure: '{lev}x',
      ok: 'At {lev}x your stop at {stop} is hit before the liquidation price of {liq}.',
      capped:
        'Your stop is close enough that every leverage Bybit allows in risk tier 1, up to {lev}x, keeps it ahead of the liquidation price.',
      infeasible:
        'Even at 1x this position would be liquidated before price reaches the stop. Move the stop closer to the entry price.',
      limit: 'The limit is 1 ÷ ({stop} + {mmr}) = {limit}x. Leverage has to stay below it.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        entryPrice: 'Enter an entry price above 0.',
        stopPrice: 'Enter a stop price above 0.',
        stopSideLong: 'For a long the stop has to be below the entry price. Lower the stop, or switch the side to short.',
        stopSideShort: 'For a short the stop has to be above the entry price. Raise the stop, or switch the side to long.',
        mmr: 'Enter a rate of 0% or more and below 100%.',
      },
    },
    result: {
      label: 'Maximum leverage',
      limit: 'Limit before rounding down',
    },
    // Shown in the result panel. {mmr} and {limit} come from the risk-limit snapshot.
    assumptions: [
      'Simplified formula for isolated margin on the Bybit BTCUSDT perpetual, with no margin added after opening.',
      'The maintenance margin rate starts at the risk tier 1 rate of {mmr}, for positions up to {limit} USDT. Change it under Advanced settings.',
      'A stop is an order, not a guarantee: in a fast market it can fill at a worse price than the stop.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'On isolated margin, price can move against a position by 1 ÷ leverage minus the maintenance margin rate before the exchange closes it. The stop is reached first only while that distance is larger than the distance to the stop:',
      distance: 'stop distance = |entry price − stop price| ÷ entry price',
      limit: 'maximum leverage < 1 ÷ (stop distance + maintenance margin rate)',
      terms: [
        { term: 'Entry price', text: 'The average price at which the position is opened.' },
        {
          term: 'Stop price',
          text: 'The price at which your stop order closes the position. Below the entry for a long, above it for a short.',
        },
        { term: 'Stop distance', text: 'How far the stop is from the entry, as a share of the entry price.' },
        {
          term: 'Maintenance margin rate',
          text: 'The margin the exchange requires you to keep in the position, as a share of its value. For BTCUSDT on Bybit it is {mmr} in risk tier 1, which covers positions up to {limit} USDT (Bybit public API, {date}).',
        },
      ],
      why: 'Where it comes from: the distance to liquidation is 1 ÷ leverage − maintenance margin rate. Requiring it to be larger than the stop distance and solving for leverage gives the second line. The sign is “less than”, not “at most”: at exactly that leverage the liquidation price and the stop are the same price.',
      whole: 'The big figure is the largest whole number below the limit, and never more than the {max}x Bybit allows in risk tier 1.',
      leftOut:
        'What this leaves out: a stop is an order, not a guarantee. In a fast market it can fill beyond its price, and Bybit decides liquidation on the mark price while your stop triggers on the price you set it to watch. The simplified formula also leaves out the fee for closing and funding paid while the position is open. Leave a gap between the stop and the liquidation price, and check the figures your exchange shows before you trade.',
    },
    examples: {
      first: 'Example 1: a long with a stop {pct} below entry',
      second: 'Example 2: a short with a stop {pct} above entry',
      setupLong: 'Long, entry {entry} USDT, stop {stop} USDT, maintenance margin rate {mmr}.',
      setupShort: 'Short, entry {entry} USDT, stop {stop} USDT, maintenance margin rate {mmr}.',
      workDistance: 'stop distance = |{entry} − {stop}| ÷ {entry} = {d}',
      workLimit: 'limit = 1 ÷ ({d} + {m}) = {limit}',
      workAt: 'liquidation price at {lev}x = {liq}',
      resultLong:
        'Use at most {lev}x. At {lev}x the liquidation price is {liq}, below the stop at {stop}. At {next}x it would be {liqNext}, above the stop, so the position would be liquidated first.',
      resultShort:
        'Use at most {lev}x. At {lev}x the liquidation price is {liq}, above the stop at {stop}. At {next}x it would be {liqNext}, below the stop, so the position would be liquidated first.',
    },
    mistakes: [
      {
        title: 'Choosing the leverage before the stop',
        text: 'The stop belongs where the trade idea is proven wrong. Place it first; the leverage that still fits follows from it, not the other way round.',
      },
      {
        title: 'Forgetting the maintenance margin',
        text: 'A stop {pct} away does not allow 1 ÷ {pct} = {naive}x. With the maintenance margin rate of {mmr} the limit is {limit}x.',
      },
      {
        title: 'Using the limit itself',
        text: 'At the limit the liquidation price and the stop are the same price. A small difference between the mark price and the last trade is then enough to be liquidated instead of stopped out.',
      },
      {
        title: 'Reading leverage as the risk',
        text: 'Leverage sets where the liquidation price sits and how much margin is locked. What you lose at the stop is set by the position size, not by the leverage.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '槓桿計算機',
    description:
      '算出停損會比爆倉先觸發的最高槓桿。輸入 BTCUSDT 永續合約的方向、進場價和停損價，停損距離和爆倉距離會畫在同一條橫條上，照真實比例呈現。',
    lede: '算出停損會比爆倉先觸發的最高槓桿，適用 Bybit 的 BTCUSDT 永續合約、逐倉模式。',
    noscript:
      '這個計算機需要 JavaScript。現在看到的是多單、停損設在進場價下方 {pct} 的例題；下方的公式和例題可以自己用紙筆算。',
    fields: {
      side: '方向',
      long: '做多',
      short: '做空',
      entry: '進場價',
      stop: '停損價',
      mmr: '維持保證金率',
      mmrHint: '風險級距第 1 級，適用倉位價值 {limit} USDT 以下。Bybit 資料日期 {date}。',
    },
    ui: {
      stopBar: '停損距離',
      liqBar: '{lev} 倍的爆倉距離',
      barLabel: '兩條橫條用同一個從 0 開始的比例尺，整條代表進場價的 {max}。停損離進場價 {stop}；{lev} 倍時，爆倉價離進場價 {liq}。',
      liqRow: '{lev} 倍的爆倉價',
      figure: '{lev} 倍',
      ok: '開 {lev} 倍時，價格會先碰到你設在 {stop} 的停損，之後才是爆倉價 {liq}。',
      capped: '你的停損夠近，Bybit 在風險級距第 1 級允許的槓桿（最高 {lev} 倍）都能讓停損比爆倉先觸發。',
      infeasible: '就算只開 1 倍，這個倉位也會在價格碰到停損之前被強制平倉。請把停損設得離進場價近一點。',
      limit: '上限是 1 ÷ ({stop} + {mmr}) = {limit} 倍，槓桿要低於這個數字。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        entryPrice: '進場價要大於 0。',
        stopPrice: '停損價要大於 0。',
        stopSideLong: '做多的停損要低於進場價。請調低停損價，或把方向改成做空。',
        stopSideShort: '做空的停損要高於進場價。請調高停損價，或把方向改成做多。',
        mmr: '維持保證金率要在 0% 以上、小於 100%。',
      },
    },
    result: {
      label: '最高槓桿',
      limit: '取整數之前的上限',
    },
    assumptions: [
      '逐倉模式的簡化公式，適用 Bybit 的 BTCUSDT 永續合約，沒有計入開倉後追加的保證金。',
      '維持保證金率預設是風險級距第 1 級的 {mmr}，適用倉位價值 {limit} USDT 以下，可以在進階參數裡修改。',
      '停損是一張委託單，不是保證：行情劇烈時，成交價可能比停損價更差。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro:
        '逐倉模式下，價格逆向走了 1 ÷ 槓桿 減掉維持保證金率這麼遠，交易所就會強制平倉。這段距離要比停損的距離長，停損才會先觸發：',
      distance: '停損距離 = |進場價 − 停損價| ÷ 進場價',
      limit: '最高槓桿 < 1 ÷ (停損距離 + 維持保證金率)',
      terms: [
        { term: '進場價', text: '開倉的成交均價。' },
        { term: '停損價', text: '停損單把倉位平掉的價格。做多時低於進場價，做空時高於進場價。' },
        { term: '停損距離', text: '停損離進場價多遠，以進場價的比例表示。' },
        {
          term: '維持保證金率',
          text: '交易所要求你至少留在倉位裡的保證金，以倉位價值的比例表示。Bybit 的 BTCUSDT 在風險級距第 1 級是 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 公開 API，{date}）。',
        },
      ],
      why: '為什麼是這樣：離爆倉的距離是 1 ÷ 槓桿 − 維持保證金率。要求這段距離大於停損距離，再把槓桿移到左邊，就得到第二行。符號是「小於」而不是「小於等於」：槓桿剛好等於上限時，爆倉價和停損價是同一個價格。',
      whole: '大字顯示的是低於上限的最大整數，而且不會超過 Bybit 在風險級距第 1 級允許的 {max} 倍。',
      leftOut:
        '這裡沒有算進去的：停損是一張委託單，不是保證。行情劇烈時，成交價可能比停損價更差；而且 Bybit 用標記價格判斷強制平倉，你的停損則是看你設定的那個觸發價格。簡化公式也沒有計入平倉手續費和持倉期間付出的資金費。請在停損和爆倉價之間留一段距離，下單前以交易所顯示的數字為準。',
    },
    examples: {
      first: '例題 1：多單，停損在進場價下方 {pct}',
      second: '例題 2：空單，停損在進場價上方 {pct}',
      setupLong: '做多，進場價 {entry} USDT，停損價 {stop} USDT，維持保證金率 {mmr}。',
      setupShort: '做空，進場價 {entry} USDT，停損價 {stop} USDT，維持保證金率 {mmr}。',
      workDistance: '停損距離 = |{entry} − {stop}| ÷ {entry} = {d}',
      workLimit: '上限 = 1 ÷ ({d} + {m}) = {limit}',
      workAt: '{lev} 倍的爆倉價 = {liq}',
      resultLong:
        '最多開 {lev} 倍。{lev} 倍的爆倉價是 {liq}，低於設在 {stop} 的停損。開到 {next} 倍，爆倉價會變成 {liqNext}，高於停損，倉位會先被強制平倉。',
      resultShort:
        '最多開 {lev} 倍。{lev} 倍的爆倉價是 {liq}，高於設在 {stop} 的停損。開到 {next} 倍，爆倉價會變成 {liqNext}，低於停損，倉位會先被強制平倉。',
    },
    mistakes: [
      {
        title: '先決定槓桿，再決定停損',
        text: '停損應該設在「這筆交易的想法被證明是錯的」那個價格。先把停損定下來，能開幾倍槓桿是跟著停損算出來的，順序不能反過來。',
      },
      {
        title: '忘了扣掉維持保證金',
        text: '停損距離 {pct}，不代表可以開 1 ÷ {pct} = {naive} 倍。把維持保證金率 {mmr} 算進去，上限是 {limit} 倍。',
      },
      {
        title: '直接用上限那個倍數',
        text: '槓桿等於上限時，爆倉價和停損價是同一個價格。標記價格和最新成交價只要差一點，你就會被強制平倉，而不是停損出場。',
      },
      {
        title: '把槓桿當成風險',
        text: '槓桿決定的是爆倉價的位置，以及要鎖住多少保證金。停損觸發時賠多少，是由倉位大小決定的，不是槓桿。',
      },
    ],
    allTools: '所有計算機',
  },
});
