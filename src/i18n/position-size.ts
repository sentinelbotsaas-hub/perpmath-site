// Strings for /tools/position-size-calculator/.
// `ui` is handed to src/scripts/position-size-calculator.ts as JSON, so it
// holds templates only. Every number is filled in from the inputs, the calc
// library or the risk-limit snapshot. The one stated assumption on the page is
// the default fee rate ({fee}), which the page passes in and the reader can
// change.
import { defineStrings } from './strings';

export const positionSize = defineStrings({
  en: {
    title: 'Position size calculator',
    description:
      'Size a BTCUSDT perpetual from the share of your account you accept losing at the stop. Get quantity, position value, margin and fees, and see if liquidation comes first.',
    lede: 'How big a position fits your risk per trade, for a BTCUSDT perpetual on Bybit, isolated margin.',
    noscript:
      'The calculator needs JavaScript. What you see is the first worked example; the formula and examples below can be done on paper.',
    fields: {
      account: 'Account size',
      risk: 'Risk per trade',
      entry: 'Entry price',
      stop: 'Stop price',
      stopHint: 'Below the entry for a long, above it for a short.',
      leverage: 'Leverage',
      leverageUnit: 'x',
      fee: 'Fee rate per side',
      feeHint: 'The default of {fee} (taker) is an assumption. Check Bybit’s fee table for your rate.',
    },
    assumption:
      'The liquidation check uses the risk tier 1 maintenance margin rate of {mmr}, for positions up to {limit} USDT (Bybit data from {date}).',
    ui: {
      stopBar: 'Stop distance',
      liqBar: 'Liquidation distance at {lev}x',
      barLabel:
        'Two bars on one scale that starts at 0. The full width is {max} of the entry price. The stop is {stop} from the entry. At {lev}x the liquidation price is {liq} from the entry.',
      levText: '{value}x',
      marginMeter: 'Margin required: {margin} USDT, out of an account of {account} USDT.',
      figure: '{qty} BTC',
      long: 'Long {qty} BTC. If the stop at {stop} is hit you lose {amount} USDT, {pct} of the account, plus about {fee} USDT in fees.',
      short: 'Short {qty} BTC. If the stop at {stop} is hit you lose {amount} USDT, {pct} of the account, plus about {fee} USDT in fees.',
      liquidated:
        'At {lev}x this position would be liquidated at {liq}, before price reaches your stop at {stop}. The stop would never trigger. Use {max}x or less, or move the stop closer.',
      liquidatedNoFix:
        'At {lev}x this position would be liquidated at {liq}, before price reaches your stop at {stop}. Even 1x does not keep this stop ahead of liquidation. Move the stop closer.',
      liqRow: 'Liquidation price at {lev}x',
      usdt: '{value} USDT',
      marginNote:
        'The margin required is more than the account holds. Raise the leverage, lower the risk per trade, or move the stop further away.',
      tier: 'This position is worth {value} USDT, above the tier 1 limit of {limit} USDT. Past that limit Bybit raises the maintenance margin rate step by step, so the real liquidation price is closer than shown. This calculator does not model the higher tiers.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        accountSize: 'Enter an account size above 0.',
        risk: 'Risk per trade must be above 0% and at most 100%.',
        entryPrice: 'Enter an entry price above 0.',
        stopPrice: 'Enter a stop price above 0 that is not the entry price.',
        leverage: 'Leverage must be between 1 and {max}.',
        feeRate: 'Enter a fee rate of 0% or more and below 100%.',
        noRoom:
          'At {lev}x the initial margin is not larger than the maintenance margin, so the position would be closed at once. Lower the leverage.',
      },
    },
    result: {
      label: 'Position size',
      caption: 'The rest of the result',
      notional: 'Position value',
      margin: 'Margin required',
      fee: 'Estimated fee, in and out',
      loss: 'Loss at the stop, fees included',
    },
    // Shown in the result panel, after `assumption` above. {fee} is the page's assumed rate.
    assumptions: [
      'The fee rate starts at an assumed taker rate of {fee} per side. Change it under Advanced settings.',
      'The quantity is cut, never rounded up. Slippage at the stop and funding are left out.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro: 'Start from the amount you accept losing if the stop is hit, then divide it by the loss on one unit:',
      lines: [
        'risk amount = account size × risk per trade',
        'quantity = risk amount ÷ |entry price − stop price|',
        'position value = quantity × entry price',
        'margin = position value ÷ leverage',
        'fee, in and out = quantity × (entry price + stop price) × fee rate',
      ],
      terms: [
        { term: 'Account size', text: 'The balance you size against, in USDT.' },
        { term: 'Risk per trade', text: 'The share of the account you accept losing if the stop is hit.' },
        {
          term: 'Stop price',
          text: 'The price at which your stop order closes the position. A stop below the entry means a long, a stop above it means a short.',
        },
        {
          term: 'Leverage',
          text: 'It does not change the quantity or the loss at the stop. It changes how much margin is locked and where the liquidation price sits.',
        },
        {
          term: 'Fee rate',
          text: 'Charged on the traded value when you open and again when you close. The default of {fee} per side is an assumption for taker orders; Bybit’s fee table shows the rate for your account.',
        },
      ],
      check:
        'The last step is a check. At your leverage the liquidation price is 1 ÷ leverage minus the maintenance margin rate away from the entry ({mmr} in risk tier 1, Bybit data from {date}). If that is closer than the stop, the stop never triggers, and the result says so.',
      leftOut:
        'What this leaves out: a stop can fill beyond its price in a fast market, funding is paid while the position is open, and the exchange has a minimum order size and a quantity step. Round the quantity down to the step your exchange accepts. Treat the result as an estimate.',
    },
    examples: {
      first: 'Example 1: a long risking {risk} of {account} USDT',
      second: 'Example 2: a short where liquidation comes first',
      setupLong: 'Long. Account {account} USDT, risk per trade {risk}, entry {entry}, stop {stop}, {lev}x leverage, fee rate {fee} per side.',
      setupShort: 'Short. Account {account} USDT, risk per trade {risk}, entry {entry}, stop {stop}, {lev}x leverage, fee rate {fee} per side.',
      workRisk: 'risk amount = {account} × {risk} = {amount} USDT',
      workQuantity: 'quantity = {amount} ÷ |{entry} − {stop}| = {qty} BTC',
      workNotional: 'position value = {qty} × {entry} = {notional} USDT',
      workMargin: 'margin = {notional} ÷ {lev} = {margin} USDT',
      workFee: 'fee = {qty} × ({entry} + {stop}) × {fee} = {feeAmount} USDT',
      workLiq: 'liquidation price at {lev}x = {liq}',
      resultOk:
        'The position is {qty} BTC. If the stop is hit the loss is {amount} USDT plus {feeAmount} USDT in fees. The liquidation price of {liq} is beyond the stop at {stop}, so the stop comes first.',
      resultLiquidated:
        'The size works out to {qty} BTC, but at {lev}x the liquidation price is {liq}, and price reaches it before the stop at {stop}. The position would be liquidated before the stop. At {max}x or less the stop comes first.',
    },
    mistakes: [
      {
        title: 'Sizing by leverage',
        text: 'Leverage does not set the risk. Two positions with the same quantity and the same stop lose the same amount at the stop, whatever leverage each one uses.',
      },
      {
        title: 'Reading the margin as the risk',
        text: 'The margin is what is locked, not what is lost at the stop. In example 1 the margin is {margin} USDT and the loss at the stop is {amount} USDT.',
      },
      {
        title: 'Leaving out the fees',
        text: 'Fees are charged on the position value, not on the margin. In example 1 they add {feeAmount} USDT to a planned loss of {amount} USDT.',
      },
      {
        title: 'A stop beyond the liquidation price',
        text: 'If liquidation comes first, the stop never triggers and the margin is lost instead of the amount you planned. Check the order of the two prices before you open.',
      },
      {
        title: 'Expecting the stop to fill at its price',
        text: 'Once triggered, a stop that closes at market takes the next available price. In a fast market that can be worse than the stop price, and the loss larger than planned.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '倉位大小計算機',
    description:
      '從「停損時願意賠掉帳戶的幾 %」反推 BTCUSDT 永續合約可以開多大。算出數量、倉位價值、所需保證金和預估手續費，並檢查爆倉會不會比停損先發生。',
    lede: '照你的單筆風險，算出這筆單可以開多大，適用 Bybit 的 BTCUSDT 永續合約、逐倉模式。',
    noscript: '這個計算機需要 JavaScript。現在看到的是第一個例題；下方的公式和例題可以自己用紙筆算。',
    fields: {
      account: '帳戶資金',
      risk: '單筆風險',
      entry: '進場價',
      stop: '停損價',
      stopHint: '做多時低於進場價，做空時高於進場價。',
      leverage: '槓桿',
      leverageUnit: '倍',
      fee: '單邊手續費率',
      feeHint: '預設的 {fee}（吃單）是假設值，請到 Bybit 的費率表查你自己的費率。',
    },
    assumption:
      '檢查爆倉時用的是風險級距第 1 級的維持保證金率 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 資料日期 {date}）。',
    ui: {
      stopBar: '停損距離',
      liqBar: '{lev} 倍的爆倉距離',
      barLabel: '兩條橫條用同一個從 0 開始的比例尺，整條代表進場價的 {max}。停損離進場價 {stop}；{lev} 倍時，爆倉價離進場價 {liq}。',
      levText: '{value} 倍',
      marginMeter: '所需保證金 {margin} USDT，帳戶資金 {account} USDT。',
      figure: '{qty} BTC',
      long: '做多 {qty} BTC。價格碰到設在 {stop} 的停損時，你會賠 {amount} USDT，也就是帳戶的 {pct}，另外還有大約 {fee} USDT 的手續費。',
      short: '做空 {qty} BTC。價格碰到設在 {stop} 的停損時，你會賠 {amount} USDT，也就是帳戶的 {pct}，另外還有大約 {fee} USDT 的手續費。',
      liquidated:
        '開 {lev} 倍的話，這個倉位會在 {liq} 被強制平倉，價格還沒走到你設在 {stop} 的停損就爆倉了，停損根本不會觸發。請把槓桿降到 {max} 倍以下，或把停損設近一點。',
      liquidatedNoFix:
        '開 {lev} 倍的話，這個倉位會在 {liq} 被強制平倉，價格還沒走到你設在 {stop} 的停損就爆倉了。就算只開 1 倍，這個停損也不會比爆倉先觸發。請把停損設近一點。',
      liqRow: '{lev} 倍的爆倉價',
      usdt: '{value} USDT',
      marginNote: '所需保證金比帳戶資金還多。請調高槓桿、調低單筆風險，或把停損設遠一點。',
      tier: '這個倉位價值 {value} USDT，超過第 1 級的上限 {limit} USDT。超過之後 Bybit 會逐級提高維持保證金率，實際的爆倉價會比這裡顯示的更近。這個計算機沒有計入較高的級距。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        accountSize: '帳戶資金要大於 0。',
        risk: '單筆風險要大於 0%，最多 100%。',
        entryPrice: '進場價要大於 0。',
        stopPrice: '停損價要大於 0，而且不能等於進場價。',
        leverage: '槓桿要在 1 到 {max} 之間。',
        feeRate: '手續費率要在 0% 以上、小於 100%。',
        noRoom: '{lev} 倍時，起始保證金沒有比維持保證金多，一開倉就會被強制平倉。請調低槓桿。',
      },
    },
    result: {
      label: '倉位大小',
      caption: '其他結果',
      notional: '倉位價值',
      margin: '所需保證金',
      fee: '預估手續費（進場加出場）',
      loss: '停損時的虧損（含手續費）',
    },
    assumptions: [
      '單邊手續費率預設是吃單的假設值 {fee}，可以在進階參數裡修改。',
      '數量只捨去、不進位。沒有計入停損的滑價和資金費。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '先決定停損觸發時願意賠多少錢，再除以每一單位會賠的金額：',
      lines: [
        '風險金額 = 帳戶資金 × 單筆風險',
        '數量 = 風險金額 ÷ |進場價 − 停損價|',
        '倉位價值 = 數量 × 進場價',
        '保證金 = 倉位價值 ÷ 槓桿',
        '手續費（進場加出場）= 數量 × (進場價 + 停損價) × 手續費率',
      ],
      terms: [
        { term: '帳戶資金', text: '你用來計算風險的餘額，單位是 USDT。' },
        { term: '單筆風險', text: '停損觸發時，你願意賠掉帳戶的比例。' },
        { term: '停損價', text: '停損單把倉位平掉的價格。停損低於進場價代表做多，高於進場價代表做空。' },
        { term: '槓桿', text: '槓桿不會改變數量，也不會改變停損時賠多少。它改變的是要鎖住多少保證金，以及爆倉價的位置。' },
        {
          term: '手續費率',
          text: '開倉和平倉各收一次，以成交金額計算。預設的單邊 {fee} 是吃單的假設值，你帳戶適用的費率請看 Bybit 的費率表。',
        },
      ],
      check:
        '最後一步是檢查。照你開的槓桿，爆倉價離進場價的距離是 1 ÷ 槓桿 減掉維持保證金率（風險級距第 1 級是 {mmr}，Bybit 資料日期 {date}）。如果這段距離比停損還近，停損就不會觸發，結果會直接告訴你。',
      leftOut:
        '這裡沒有算進去的：行情劇烈時停損的成交價可能比停損價更差、持倉期間要付資金費，以及交易所的最小下單量和數量級距。請把數量無條件捨去到交易所接受的單位。請把結果當成估計值。',
    },
    examples: {
      first: '例題 1：多單，拿 {account} USDT 的 {risk} 去冒險',
      second: '例題 2：空單，爆倉比停損先發生',
      setupLong: '做多。帳戶資金 {account} USDT，單筆風險 {risk}，進場價 {entry}，停損價 {stop}，槓桿 {lev} 倍，單邊手續費率 {fee}。',
      setupShort: '做空。帳戶資金 {account} USDT，單筆風險 {risk}，進場價 {entry}，停損價 {stop}，槓桿 {lev} 倍，單邊手續費率 {fee}。',
      workRisk: '風險金額 = {account} × {risk} = {amount} USDT',
      workQuantity: '數量 = {amount} ÷ |{entry} − {stop}| = {qty} BTC',
      workNotional: '倉位價值 = {qty} × {entry} = {notional} USDT',
      workMargin: '保證金 = {notional} ÷ {lev} = {margin} USDT',
      workFee: '手續費 = {qty} × ({entry} + {stop}) × {fee} = {feeAmount} USDT',
      workLiq: '{lev} 倍的爆倉價 = {liq}',
      resultOk:
        '倉位是 {qty} BTC。停損觸發時會賠 {amount} USDT，另外加上 {feeAmount} USDT 的手續費。爆倉價 {liq} 在停損價 {stop} 的後面，所以停損會先觸發。',
      resultLiquidated:
        '算出來的數量是 {qty} BTC，但是開 {lev} 倍時爆倉價是 {liq}，價格會先走到這裡，之後才是設在 {stop} 的停損。這個倉位會在停損之前被強制平倉。槓桿降到 {max} 倍以下，停損才會先觸發。',
    },
    mistakes: [
      {
        title: '用槓桿決定倉位大小',
        text: '槓桿不會決定風險。兩個倉位只要數量一樣、停損一樣，停損時賠的錢就一樣，跟各自開幾倍無關。',
      },
      {
        title: '把保證金當成風險',
        text: '保證金是被鎖住的錢，不是停損時賠掉的錢。例題 1 的保證金是 {margin} USDT，停損時賠的是 {amount} USDT。',
      },
      {
        title: '沒把手續費算進去',
        text: '手續費是照倉位價值收的，不是照保證金。例題 1 原本打算賠 {amount} USDT，手續費會再多出 {feeAmount} USDT。',
      },
      {
        title: '停損設在爆倉價的後面',
        text: '如果爆倉比停損先發生，停損不會觸發，賠掉的是整筆保證金，而不是你原本打算賠的金額。開倉前先確認這兩個價格的先後順序。',
      },
      {
        title: '以為停損一定成交在停損價',
        text: '市價停損觸發之後，是用當下能成交的價格平倉。行情劇烈時，成交價可能比停損價更差，實際虧損會比計畫的多。',
      },
    ],
    allTools: '所有計算機',
  },
});
