// Strings for /tools/dca-calculator/.
// `ui` is handed to src/scripts/dca-calculator.ts as JSON, so it holds
// templates only. Every number is filled in from the inputs, the calc library
// or the risk-limit snapshot ({mmr}, {limit}, {date}).
import { defineStrings } from './strings';

export const dca = defineStrings({
  en: {
    title: 'Crypto DCA calculator',
    description:
      'Average price after several buys, or after adding to a futures position. For a BTCUSDT perpetual: the new liquidation price and how much larger the position gets.',
    lede: 'Your average price after buying in several steps. For a BTCUSDT perpetual on Bybit, isolated margin, also where the liquidation price ends up.',
    noscript:
      'The calculator needs JavaScript. What you see is the first worked example; the formula and examples below can be done on paper.',
    fields: {
      mode: 'Position type',
      modeFutures: 'Perpetual',
      modeSpot: 'Spot',
      unit: 'Size of each fill',
      unitQuantity: 'Quantity',
      unitAmount: 'Amount in USDT',
      side: 'Side',
      long: 'Long',
      short: 'Short',
      leverage: 'Leverage',
      leverageUnit: 'x',
      fills: 'Fills, in the order they happen',
      fill: 'Fill {n}',
      price: 'Price',
      quantity: 'Quantity',
      amount: 'Amount',
      coin: 'BTC',
      coinSpot: 'coins',
      add: 'Add a fill',
      remove: 'Remove',
      removeLabel: 'Remove fill {n}',
    },
    assumption:
      'The liquidation price uses the risk tier 1 maintenance margin rate of {mmr}, for positions up to {limit} USDT (Bybit data from {date}).',
    ui: {
      levText: '{value}x',
      labelFutures: 'Average entry price',
      labelSpot: 'Average cost',
      figure: '{price} USDT',
      fill: 'Fill {n}',
      removeLabel: 'Remove fill {n}',
      quantity: 'Quantity',
      amount: 'Amount',
      coin: 'BTC',
      coinSpot: 'coins',
      spotOne: 'One buy: the average cost is its price. Add a fill to see the average move.',
      spot: '{n} buys add up to {qty} {coin} for {cost} USDT, an average cost of {avg}. That is {vs} against the first buy, on a holding that cost {multiple} times as much.',
      futuresOne:
        'One fill: the average is its price, and at {lev}x the liquidation price is {liq}. Add a fill to see both move.',
      long: 'Long {qty} BTC in {n} fills, average entry {avg}. At {lev}x the liquidation price is {liq}; with the first fill alone it was {firstLiq}. The margin that can be lost went from {firstMargin} to {margin} USDT.',
      short:
        'Short {qty} BTC in {n} fills, average entry {avg}. At {lev}x the liquidation price is {liq}; with the first fill alone it was {firstLiq}. The margin that can be lost went from {firstMargin} to {margin} USDT.',
      liquidated:
        'Fill {row} at {price} lies beyond {liq}, the liquidation price at {lev}x of the position held before it. That position would have been closed before price got there, so this fill could not be added to it. Lower the leverage or change the fill.',
      usdt: '{value} USDT',
      times: '{value}x',
      freshRow: 'Entry to liquidation, new position at {lev}x',
      barItem: 'fill {n} at {price} is {share}',
      barJoin: ', ',
      barCaption:
        'One bar per fill, on a scale that starts at 0. The full width is the total quantity of {qty} {coin}: {list}. The average price is the fill prices weighted by these shares.',
      barsOff: 'No bars are drawn: these fills do not add up to one position.',
      tier: 'This position is worth {value} USDT, above the tier 1 limit of {limit} USDT. Past that limit Bybit raises the maintenance margin rate step by step, so the real liquidation price is closer than shown. This calculator does not model the higher tiers.',
      added: 'Fill {n} added.',
      removed: 'Fill {n} removed. {left} left.',
      full: 'This calculator takes at most {max} fills.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        price: 'Enter a price above 0.',
        size: 'Enter a size above 0.',
        leverage: 'Leverage must be between 1 and {max}.',
        noRoom:
          'At {lev}x the initial margin is not larger than the maintenance margin, so the position would be closed at once. Lower the leverage.',
      },
    },
    result: {
      caption: 'The rest of the result',
      quantity: 'Total quantity',
      cost: 'Total cost of the fills',
      vsFirst: 'Average against the first fill',
      multiple: 'Cost against the first fill',
      unrealized: 'P&L at the price of the last fill',
      toAverage: 'From the last fill back to the average',
      margin: 'Margin locked',
      firstLiq: 'Liquidation price, first fill only',
      liq: 'Liquidation price, all fills',
      room: 'Last fill price to liquidation',
      bars: 'Share of the total quantity',
    },
    assumptions: [
      'Every fill uses the same leverage, so the average price is the entry price of the whole position and the margin is the total cost ÷ leverage.',
      'For a perpetual, an amount is the position value of the fill, not its margin.',
      'Fees, funding and slippage are left out.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro: 'The average is a weighted one: each price counts by the quantity bought at it.',
      lines: [
        'cost of a fill = price × quantity',
        'average price = sum of costs ÷ sum of quantities',
        'quantity of a fill given as an amount = amount ÷ price',
      ],
      futuresIntro:
        'For a perpetual the average price becomes the entry price of the whole position. The liquidation price is not a new formula: it is the one from the liquidation price calculator, with the average price as the entry.',
      futuresLines: [
        'margin = sum of costs ÷ leverage',
        'liquidation price, long = average price × (1 − 1 ÷ leverage + maintenance margin rate)',
        'liquidation price, short = average price × (1 + 1 ÷ leverage − maintenance margin rate)',
      ],
      terms: [
        { term: 'Fill', text: 'One purchase, or one order that adds to the position: a price and a size.' },
        {
          term: 'Average price',
          text: 'What the whole position cost per unit. Price has to come back to it for the position to break even, before fees.',
        },
        {
          term: 'Share',
          text: 'A fill’s quantity divided by the total quantity. The larger the share, the closer the average sits to the price of that fill.',
        },
        {
          term: 'Maintenance margin rate',
          text: '{mmr} in risk tier 1, for positions up to {limit} USDT (Bybit data from {date}).',
        },
      ],
      tradeoffTitle: 'A lower average comes with a larger position',
      tradeoff:
        'A fill below the average pulls the average down, so price has less far to come back. The same fill makes the position larger: more money moves with the next tick, and for a perpetual more margin is lost if the position is liquidated. If price keeps going the wrong way, the loss now grows on the larger position. The calculator shows both sides. It does not say that adding to a losing position is a good idea.',
      leftOut:
        'What this leaves out: the fee on every fill, funding paid while the position is open, and the exchange’s quantity step. Above risk tier 1 the maintenance margin rate rises and the real liquidation price is closer than shown. On cross margin the liquidation price depends on the whole account, which this page does not model.',
    },
    examples: {
      first: 'Example 1: a {lev}x long, added to twice on the way down',
      second: 'Example 2: spot, the same amount three times',
      fillQuantity: '{qty} BTC at {price}',
      join: ', ',
      setupFutures: 'Long at {lev}x. Fills: {fills}.',
      setupSpot: 'Spot. {amount} USDT each time, at {prices}.',
      workCost: 'sum of costs = {costs} = {cost} USDT',
      workQuantity: 'sum of quantities = {qtys} = {qty} BTC',
      workAverage: 'average price = {cost} ÷ {qty} = {avg}',
      workMargin: 'margin = {cost} ÷ {lev} = {margin} USDT',
      workLiqFirst: 'liquidation price, first fill only = {first} × {factor} = {firstLiq}',
      workLiq: 'liquidation price, all fills = {avg} × {factor} = {liq}',
      workQuantityAmount: 'sum of quantities = {parts} = {qty}',
      workAverageSpot: 'average cost = {cost} ÷ {qty} = {avg}',
      workMean: 'plain mean of the prices = {mean}',
      resultFutures:
        'The average came down from {first} to {avg} and the liquidation price moved from {firstLiq} to {liq}. The position grew from {firstCost} to {cost} USDT, and the margin that can be lost from {firstMargin} to {margin} USDT. From the last fill at {last}, liquidation is {room} away; a new {lev}x position has {fresh}.',
      resultSpot:
        'The average cost is {avg}, below the plain mean of {mean}, because the same amount buys more units at the lower prices. At the last price of {last} the holding is worth {value} USDT against {cost} USDT paid: {pnl} USDT.',
    },
    mistakes: [
      {
        title: 'Averaging the prices',
        text: 'The average price is not the mean of the fill prices unless every fill has the same quantity. In example 1 the plain mean is {mean}; the average price is {avg}, because half of the quantity was bought at {last}.',
      },
      {
        title: 'Reading a lower average as a smaller loss',
        text: 'Adding does not undo the loss on the earlier fills. In example 1 the position is at {pnl} USDT at the price of the last fill, exactly where it was before that fill. What changed is how far price has to come back, and how much is at stake if it does not.',
      },
      {
        title: 'Reading the new liquidation price as more room',
        text: 'The liquidation price moved away from the first entry, but price has moved as well. In example 1 the last fill at {last} is {room} from liquidation, where a new {lev}x position has {fresh}. The margin lost at liquidation is now {margin} USDT, not {firstMargin}.',
      },
      {
        title: 'Typing the margin as the amount',
        text: 'For a perpetual, an amount here is the position value of the fill. At {lev}x a fill of {amountEx} USDT locks {marginEx} USDT of margin. Typing the margin instead understates the position {lev} times.',
      },
      {
        title: 'Adding without a limit set beforehand',
        text: 'Every fill raises what the next move against you costs. This page can tell you the average and the liquidation price after a fill. It cannot tell you whether price will come back.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: 'DCA 均價計算機',
    description:
      '分幾次買進或加倉之後，算出平均成本。BTCUSDT 永續合約會另外算出加倉後的平均進場價與新的爆倉價，並顯示部位和保證金被放大了多少，每一筆佔多少比例照實畫出來。',
    lede: '分批買進之後的平均成本。如果是 Bybit 的 BTCUSDT 永續合約（逐倉），再算出加倉後爆倉價移到哪裡。',
    noscript: '這個計算機需要 JavaScript。現在看到的是第一個例題；下方的公式和例題可以自己用紙筆算。',
    fields: {
      mode: '部位類型',
      modeFutures: '永續合約',
      modeSpot: '現貨',
      unit: '每一筆的大小',
      unitQuantity: '數量',
      unitAmount: '金額（USDT）',
      side: '方向',
      long: '做多',
      short: '做空',
      leverage: '槓桿',
      leverageUnit: '倍',
      fills: '各筆成交，照發生的順序填',
      fill: '第 {n} 筆',
      price: '價格',
      quantity: '數量',
      amount: '金額',
      coin: 'BTC',
      coinSpot: '顆',
      add: '新增一筆',
      remove: '移除',
      removeLabel: '移除第 {n} 筆',
    },
    assumption:
      '爆倉價用的是風險級距第 1 級的維持保證金率 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 資料日期 {date}）。',
    ui: {
      levText: '{value} 倍',
      labelFutures: '平均進場價',
      labelSpot: '平均成本',
      figure: '{price} USDT',
      fill: '第 {n} 筆',
      removeLabel: '移除第 {n} 筆',
      quantity: '數量',
      amount: '金額',
      coin: 'BTC',
      coinSpot: '顆',
      spotOne: '只有一筆，平均成本就是它的價格。再新增一筆，就能看到均價怎麼移動。',
      spot: '買了 {n} 筆，一共 {qty} {coin}，花了 {cost} USDT，平均成本 {avg}。和第一筆的價格相比是 {vs}，投入的金額則是第一筆的 {multiple} 倍。',
      futuresOne: '只有一筆，均價就是它的價格，{lev} 倍的爆倉價是 {liq}。再新增一筆，就能看到兩個數字怎麼移動。',
      long: '做多 {n} 筆共 {qty} BTC，平均進場價 {avg}。{lev} 倍的爆倉價是 {liq}，只有第一筆的時候是 {firstLiq}。爆倉時會賠掉的保證金從 {firstMargin} 變成 {margin} USDT。',
      short:
        '做空 {n} 筆共 {qty} BTC，平均進場價 {avg}。{lev} 倍的爆倉價是 {liq}，只有第一筆的時候是 {firstLiq}。爆倉時會賠掉的保證金從 {firstMargin} 變成 {margin} USDT。',
      liquidated:
        '第 {row} 筆的價格 {price} 已經越過 {liq}，也就是前面那些部位在 {lev} 倍時的爆倉價。價格走到這裡之前，原本的倉位就已經被強制平倉，這一筆沒辦法加在它上面。請調低槓桿，或修改這一筆。',
      usdt: '{value} USDT',
      times: '{value} 倍',
      freshRow: '{lev} 倍新開倉到爆倉價',
      barItem: '第 {n} 筆（{price}）佔 {share}',
      barJoin: '、',
      barCaption:
        '每一筆一條橫條，比例尺從 0 開始，整條代表總數量 {qty} {coin}：{list}。平均價格就是各筆價格照這些比例加權的結果。',
      barsOff: '這幾筆組不成同一個倉位，所以沒有畫橫條。',
      tier: '這個倉位價值 {value} USDT，超過第 1 級的上限 {limit} USDT。超過之後 Bybit 會逐級提高維持保證金率，實際的爆倉價會比這裡顯示的更近。這個計算機沒有計入較高的級距。',
      added: '已新增第 {n} 筆。',
      removed: '已移除第 {n} 筆，還有 {left} 筆。',
      full: '這個計算機最多接受 {max} 筆。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        price: '價格要大於 0。',
        size: '大小要大於 0。',
        leverage: '槓桿要在 1 到 {max} 之間。',
        noRoom: '{lev} 倍時，起始保證金沒有比維持保證金多，一開倉就會被強制平倉。請調低槓桿。',
      },
    },
    result: {
      caption: '其他結果',
      quantity: '總數量',
      cost: '各筆成本合計',
      vsFirst: '均價和第一筆相比',
      multiple: '成本是第一筆的幾倍',
      unrealized: '最後一筆價位的損益',
      toAverage: '從最後一筆價位回到均價',
      margin: '鎖住的保證金',
      firstLiq: '只有第一筆時的爆倉價',
      liq: '全部加完之後的爆倉價',
      room: '最後一筆價位到爆倉價',
      bars: '各筆佔總數量的比例',
    },
    assumptions: [
      '每一筆都用同一個槓桿，所以平均價格就是整個倉位的進場價，保證金是成本合計 ÷ 槓桿。',
      '永續合約的「金額」指的是這一筆的倉位價值，不是保證金。',
      '沒有計入手續費、資金費和滑價。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '平均價格是加權平均：在某個價格買得越多，那個價格的份量就越重。',
      lines: ['一筆的成本 = 價格 × 數量', '平均價格 = 各筆成本的總和 ÷ 各筆數量的總和', '用金額輸入時，一筆的數量 = 金額 ÷ 價格'],
      futuresIntro:
        '永續合約加倉之後，平均價格就是整個倉位的進場價。爆倉價沒有另外的公式，用的就是爆倉價計算機那一條，只是把進場價換成平均價格。',
      futuresLines: [
        '保證金 = 各筆成本的總和 ÷ 槓桿',
        '做多的爆倉價 = 平均價格 × (1 − 1 ÷ 槓桿 + 維持保證金率)',
        '做空的爆倉價 = 平均價格 × (1 + 1 ÷ 槓桿 − 維持保證金率)',
      ],
      terms: [
        { term: '一筆', text: '一次買進，或一張加倉的委託：一個價格加上一個大小。' },
        { term: '平均價格', text: '整個部位平均每一單位花了多少錢。價格要回到這裡，部位才會損益兩平（還沒算手續費）。' },
        { term: '比例', text: '這一筆的數量除以總數量。比例越大，均價就越靠近這一筆的價格。' },
        { term: '維持保證金率', text: '風險級距第 1 級是 {mmr}，適用倉位價值 {limit} USDT 以下（Bybit 資料日期 {date}）。' },
      ],
      tradeoffTitle: '均價變低的同時，部位也變大了',
      tradeoff:
        '在均價下方加一筆，均價會被往下拉，價格需要彈回來的距離就變短。同一筆也讓部位變大：之後價格每動一下，牽動的錢更多；如果是永續合約，被強制平倉時賠掉的保證金也更多。價格要是繼續往不利的方向走，虧損是照變大之後的部位在累積。這個計算機把兩邊的數字都列出來，但它沒有說攤平是個好主意。',
      leftOut:
        '這裡沒有算進去的：每一筆的手續費、持倉期間的資金費，以及交易所的數量級距。超過風險級距第 1 級之後維持保證金率會提高，實際的爆倉價會比這裡顯示的更近。全倉模式的爆倉價取決於整個帳戶的餘額，這一頁沒有計算。',
    },
    examples: {
      first: '例題 1：{lev} 倍多單，下跌途中加倉兩次',
      second: '例題 2：現貨，同樣的金額買三次',
      fillQuantity: '{price} 買 {qty} BTC',
      join: '、',
      setupFutures: '做多，槓桿 {lev} 倍。各筆成交：{fills}。',
      setupSpot: '現貨。每次買 {amount} USDT，價格分別是 {prices}。',
      workCost: '成本合計 = {costs} = {cost} USDT',
      workQuantity: '數量合計 = {qtys} = {qty} BTC',
      workAverage: '平均價格 = {cost} ÷ {qty} = {avg}',
      workMargin: '保證金 = {cost} ÷ {lev} = {margin} USDT',
      workLiqFirst: '只有第一筆時的爆倉價 = {first} × {factor} = {firstLiq}',
      workLiq: '全部加完之後的爆倉價 = {avg} × {factor} = {liq}',
      workQuantityAmount: '數量合計 = {parts} = {qty}',
      workAverageSpot: '平均成本 = {cost} ÷ {qty} = {avg}',
      workMean: '三個價格直接平均 = {mean}',
      resultFutures:
        '均價從 {first} 降到 {avg}，爆倉價從 {firstLiq} 移到 {liq}。倉位價值從 {firstCost} 變成 {cost} USDT，爆倉時會賠掉的保證金從 {firstMargin} 變成 {margin} USDT。從最後一筆的價格 {last} 算起，離爆倉價還有 {room}；同樣 {lev} 倍新開一個倉位則有 {fresh}。',
      resultSpot:
        '平均成本是 {avg}，比三個價格直接平均的 {mean} 低，因為同樣的金額在低價買到的數量比較多。以最後一筆的價格 {last} 計算，手上的部位值 {value} USDT，付出去的是 {cost} USDT，損益是 {pnl} USDT。',
    },
    mistakes: [
      {
        title: '把價格直接平均',
        text: '除非每一筆的數量都一樣，否則平均價格不是各筆價格的算術平均。例題 1 把價格直接平均是 {mean}，實際的均價是 {avg}，因為有一半的數量是在 {last} 買的。',
      },
      {
        title: '以為均價降低，虧損就變少',
        text: '加倉不會讓前面幾筆的虧損消失。例題 1 以最後一筆的價格計算，部位的損益是 {pnl} USDT，和加這一筆之前一模一樣。改變的是價格要彈回多遠才回本，以及沒彈回來的時候押在上面的錢有多少。',
      },
      {
        title: '以為爆倉價變遠，空間就變大',
        text: '爆倉價確實離第一筆的進場價更遠了，但價格也已經走了一段。例題 1 從最後一筆的價格 {last} 算起，離爆倉價是 {room}；同樣 {lev} 倍新開的倉位則有 {fresh}。而且爆倉時賠掉的保證金是 {margin} USDT，不再是 {firstMargin}。',
      },
      {
        title: '把保證金當成金額輸入',
        text: '永續合約在這裡輸入的金額是這一筆的倉位價值。{lev} 倍時，一筆 {amountEx} USDT 的倉位鎖住的保證金是 {marginEx} USDT。如果輸入的是保證金，算出來的部位只有實際的 {lev} 分之一。',
      },
      {
        title: '加倉之前沒有先設上限',
        text: '每加一筆，價格下一次往不利方向走的代價就更高。這一頁能告訴你加完之後的均價和爆倉價，沒辦法告訴你價格會不會回來。',
      },
    ],
    allTools: '所有計算機',
  },
});
