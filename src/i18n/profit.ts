// Strings for /tools/crypto-profit-calculator/.
// `ui` is handed to src/scripts/profit-calculator.ts as JSON, so it holds
// templates only. Every number is filled in from the inputs, the calc library,
// the risk-limit snapshot ({mmr}, {limit}, {date}) or the market report
// ({hours}, {rate}, {day}). The stated assumptions are the default fee rate
// ({fee}) and the example funding rate, both of which the reader can change.
import { defineStrings } from './strings';

export const profit = defineStrings({
  en: {
    title: 'Crypto futures profit calculator',
    description:
      'Profit or loss of a BTCUSDT perpetual trade at any exit price: P&L before costs, fees, funding, net P&L, and the return on margin and on position value.',
    lede: 'What a trade leaves after fees and funding, for a BTCUSDT perpetual on Bybit, isolated margin.',
    noscript:
      'The calculator needs JavaScript. What you see is the first worked example; the formula and examples below can be done on paper.',
    fields: {
      side: 'Side',
      long: 'Long',
      short: 'Short',
      entry: 'Entry price',
      exit: 'Exit price',
      unit: 'Position size given as',
      unitQuantity: 'Quantity',
      unitMargin: 'Margin',
      quantity: 'Quantity',
      margin: 'Margin',
      leverage: 'Leverage',
      leverageUnit: 'x',
      fundingRate: 'Funding rate per settlement',
      fundingHint: 'Positive: longs pay shorts. Negative: shorts pay longs.',
      periods: 'Settlements held through',
      periodsUnit: 'settlements',
      periodsHint: '0 leaves funding out.',
      fee: 'Fee rate per side',
      feeHint: 'The default of {fee} (taker) is an assumption. Check Bybit’s fee table for your rate.',
    },
    fundingNow:
      'BTCUSDT funding settles every {hours} hours. The last settlement of {day} (UTC) was at {rate}. The rate in the form is an example.',
    fundingLink: 'Funding rates of the last 30 days',
    assumption:
      'The liquidation check uses the risk tier 1 maintenance margin rate of {mmr}, for positions up to {limit} USDT (Bybit data from {date}).',
    ui: {
      levText: '{value}x',
      figure: '{value} USDT',
      long: 'Long {qty} BTC from {entry} to {exit}: {gross} USDT before costs, and {net} USDT after {fee} USDT of fees and {funding} USDT of funding. That is {roi} on {margin} USDT of margin.',
      short:
        'Short {qty} BTC from {entry} to {exit}: {gross} USDT before costs, and {net} USDT after {fee} USDT of fees and {funding} USDT of funding. That is {roi} on {margin} USDT of margin.',
      liquidated:
        'At {lev}x this position is liquidated at {liq}. Price gets there before it gets to {exit}, so the exchange had already closed the position by then, and what is lost is its margin of {margin} USDT. A P&L worked out at {exit} would describe a trade that cannot happen.',
      grossBar: 'P&L before costs',
      costBar: 'Fees and funding',
      barLabel:
        'Two bars on one scale that starts at 0. The full width is {max} of the margin. The P&L before costs is {gross} of the margin; fees and funding together are {costs} of it.',
      barEmpty: 'Nothing to draw: the price did not move and there are no costs.',
      barsOff: 'No bars are drawn: there is no result at this exit price.',
      liqRow: 'Liquidation price at {lev}x',
      usdt: '{value} USDT',
      btc: '{value} BTC',
      tier: 'This position is worth {value} USDT, above the tier 1 limit of {limit} USDT. Past that limit Bybit raises the maintenance margin rate step by step, so the real liquidation price is closer than shown. This calculator does not model the higher tiers.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        entryPrice: 'Enter an entry price above 0.',
        exitPrice: 'Enter an exit price above 0.',
        quantity: 'Enter a quantity above 0.',
        margin: 'Enter a margin above 0.',
        leverage: 'Leverage must be between 1 and {max}.',
        feeRate: 'Enter a fee rate of 0% or more and below 100%.',
        fundingRate: 'Enter a funding rate between −100% and 100%. It can be negative.',
        fundingPeriods: 'Enter a whole number of settlements, from 0 to {maxPeriods}.',
        noRoom:
          'At {lev}x the initial margin is not larger than the maintenance margin, so the position would be closed at once. Lower the leverage.',
      },
    },
    result: {
      label: 'Net P&L',
      caption: 'The rest of the result',
      gross: 'P&L before costs',
      fee: 'Fee, in and out',
      funding: 'Funding',
      roiMargin: 'Return on margin, after costs',
      roiNotional: 'Return on position value, after costs',
      quantity: 'Quantity',
      notional: 'Position value at entry',
      margin: 'Margin',
      breakEven: 'Exit price that breaks even',
    },
    // Shown in the result panel, before `assumption` above. {fee} is the page's assumed rate.
    assumptions: [
      'The fee rate starts at an assumed taker rate of {fee} per side. Change it under Advanced settings.',
      'Funding is charged on the position value at entry at every settlement. The real charge uses the mark price at each settlement, and the rate changes from one to the next.',
      'Slippage is left out. The liquidation price is the simplified one, without fees or funding.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'The price move gives the figure before costs. Two costs then come off it: the fee, charged on the way in and again on the way out, and funding, charged at every settlement the position is held through.',
      lines: [
        'position value = quantity × entry price',
        'margin = position value ÷ leverage',
        'P&L before costs, long = quantity × (exit price − entry price)',
        'P&L before costs, short = quantity × (entry price − exit price)',
        'fee, in and out = quantity × (entry price + exit price) × fee rate',
        'funding = position value × funding rate × settlements',
        'net P&L = P&L before costs − fee ± funding',
        'return on margin = net P&L ÷ margin',
        'return on position value = net P&L ÷ position value',
      ],
      terms: [
        {
          term: 'Leverage',
          text: 'It does not change the P&L in USDT. It sets the margin, so it changes the return on margin, and it sets the liquidation price.',
        },
        {
          term: 'Fee rate',
          text: 'Charged on the traded value when you open and again when you close. The default of {fee} per side is an assumption for taker orders; Bybit’s fee table shows the rate for your account.',
        },
        {
          term: 'Funding',
          text: 'Paid between longs and shorts at each settlement. With a positive rate a long pays and a short receives; with a negative rate it is the other way round. In the net P&L line it is subtracted when you pay and added when you receive.',
        },
        {
          term: 'Return on margin',
          text: 'The net P&L over the margin. At any leverage above 1x it is a larger number than the return on position value, for the same trade and the same USDT.',
        },
        {
          term: 'Return on position value',
          text: 'The net P&L over the position value at entry. Before costs it equals the price move in percent.',
        },
      ],
      check:
        'The last step is a check. At your leverage the liquidation price is 1 ÷ leverage minus the maintenance margin rate away from the entry ({mmr} in risk tier 1, Bybit data from {date}); it is worked out by the formula of the liquidation price calculator. An exit price at or beyond it cannot be reached with the position still open. The result then says so instead of printing a loss larger than the margin.',
      leftOut:
        'What this leaves out: slippage, a different fee rate on each side (maker and taker), funding rates that change between settlements, and partial closes. Treat the result as an estimate; the exchange’s own statement is the one that counts.',
    },
    examples: {
      first: 'Example 1: a {lev}x long held through {periods} settlements',
      second: 'Example 2: a short sized by margin that loses',
      setupQuantity:
        'Long {qty} BTC at {lev}x. Entry {entry}, exit {exit}. Fee rate {fee} per side, funding {rate} at each of {periods} settlements.',
      setupMargin:
        'Short with {margin} USDT of margin at {lev}x. Entry {entry}, exit {exit}. Fee rate {fee} per side, funding {rate} at each of {periods} settlements.',
      workNotional: 'position value = {qty} × {entry} = {notional} USDT',
      workNotionalMargin: 'position value = {margin} × {lev} = {notional} USDT',
      workQuantity: 'quantity = {notional} ÷ {entry} = {qty} BTC',
      workMargin: 'margin = {notional} ÷ {lev} = {margin} USDT',
      workGrossLong: 'P&L before costs = {qty} × ({exit} − {entry}) = {gross} USDT',
      workGrossShort: 'P&L before costs = {qty} × ({entry} − {exit}) = {gross} USDT',
      workFee: 'fee = {qty} × ({entry} + {exit}) × {fee} = {feeAmount} USDT',
      workFundingPaid: 'funding paid = {notional} × {rate} × {periods} = {fundingAbs} USDT',
      workFundingReceived: 'funding received = {notional} × {rate} × {periods} = {fundingAbs} USDT',
      workNet: 'net P&L = {gross} − {feeAmount} {fundingSign} {fundingAbs} = {net} USDT',
      workRoi: 'return on margin = {net} ÷ {margin} = {roi}',
      resultWin:
        'The trade makes {net} USDT: {roi} on the margin and {roiNotional} on the position value. Fees and funding took {costsAbs} USDT out of the {gross} USDT the price move gave. The liquidation price at {lev}x is {liq}.',
      resultLoss:
        'The trade loses: {net} USDT, which is {roi} on the margin. The price move alone was {gross} USDT. Fees added {feeAmount} USDT to the loss, and the funding received took {fundingAbs} USDT off it. The liquidation price at {lev}x is {liq}, beyond the exit, so the position was still open.',
    },
    mistakes: [
      {
        title: 'Reading the return on margin as the price move',
        text: 'In example 1 price moved {move}, which shows up as {grossRoi} on the margin at {lev}x. The larger figure comes from the leverage, not from a larger move, and it works the same way on a loss.',
      },
      {
        title: 'Leaving the fee out',
        text: 'The fee is charged on the position value, twice. In example 1 it is {feeAmount} USDT against a margin of {margin} USDT: {feeRoi} of the margin, win or lose.',
      },
      {
        title: 'Forgetting funding on a long hold',
        text: 'Funding is small at each settlement and it adds up. At the example rate of {rate}, the position of example 1 pays {fundingLong} USDT over {manyPeriods} settlements.',
      },
      {
        title: 'Calling a trade a winner before costs',
        text: 'A small move can be eaten by costs. With the fees and funding of example 1, price has to reach {breakEven} before the trade stops losing.',
      },
      {
        title: 'Pricing an exit beyond liquidation',
        text: 'On isolated margin a position cannot lose more than its margin: the exchange closes it first. The position of example 1 is liquidated at {liq}. An exit price below that is not a result.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '合約損益計算機',
    description:
      '算出 BTCUSDT 永續合約在某個出場價的損益：未扣費損益、來回手續費、資金費、淨損益，以及對保證金與對倉位價值的報酬率。出場價越過爆倉價時會直接告訴你。',
    lede: '這筆單扣掉手續費和資金費之後還剩多少，適用 Bybit 的 BTCUSDT 永續合約、逐倉模式。',
    noscript: '這個計算機需要 JavaScript。現在看到的是第一個例題；下方的公式和例題可以自己用紙筆算。',
    fields: {
      side: '方向',
      long: '做多',
      short: '做空',
      entry: '進場價',
      exit: '出場價',
      unit: '倉位大小用什麼輸入',
      unitQuantity: '數量',
      unitMargin: '保證金',
      quantity: '數量',
      margin: '保證金',
      leverage: '槓桿',
      leverageUnit: '倍',
      fundingRate: '每次結算的資金費率',
      fundingHint: '正值是多單付給空單，負值是空單付給多單。',
      periods: '持倉期間經過幾次結算',
      periodsUnit: '次',
      periodsHint: '填 0 就不計資金費。',
      fee: '單邊手續費率',
      feeHint: '預設的 {fee}（吃單）是假設值，請到 Bybit 的費率表查你自己的費率。',
    },
    fundingNow: 'BTCUSDT 每 {hours} 小時結算一次資金費。{day}（UTC）最後一次結算的費率是 {rate}。表單裡的費率只是例子。',
    fundingLink: '最近 30 天的資金費率',
    assumption:
      '檢查爆倉時用的是風險級距第 1 級的維持保證金率 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 資料日期 {date}）。',
    ui: {
      levText: '{value} 倍',
      figure: '{value} USDT',
      long: '做多 {qty} BTC，從 {entry} 到 {exit}：未扣費損益 {gross} USDT，扣掉手續費 {fee} USDT 和資金費 {funding} USDT 之後是 {net} USDT，相當於 {margin} USDT 保證金的 {roi}。',
      short:
        '做空 {qty} BTC，從 {entry} 到 {exit}：未扣費損益 {gross} USDT，扣掉手續費 {fee} USDT 和資金費 {funding} USDT 之後是 {net} USDT，相當於 {margin} USDT 保證金的 {roi}。',
      liquidated:
        '開 {lev} 倍的話，這個倉位會在 {liq} 被強制平倉。價格走到 {exit} 之前會先經過這裡，所以在這個價位之前倉位就已經被強制平倉，賠掉的是這個倉位的保證金 {margin} USDT。用 {exit} 算出來的損益，是一筆不會發生的交易。',
      grossBar: '未扣費損益',
      costBar: '手續費與資金費',
      barLabel:
        '兩條橫條用同一個從 0 開始的比例尺，整條代表保證金的 {max}。未扣費損益是保證金的 {gross}，手續費與資金費合計是保證金的 {costs}。',
      barEmpty: '沒有東西可以畫：價格沒有變動，也沒有任何費用。',
      barsOff: '這個出場價沒有結果，所以沒有畫橫條。',
      liqRow: '{lev} 倍的爆倉價',
      usdt: '{value} USDT',
      btc: '{value} BTC',
      tier: '這個倉位價值 {value} USDT，超過第 1 級的上限 {limit} USDT。超過之後 Bybit 會逐級提高維持保證金率，實際的爆倉價會比這裡顯示的更近。這個計算機沒有計入較高的級距。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        entryPrice: '進場價要大於 0。',
        exitPrice: '出場價要大於 0。',
        quantity: '數量要大於 0。',
        margin: '保證金要大於 0。',
        leverage: '槓桿要在 1 到 {max} 之間。',
        feeRate: '手續費率要在 0% 以上、小於 100%。',
        fundingRate: '資金費率要在 −100% 到 100% 之間，可以是負數。',
        fundingPeriods: '結算次數要是整數，從 0 到 {maxPeriods}。',
        noRoom: '{lev} 倍時，起始保證金沒有比維持保證金多，一開倉就會被強制平倉。請調低槓桿。',
      },
    },
    result: {
      label: '淨損益',
      caption: '其他結果',
      gross: '未扣費損益',
      fee: '手續費（進場加出場）',
      funding: '資金費',
      roiMargin: '保證金報酬率（扣費後）',
      roiNotional: '倉位價值報酬率（扣費後）',
      quantity: '數量',
      notional: '進場時的倉位價值',
      margin: '保證金',
      breakEven: '損益兩平的出場價',
    },
    assumptions: [
      '單邊手續費率預設是吃單的假設值 {fee}，可以在進階參數裡修改。',
      '每次結算的資金費都用進場時的倉位價值計算。實際上是用結算當下的標記價格，而且每次的費率都不一樣。',
      '沒有計入滑價。爆倉價用的是簡化公式，沒有計入手續費和資金費。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro:
        '價格的變動決定未扣費的損益，接著要扣掉兩種成本：手續費在進場和出場各收一次；資金費則是持倉期間每經過一次結算就算一次。',
      lines: [
        '倉位價值 = 數量 × 進場價',
        '保證金 = 倉位價值 ÷ 槓桿',
        '做多的未扣費損益 = 數量 × (出場價 − 進場價)',
        '做空的未扣費損益 = 數量 × (進場價 − 出場價)',
        '手續費（進場加出場）= 數量 × (進場價 + 出場價) × 手續費率',
        '資金費 = 倉位價值 × 資金費率 × 結算次數',
        '淨損益 = 未扣費損益 − 手續費 ± 資金費',
        '對保證金的報酬率 = 淨損益 ÷ 保證金',
        '對倉位價值的報酬率 = 淨損益 ÷ 倉位價值',
      ],
      terms: [
        { term: '槓桿', text: '槓桿不會改變以 USDT 計算的損益。它決定保證金的多寡，所以會改變對保證金的報酬率，也決定爆倉價的位置。' },
        {
          term: '手續費率',
          text: '開倉和平倉各收一次，以成交金額計算。預設的單邊 {fee} 是吃單的假設值，你帳戶適用的費率請看 Bybit 的費率表。',
        },
        {
          term: '資金費',
          text: '多空雙方在每次結算時互付的費用。費率為正時多單付錢、空單收錢，費率為負時反過來。淨損益那一行，付出去就減、收進來就加。',
        },
        { term: '對保證金的報酬率', text: '淨損益除以保證金。只要槓桿高於 1 倍，同一筆交易、同樣的 USDT，這個數字都會比對倉位價值的報酬率大。' },
        { term: '對倉位價值的報酬率', text: '淨損益除以進場時的倉位價值。還沒扣費之前，它就等於價格變動的百分比。' },
      ],
      check:
        '最後一步是檢查。照你開的槓桿，爆倉價離進場價的距離是 1 ÷ 槓桿 減掉維持保證金率（風險級距第 1 級是 {mmr}，Bybit 資料日期 {date}），用的就是爆倉價計算機那一條公式。出場價如果落在爆倉價上或更遠的地方，倉位撐不到那裡。這時結果會直接說明，而不是印出一個比保證金還大的虧損。',
      leftOut:
        '這裡沒有算進去的：滑價、進出場適用不同費率（掛單與吃單）、每次結算都在變的資金費率，以及分批平倉。請把結果當成估計值，實際數字以交易所的對帳紀錄為準。',
    },
    examples: {
      first: '例題 1：{lev} 倍多單，持倉經過 {periods} 次結算',
      second: '例題 2：用保證金決定大小的空單，結果是虧損',
      setupQuantity: '做多 {qty} BTC，槓桿 {lev} 倍。進場價 {entry}，出場價 {exit}。單邊手續費率 {fee}，經過 {periods} 次結算、每次資金費率 {rate}。',
      setupMargin:
        '做空，保證金 {margin} USDT，槓桿 {lev} 倍。進場價 {entry}，出場價 {exit}。單邊手續費率 {fee}，經過 {periods} 次結算、每次資金費率 {rate}。',
      workNotional: '倉位價值 = {qty} × {entry} = {notional} USDT',
      workNotionalMargin: '倉位價值 = {margin} × {lev} = {notional} USDT',
      workQuantity: '數量 = {notional} ÷ {entry} = {qty} BTC',
      workMargin: '保證金 = {notional} ÷ {lev} = {margin} USDT',
      workGrossLong: '未扣費損益 = {qty} × ({exit} − {entry}) = {gross} USDT',
      workGrossShort: '未扣費損益 = {qty} × ({entry} − {exit}) = {gross} USDT',
      workFee: '手續費 = {qty} × ({entry} + {exit}) × {fee} = {feeAmount} USDT',
      workFundingPaid: '付出的資金費 = {notional} × {rate} × {periods} = {fundingAbs} USDT',
      workFundingReceived: '收到的資金費 = {notional} × {rate} × {periods} = {fundingAbs} USDT',
      workNet: '淨損益 = {gross} − {feeAmount} {fundingSign} {fundingAbs} = {net} USDT',
      workRoi: '對保證金的報酬率 = {net} ÷ {margin} = {roi}',
      resultWin:
        '這筆單賺 {net} USDT，對保證金是 {roi}，對倉位價值是 {roiNotional}。價格變動帶來的 {gross} USDT 裡，手續費和資金費拿走了 {costsAbs} USDT。{lev} 倍的爆倉價是 {liq}。',
      resultLoss:
        '這筆單是虧損：{net} USDT，對保證金是 {roi}。光是價格變動就是 {gross} USDT，手續費讓虧損再多 {feeAmount} USDT，收到的資金費則抵掉 {fundingAbs} USDT。{lev} 倍的爆倉價是 {liq}，比出場價更遠，所以出場時倉位還在。',
    },
    mistakes: [
      {
        title: '把對保證金的報酬率當成價格漲跌',
        text: '例題 1 的價格動了 {move}，在 {lev} 倍下看起來是保證金的 {grossRoi}。數字變大是槓桿造成的，不是價格走得比較多；虧損的時候也是同樣的放大倍數。',
      },
      {
        title: '沒把手續費算進去',
        text: '手續費是照倉位價值收的，而且收兩次。例題 1 的手續費是 {feeAmount} USDT，保證金是 {margin} USDT，等於保證金的 {feeRoi}，不管這筆單賺還是賠都要付。',
      },
      {
        title: '抱單抱很久卻忘了資金費',
        text: '每次結算的資金費很小，但是會累積。用例子裡的費率 {rate} 計算，例題 1 的倉位經過 {manyPeriods} 次結算要付 {fundingLong} USDT。',
      },
      {
        title: '還沒扣費就當成賺錢',
        text: '價格只動一點點的話，獲利會被費用吃掉。照例題 1 的手續費和資金費，價格要走到 {breakEven}，這筆單才不賠。',
      },
      {
        title: '把出場價設在爆倉價的後面',
        text: '逐倉模式下，一個倉位賠掉的不會超過它的保證金，因為交易所會先把它平掉。例題 1 的倉位會在 {liq} 被強制平倉，低於這個價位的出場價都不是會發生的結果。',
      },
    ],
    allTools: '所有計算機',
  },
});
