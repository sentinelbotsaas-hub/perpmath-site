// Strings for /data/ and its four pages: funding rate, long/short ratio,
// open interest, liquidation.
//
// Definitions and reading notes are fixed text about how a quantity works.
// Every figure ({mmr}, {room}, {date} ...) is filled in from
// src/data/market/<SYMBOL>/latest.json. No forecasts, no direction calls.
// `live` is handed to src/scripts/market-live.ts as JSON, so it holds
// templates only.
import { defineStrings } from './strings';

export const data = defineStrings({
  en: {
    index: {
      title: 'Market data: funding, long/short ratio, open interest',
      description:
        'Four daily tables for BTCUSDT, ETHUSDT and SOLUSDT perpetuals on Bybit, each with a plain definition, the calculation behind it and 30 days of history.',
      head: 'Market data',
      sub: 'Four tables from Bybit’s public API, rebuilt once a day.',
    },
    names: {
      'funding-rate': { name: 'Funding rate', question: 'What does holding a position cost per day?' },
      'long-short-ratio': { name: 'Long/short ratio', question: 'How many accounts are long for each one short?' },
      'open-interest': { name: 'Open interest', question: 'How many contracts are open?' },
      liquidation: { name: 'Liquidation', question: 'On how many days would each leverage have been liquidated?' },
    },
    common: {
      contract: 'Contract',
      date: 'Date, UTC',
      reading: 'Reading, UTC',
      what: 'What it is',
      how: 'How it is calculated',
      read: 'How to read it',
      history: 'Last 30 days',
      now: 'Now',
      dayHead: 'Report day, {date} UTC',
      source:
        'Report day {date} UTC, data fetched {time} UTC. Figures from Bybit’s public API; the exchange is the reference.',
      daily: 'Daily reports',
      calculator: 'Liquidation price calculator',
    },
    live: {
      button: 'Fetch current values from Bybit',
      busy: 'Fetching',
      ok: 'Fetched from Bybit at {time} UTC.',
      fail: 'Could not reach Bybit. The table still shows the figures for {date}.',
      funding: '{rate}, settles {time} UTC',
      oi: '{value} {unit}',
      ratio: '{long} long, ratio {ratio}',
    },
    funding: {
      title: 'Funding rate: BTC, ETH and SOL perpetuals on Bybit',
      description:
        'Bybit funding rates for BTCUSDT, ETHUSDT and SOLUSDT: the last settlement, the 7-day average, what it costs a long per day on 1,000 USDT, and 30 days of history.',
      sub: 'What holding a perpetual costs, settlement by settlement.',
      columns: {
        latest: 'Last settlement',
        average: '7-day average',
        perDay: 'A long pays per day',
        per30: 'Per 30 days',
      },
      latestCell: '{rate} at {time}',
      usdt: '{value} USDT',
      caption:
        'Positive rate: longs pay shorts. A negative amount is paid to the long. Costs are for {notional} USDT of position value.',
      definition:
        'The funding rate is a periodic payment between traders who hold a perpetual futures contract. When the rate is positive, long positions pay short positions; when it is negative, shorts pay longs. On Bybit, BTCUSDT settles every {hours} hours, and each payment equals the position value times the rate. The exchange keeps none of it.',
      how: [
        'Last settlement: the final funding settlement stamped on {date} UTC in Bybit’s funding history.',
        '7-day average: the mean of the settlements in the seven UTC days ending {date}.',
        'Cost per day: those settlements added up ÷ 7 × {notional} USDT. Per 30 days: that figure × 30.',
      ],
      read: [
        'A rate of 0.01% per settlement, three settlements a day, costs a long 0.30 USDT a day on 1,000 USDT of position.',
        'Leverage does not change the payment. It changes the margin the payment comes out of: at 20x, 1,000 USDT of position is 50 USDT of margin, so 0.30 USDT is 0.6% of it.',
        'The 30-day figure repeats the last seven days. It is arithmetic, not a forecast.',
      ],
      historyCaption: 'Settlement rates stamped on each UTC day, added up. Positive: longs paid shorts.',
    },
    ratio: {
      title: 'Long/short ratio: BTC, ETH and SOL accounts on Bybit',
      description:
        'Share of Bybit accounts net long and net short in BTCUSDT, ETHUSDT and SOLUSDT perpetuals, the long/short ratio, its 7-day change and 30 days of history.',
      sub: 'How many accounts are long for each account that is short.',
      columns: {
        long: 'Accounts net long',
        short: 'Accounts net short',
        ratio: 'Long ÷ short',
        change: '7-day change, long share',
      },
      points: '{value} points',
      caption: 'Readings stamped {time} UTC, compared with the reading seven days earlier.',
      definition:
        'The long/short ratio compares the number of accounts holding a net long position in a contract with the number holding a net short position. Bybit publishes both shares; the long share divided by the short share is the ratio. It counts accounts, not money: one large position weighs the same as one small position.',
      how: [
        'Source: Bybit’s account-ratio endpoint, daily period. buyRatio is the share of accounts net long, sellRatio the share net short.',
        'Ratio = buyRatio ÷ sellRatio.',
        '7-day change: the long share minus the long share seven days earlier, in percentage points.',
      ],
      read: [
        'A ratio of 2 means two accounts are long for every account that is short.',
        'Every open contract has one long side and one short side, so the amount held long always equals the amount held short. Only the number of accounts on each side differs.',
        'The ratio does not say which side holds the larger positions.',
      ],
      historyCell: '{ratio} ({long})',
      historyCaption: 'Long ÷ short, with the share of accounts net long in brackets.',
    },
    oi: {
      title: 'Open interest: BTC, ETH and SOL perpetuals on Bybit',
      description:
        'Open interest of BTCUSDT, ETHUSDT and SOLUSDT perpetuals on Bybit, counted in the base coin, with the 7-day change and 30 days of daily readings.',
      sub: 'How many contracts are open, each long and short pair counted once.',
      columns: {
        latest: 'Open interest',
        weekAgo: 'Seven days earlier',
        change: '7-day change',
      },
      value: '{value} {unit}',
      caption: 'Readings stamped {time} UTC, in the base coin of each contract.',
      definition:
        'Open interest is the number of contracts open at one moment: positions that were opened and have not been closed. Every contract has a long side and a short side and is counted once. For BTCUSDT on Bybit it is measured in BTC. It rises when new positions are opened and falls when positions are closed.',
      how: [
        'Source: Bybit’s open-interest endpoint, daily interval, in the base coin.',
        'The table uses the reading stamped 00:00 UTC at the close of the report day.',
        '7-day change = (reading − reading seven days earlier) ÷ reading seven days earlier.',
      ],
      read: [
        'A rise means more contracts were opened than closed over the period. A fall means more were closed than opened.',
        'Open interest counts contracts, not direction: for every long contract there is a short one.',
        'The number is in coins. Its value in USDT also moves with price, even when no contract is opened or closed.',
      ],
      historyCaption: 'Daily readings stamped 00:00 UTC, in the base coin of each contract.',
    },
    liquidation: {
      title: 'Liquidation: how often each leverage got liquidated',
      description:
        'What liquidation is, and on how many of the last 90 days a 2x to 100x long or short in BTCUSDT, ETHUSDT or SOLUSDT would have been liquidated. Computed from Bybit candles.',
      sub: 'On how many days each leverage would have been closed out.',
      noFeed:
        'This site has no live liquidation feed and does not show a liquidation heatmap. The tables are computed from Bybit’s public daily and hourly candles: they show which positions would have been liquidated, not which ones were.',
      columns: {
        mmr: 'Maintenance margin rate',
        drop: 'Largest drop',
        rise: 'Largest rise',
        long: 'Longs survived up to',
        short: 'Shorts survived up to',
      },
      statsHead: 'Last 90 days',
      leverage: 'Leverage',
      long: 'Long, days',
      short: 'Short, days',
      statsCell: '{days} ({share})',
      notOffered: 'Not offered',
      statsCaption:
        'Days out of {days}, {from} to {to}, on which a position opened at the 00:00 UTC open would have been liquidated before the close.',
      definition:
        'Liquidation is the exchange closing a leveraged position because its margin has fallen to the maintenance margin. On isolated margin, a position opened at leverage L can lose about 1 ÷ L minus the maintenance margin rate of its entry price before that happens. For BTCUSDT at 20x, with a {mmr} rate, that distance is {room}.',
      how: [
        'Largest drop = (open − low) ÷ open. Largest rise = (high − open) ÷ open. Both use the daily candle that opens at 00:00 UTC.',
        'Room = 1 ÷ leverage − maintenance margin rate, taken from Bybit’s risk tier 1 for each contract.',
        'A long counts as liquidated when the drop reaches the room, a short when the rise does. Leverage above a contract’s limit is left out.',
      ],
      read: [
        'The count answers one question: opened at the 00:00 UTC open and held to the close, on how many of the last {days} days would this leverage have been liquidated.',
        'It is a record of past days, not a probability for the next one. An entry at another hour gives another result.',
        'Candles are last traded prices. Bybit liquidates on the mark price, so a real position can fare differently.',
      ],
      historyCell: '{lev}, {drop} / {rise}',
      historyCaption:
        'Highest leverage at which both a long and a short survived the day, then the largest drop and the largest rise from the open.',
    },
  },
  'zh-hant': {
    index: {
      title: '市場數據：資金費率、多空比、未平倉量、爆倉',
      description:
        'Bybit 的 BTCUSDT、ETHUSDT、SOLUSDT 永續合約，四張每天更新的數據表。每一頁都有白話定義、計算方式，以及過去 30 天的歷史數據。',
      head: '市場數據',
      sub: '四張表，資料來自 Bybit 公開 API，每天重建一次。',
    },
    names: {
      'funding-rate': { name: '資金費率', question: '持倉一天要付多少錢？' },
      'long-short-ratio': { name: '多空比', question: '每一個做空的帳戶，對上幾個做多的帳戶？' },
      'open-interest': { name: '未平倉量', question: '現在有多少合約還沒平倉？' },
      liquidation: { name: '爆倉', question: '每種槓桿在過去有幾天會爆倉？' },
    },
    common: {
      contract: '合約',
      date: '日期（UTC）',
      reading: '讀數時間（UTC）',
      what: '這是什麼',
      how: '怎麼算的',
      read: '怎麼看',
      history: '過去 30 天',
      now: '現在',
      dayHead: '報告日 {date}（UTC）',
      source: '報告日 {date}（UTC），資料抓取時間 {time}（UTC）。數字來自 Bybit 公開 API，一切以交易所為準。',
      daily: '每日報告',
      calculator: '爆倉價計算機',
    },
    live: {
      button: '向 Bybit 抓取目前數值',
      busy: '抓取中',
      ok: '已在 {time}（UTC）從 Bybit 取得。',
      fail: '連不上 Bybit。表格顯示的仍是 {date} 的數字。',
      funding: '{rate}，{time}（UTC）結算',
      oi: '{value} {unit}',
      ratio: '多單 {long}，多空比 {ratio}',
    },
    funding: {
      title: '資金費率：Bybit 的 BTC、ETH、SOL 永續合約',
      description:
        'Bybit 上 BTCUSDT、ETHUSDT、SOLUSDT 的資金費率：最近一次結算、7 日平均、持有 1,000 USDT 多單每天要付多少，以及過去 30 天的歷史數據。',
      sub: '持有永續合約的成本，一次結算一次結算地算。',
      columns: {
        latest: '最近一次結算',
        average: '7 日平均',
        perDay: '多單每天付出',
        per30: '30 天付出',
      },
      latestCell: '{rate}（{time}）',
      usdt: '{value} USDT',
      caption: '費率為正：多單付給空單。金額為負代表多單收到這筆錢。成本以 {notional} USDT 的倉位價值計算。',
      definition:
        '資金費率是永續合約持倉者之間定期互相支付的一筆錢。費率為正，多單付給空單；費率為負，空單付給多單。Bybit 的 BTCUSDT 每 {hours} 小時結算一次，每次的金額是倉位價值乘上費率。這筆錢交易所不抽成。',
      how: [
        '最近一次結算：Bybit 資金費率歷史中，時間落在 {date}（UTC）的最後一次結算。',
        '7 日平均：到 {date} 為止七個 UTC 日內，所有結算費率的平均值。',
        '每天付出：這些結算費率加總 ÷ 7 × {notional} USDT。30 天付出：再乘以 30。',
      ],
      read: [
        '每次結算 0.01%、一天結算三次，持有 1,000 USDT 的多單一天要付 0.30 USDT。',
        '槓桿不會改變這筆金額，改變的是它相對於保證金的比例：20 倍槓桿下，1,000 USDT 的倉位只用了 50 USDT 保證金，0.30 USDT 就是保證金的 0.6%。',
        '30 天的數字只是把最近七天重複計算，是算術，不是預測。',
      ],
      historyCaption: '每個 UTC 日內的結算費率加總。正數代表多單付給空單。',
    },
    ratio: {
      title: '多空比：Bybit 的 BTC、ETH、SOL 帳戶多空比例',
      description:
        'Bybit 上 BTCUSDT、ETHUSDT、SOLUSDT 永續合約的淨多單帳戶與淨空單帳戶比例、多空比、7 日變化，以及過去 30 天的歷史數據。',
      sub: '每一個做空的帳戶，對上幾個做多的帳戶。',
      columns: {
        long: '淨多單帳戶',
        short: '淨空單帳戶',
        ratio: '多 ÷ 空',
        change: '多單佔比 7 日變化',
      },
      points: '{value} 個百分點',
      caption: '讀數時間 {time}（UTC），與七天前的讀數比較。',
      definition:
        '多空比比較的是：一個合約裡，持有淨多單的帳戶數與持有淨空單的帳戶數。Bybit 公佈這兩個比例，多單比例除以空單比例就是多空比。它算的是帳戶數，不是資金量：一個大倉位和一個小倉位都只算一個帳戶。',
      how: [
        '來源：Bybit 的 account-ratio 端點，日線週期。buyRatio 是淨多單帳戶的比例，sellRatio 是淨空單帳戶的比例。',
        '多空比 = buyRatio ÷ sellRatio。',
        '7 日變化：多單帳戶比例減去七天前的多單帳戶比例，單位是百分點。',
      ],
      read: [
        '多空比是 2，代表每一個做空的帳戶，對上兩個做多的帳戶。',
        '每一張未平倉的合約都有一個多方和一個空方，所以多單總量永遠等於空單總量，不一樣的只有兩邊的帳戶數。',
        '多空比看不出哪一邊的倉位比較大。',
      ],
      historyCell: '{ratio}（{long}）',
      historyCaption: '多 ÷ 空，括號內是淨多單帳戶的比例。',
    },
    oi: {
      title: '未平倉量：Bybit 的 BTC、ETH、SOL 永續合約',
      description:
        'Bybit 上 BTCUSDT、ETHUSDT、SOLUSDT 永續合約的未平倉量，以各合約的基礎幣計算，附 7 日變化與過去 30 天的每日讀數。',
      sub: '還沒平倉的合約有多少，一多一空只算一次。',
      columns: {
        latest: '未平倉量',
        weekAgo: '七天前',
        change: '7 日變化',
      },
      value: '{value} {unit}',
      caption: '讀數時間 {time}（UTC），單位是各合約的基礎幣。',
      definition:
        '未平倉量是某一個時間點上還沒平倉的合約數量，也就是已經開倉、尚未平掉的倉位。每一張合約都有一個多方和一個空方，只算一次。Bybit 的 BTCUSDT 以 BTC 為單位。有人開新倉時它會增加，有人平倉時它會減少。',
      how: [
        '來源：Bybit 的 open-interest 端點，日線間隔，單位是基礎幣。',
        '表格用的是報告日收盤那一刻、時間標為 00:00（UTC）的讀數。',
        '7 日變化 =（讀數 − 七天前的讀數）÷ 七天前的讀數。',
      ],
      read: [
        '數字增加，代表這段期間新開的合約比平掉的多；數字減少，代表平掉的比新開的多。',
        '未平倉量算的是合約數量，沒有方向：每一張多單都對應一張空單。',
        '單位是幣。換算成 USDT 的價值還會跟著價格變動，就算沒有任何合約開倉或平倉也一樣。',
      ],
      historyCaption: '每天 00:00（UTC）的讀數，單位是各合約的基礎幣。',
    },
    liquidation: {
      title: '爆倉：每種槓桿在過去有幾天會被強制平倉',
      description:
        '爆倉是什麼，以及過去 90 天裡，BTCUSDT、ETHUSDT、SOLUSDT 的 2 倍到 100 倍多單與空單各有幾天會爆倉。全部由 Bybit 公開 K 線算出。',
      sub: '每種槓桿在過去有幾天會被強制平倉。',
      noFeed:
        '本站沒有即時的爆倉資料流，也不提供清算地圖（清算熱力圖）。這裡的表格都是用 Bybit 公開的日線和小時線算出來的：顯示的是哪些倉位「會」爆倉，不是實際上哪些倉位爆倉了。',
      columns: {
        mmr: '維持保證金率',
        drop: '最大跌幅',
        rise: '最大漲幅',
        long: '多單撐住的最高槓桿',
        short: '空單撐住的最高槓桿',
      },
      statsHead: '過去 90 天',
      leverage: '槓桿',
      long: '多單（天）',
      short: '空單（天）',
      statsCell: '{days}（{share}）',
      notOffered: '不提供',
      statsCaption: '{from} 到 {to} 共 {days} 天裡，以 00:00（UTC）開盤價進場的倉位在收盤前會被強制平倉的天數。',
      definition:
        '爆倉就是強制平倉：槓桿倉位的保證金跌到只剩維持保證金時，交易所會把倉位強制平掉。逐倉模式下，以 L 倍槓桿開的倉位，價格大約可以逆向走進場價的 1 ÷ L 減去維持保證金率，之後就會爆倉。以 BTCUSDT 的 20 倍、維持保證金率 {mmr} 來算，這段距離是 {room}。',
      how: [
        '最大跌幅 =（開盤 − 最低）÷ 開盤。最大漲幅 =（最高 − 開盤）÷ 開盤。兩者都用 00:00（UTC）開盤的日線。',
        '空間 = 1 ÷ 槓桿 − 維持保證金率，維持保證金率取自 Bybit 各合約風險級距的第 1 級。',
        '跌幅達到空間，多單就算爆倉；漲幅達到空間，空單就算爆倉。超過合約槓桿上限的倍數不列入。',
      ],
      read: [
        '這個天數只回答一個問題：以 00:00（UTC）開盤價進場並持有到收盤，過去 {days} 天裡有幾天這個槓桿會爆倉。',
        '這是過去的紀錄，不是下一天的機率。換一個時間進場，結果就不一樣。',
        'K 線用的是最新成交價。Bybit 實際以標記價格判斷強制平倉，真實倉位的結果可能不同。',
      ],
      historyCell: '{lev}，{drop} / {rise}',
      historyCaption: '當天多單和空單都撐住的最高槓桿，後面是從開盤價算起的最大跌幅與最大漲幅。',
    },
  },
});
