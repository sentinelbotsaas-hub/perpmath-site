// Strings for /tools/liquidation-price-calculator/.
// `ui` is handed to src/scripts/liquidation-calculator.ts as JSON, so it holds
// templates only. Numbers ({mmr}, {limit}, {date}, {pct}) are filled in from
// the risk-limit snapshot and the calc library, never typed here.
import { defineStrings } from './strings';

export const liquidation = defineStrings({
  en: {
    title: 'Liquidation price calculator',
    description:
      'Work out the liquidation price of a BTCUSDT perpetual on isolated margin. Enter side, entry price and leverage, and see the distance to liquidation drawn to scale.',
    lede: 'BTCUSDT perpetual on Bybit, isolated margin.',
    noscript:
      'The calculator needs JavaScript. What you see is the worked example for a 20x long; the formula and examples below can be done on paper.',
    fields: {
      side: 'Side',
      long: 'Long',
      short: 'Short',
      entry: 'Entry price',
      leverage: 'Leverage',
      leverageUnit: 'x',
      mmr: 'Maintenance margin rate',
      mmrHint: 'Risk tier 1, positions up to {limit} USDT. Bybit data from {date}.',
      quantity: 'Position size',
      quantityHint: 'Optional. Only needed with extra margin.',
      extra: 'Extra margin',
      extraHint: 'Optional. Margin you added after opening.',
    },
    live: {
      button: 'Use live price',
      busy: 'Fetching price',
    },
    ui: {
      liquidation: 'Liquidation {price}',
      entry: 'Entry {price} is the full width',
      barLabel: '{pct} of the entry price is left before liquidation.',
      long: 'Price only has to fall {pct} for this position to be closed.',
      short: 'Price only has to rise {pct} for this position to be closed.',
      unreachable: 'With this much extra margin, this long cannot be liquidated at any price above zero.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      tier: 'This position is worth {value} USDT, above the tier 1 limit of {limit} USDT. Past that limit Bybit raises the maintenance margin rate step by step, so the real liquidation price is closer than shown. This calculator does not model the higher tiers.',
      liveOk: 'BTCUSDT last traded at {price} on Bybit ({time} UTC).',
      liveFail: 'Could not fetch the price. Enter it by hand.',
      errors: {
        entryPrice: 'Enter an entry price above 0.',
        leverage: 'Leverage must be between 1 and {max}.',
        mmr: 'Enter a rate of 0% or more and below 100%.',
        extraMargin: 'Extra margin cannot be negative. Use 0 if you added none.',
        quantity: 'Enter the position size in BTC to use extra margin.',
        noRoom:
          'At {lev}x the initial margin is not larger than the maintenance margin, so the position would be closed at once. Lower the leverage or the rate.',
      },
    },
    result: {
      label: 'Liquidation price',
    },
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro: 'For a USDT perpetual on isolated margin, the liquidation price can be estimated with the simplified formula:',
      long: 'Long:  liquidation price = entry price × (1 − 1 ÷ leverage + maintenance margin rate)',
      short: 'Short: liquidation price = entry price × (1 + 1 ÷ leverage − maintenance margin rate)',
      extraIntro: 'If you added margin after opening the position:',
      extraLong: 'Long:  subtract (extra margin ÷ position size)',
      extraShort: 'Short: add (extra margin ÷ position size)',
      terms: [
        { term: 'Entry price', text: 'The average price at which the position was opened.' },
        {
          term: 'Leverage',
          text: 'The multiple you chose when opening. At 20x your initial margin is one twentieth of the position value.',
        },
        {
          term: 'Maintenance margin rate',
          text: 'The margin the exchange requires you to keep in the position, as a share of its value. For BTCUSDT on Bybit it is {mmr} in risk tier 1, which covers positions up to {limit} USDT (Bybit public API, {date}).',
        },
        { term: 'Extra margin', text: 'USDT you put into this position after it was opened.' },
        { term: 'Position size', text: 'The quantity of contracts. For BTCUSDT it is counted in BTC.' },
      ],
      why: 'Why it works: your initial margin is 1 ÷ leverage of the position value. When losses have eaten the margin down to the maintenance level, the exchange closes the position. So the distance price can travel is 1 ÷ leverage minus the maintenance margin rate.',
      leftOut:
        'What the simplified formula leaves out: the fee for closing, funding paid while the position is open, and the higher maintenance margin rates for positions above tier 1. Bybit also triggers liquidation on the mark price, not the last traded price. Treat the result as an estimate and check the figure your exchange shows before you trade.',
    },
    examples: {
      first: 'Example 1: a {lev}x long',
      second: 'Example 2: a {lev}x short',
      setupLong: 'Long, entry {entry} USDT, {lev}x leverage, maintenance margin rate {mmr}.',
      setupShort: 'Short, entry {entry} USDT, {lev}x leverage, maintenance margin rate {mmr}.',
      resultLong: 'The liquidation price is {price}. Price has to fall {pct}.',
      resultShort: 'The liquidation price is {price}. Price has to rise {pct}.',
    },
    mistakes: [
      {
        title: 'Using the liquidation price as a stop',
        text: 'By the time price reaches the liquidation price, the margin is gone. A stop has to sit before it.',
      },
      {
        title: 'Forgetting the maintenance margin',
        text: 'At 20x the room is not 5%. It is 5% minus the maintenance margin rate: {pct} at the tier 1 rate.',
      },
      {
        title: 'Mixing up isolated and cross margin',
        text: 'This formula is for isolated margin. In cross margin the whole account balance backs the position, so the liquidation price moves with your other positions and your balance.',
      },
      {
        title: 'Watching the last traded price',
        text: 'Bybit decides liquidation on the mark price. In a fast market the mark price and the last trade can differ.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '爆倉價計算機',
    description:
      '算出 BTCUSDT 永續合約在逐倉模式下的爆倉價。輸入方向、進場價和槓桿，離爆倉還有多遠會照真實比例畫出來，並附上公式、例題和常見錯誤。',
    lede: 'Bybit 的 BTCUSDT 永續合約，逐倉模式。',
    noscript: '這個計算機需要 JavaScript。現在看到的是 20 倍多單的例題；下方的公式和例題可以自己用紙筆算。',
    fields: {
      side: '方向',
      long: '做多',
      short: '做空',
      entry: '進場價',
      leverage: '槓桿',
      leverageUnit: '倍',
      mmr: '維持保證金率',
      mmrHint: '風險級距第 1 級，適用倉位價值 {limit} USDT 以下。Bybit 資料日期 {date}。',
      quantity: '倉位大小',
      quantityHint: '選填。有追加保證金時才需要。',
      extra: '追加保證金',
      extraHint: '選填。開倉後另外加進去的保證金。',
    },
    live: {
      button: '帶入目前價格',
      busy: '正在抓價格',
    },
    ui: {
      liquidation: '爆倉價 {price}',
      entry: '整條代表進場價 {price}',
      barLabel: '離爆倉還剩進場價的 {pct}。',
      long: '價格只要下跌 {pct}，這個倉位就會被強制平倉。',
      short: '價格只要上漲 {pct}，這個倉位就會被強制平倉。',
      unreachable: '追加了這麼多保證金之後，這張多單在價格大於零的範圍內不會被強制平倉。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      tier: '這個倉位價值 {value} USDT，超過第 1 級的上限 {limit} USDT。超過之後 Bybit 會逐級提高維持保證金率，實際的爆倉價會比這裡顯示的更近。這個計算機沒有計入較高的級距。',
      liveOk: 'Bybit 的 BTCUSDT 最新成交價是 {price}（{time} UTC）。',
      liveFail: '抓不到價格，請手動輸入。',
      errors: {
        entryPrice: '進場價要大於 0。',
        leverage: '槓桿要在 1 到 {max} 之間。',
        mmr: '維持保證金率要在 0% 以上、小於 100%。',
        extraMargin: '追加保證金不能是負數；沒有追加就填 0。',
        quantity: '要計入追加保證金，請填倉位大小（單位是 BTC）。',
        noRoom: '{lev} 倍時，起始保證金沒有比維持保證金多，一開倉就會被強制平倉。請調低槓桿或維持保證金率。',
      },
    },
    result: {
      label: '爆倉價',
    },
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: 'USDT 永續合約在逐倉模式下，爆倉價可以用簡化公式估算：',
      long: '做多：爆倉價 = 進場價 × (1 − 1 ÷ 槓桿 + 維持保證金率)',
      short: '做空：爆倉價 = 進場價 × (1 + 1 ÷ 槓桿 − 維持保證金率)',
      extraIntro: '開倉後如果有追加保證金：',
      extraLong: '做多：再減去 (追加保證金 ÷ 倉位大小)',
      extraShort: '做空：再加上 (追加保證金 ÷ 倉位大小)',
      terms: [
        { term: '進場價', text: '開倉的成交均價。' },
        { term: '槓桿', text: '開倉時選的倍數。20 倍代表起始保證金是倉位價值的二十分之一。' },
        {
          term: '維持保證金率',
          text: '交易所要求你至少留在倉位裡的保證金，以倉位價值的比例表示。Bybit 的 BTCUSDT 在風險級距第 1 級是 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 公開 API，{date}）。',
        },
        { term: '追加保證金', text: '開倉後另外放進這個倉位的 USDT。' },
        { term: '倉位大小', text: '合約的數量。BTCUSDT 以 BTC 計算。' },
      ],
      why: '為什麼是這樣：起始保證金是倉位價值的 1 ÷ 槓桿。當虧損把保證金吃到只剩維持保證金，交易所就會強制平倉。所以價格能走的距離，就是 1 ÷ 槓桿 減掉維持保證金率。',
      leftOut:
        '簡化公式沒有算進去的：平倉手續費、持倉期間付出的資金費，以及倉位超過第 1 級之後較高的維持保證金率。另外，Bybit 是用標記價格判斷強制平倉，不是最新成交價。請把這裡的結果當成估計值，下單前以交易所顯示的數字為準。',
    },
    examples: {
      first: '例題 1：{lev} 倍多單',
      second: '例題 2：{lev} 倍空單',
      setupLong: '做多，進場價 {entry} USDT，槓桿 {lev} 倍，維持保證金率 {mmr}。',
      setupShort: '做空，進場價 {entry} USDT，槓桿 {lev} 倍，維持保證金率 {mmr}。',
      resultLong: '爆倉價是 {price}，價格下跌 {pct} 就會到。',
      resultShort: '爆倉價是 {price}，價格上漲 {pct} 就會到。',
    },
    mistakes: [
      {
        title: '把爆倉價當成停損',
        text: '價格走到爆倉價的時候，保證金已經沒了。停損一定要設在爆倉價之前。',
      },
      {
        title: '忘了扣掉維持保證金',
        text: '20 倍槓桿的空間不是 5%，而是 5% 減掉維持保證金率。用第 1 級的比率算是 {pct}。',
      },
      {
        title: '把逐倉和全倉搞混',
        text: '這個公式只適用逐倉。全倉模式下，整個帳戶的餘額都是這個倉位的保證金，爆倉價會跟著你的其他倉位和餘額變動。',
      },
      {
        title: '以為看的是最新成交價',
        text: 'Bybit 用標記價格判斷強制平倉。行情劇烈時，標記價格和最新成交價可能不一樣。',
      },
    ],
    allTools: '所有計算機',
  },
});
