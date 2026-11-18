// Strings for /daily/ and /daily/<coin>/ (and the dated archive pages).
//
// Every sentence here is a template. The numbers ({drop}, {hour}, {safe} ...)
// come from src/data/market/<SYMBOL>/*.json, which scripts/fetch-market.mjs
// computes from Bybit's public API. Nothing in this file states a market
// fact, a forecast or a direction.
import { defineStrings } from './strings';

export const daily = defineStrings({
  en: {
    coins: {
      btc: 'Bitcoin',
      eth: 'Ethereum',
      sol: 'Solana',
    },
    lev: '{n}x',
    none: 'None',
    index: {
      title: 'Daily reports: BTC, ETH and SOL perpetuals in numbers',
      description:
        'One report a day for BTCUSDT, ETHUSDT and SOLUSDT perpetuals on Bybit: the largest move against longs and shorts, and the leverage that would have been liquidated.',
      head: 'Daily reports',
      sub: '{date} UTC, three Bybit perpetuals, computed from public candles.',
      columns: {
        contract: 'Contract',
        open: 'Open',
        close: 'Close',
        drop: 'Largest drop',
        rise: 'Largest rise',
        survived: 'Survived both ways up to',
        funding: 'Funding, 7-day average',
      },
      caption:
        'Drop and rise are measured from the 00:00 UTC open. “Survived both ways” is the highest leverage at which neither a long nor a short opened at that open would have been liquidated.',
      toData: 'Market data tables',
    },
    report: {
      title: '{name} ({symbol}) daily report: leverage survival table',
      datedTitle: '{name} ({symbol}) report for {date}',
      description:
        'The last full UTC day of the {symbol} perpetual on Bybit: the largest move against longs and shorts, which leverage got liquidated, funding and open interest.',
      head: '{name} daily report',
      lede: '{date} UTC. From the open at {open}, {symbol} fell as much as {drop} and rose as much as {rise}.',
      barsLabel: 'Survival by leverage',
      room: 'room {pct}',
      barLabel:
        'At {lev} the room is {room} of the daily open. The largest drop was {drop} and the largest rise was {rise}.',
      longSurvived: 'Long survived',
      longLiquidated: 'Long liquidated, {hour} UTC hour',
      shortSurvived: 'Short survived',
      shortLiquidated: 'Short liquidated, {hour} UTC hour',
      legend:
        'Each bar is the daily open. The light part is the room at that leverage: 1 ÷ leverage − {mmr} maintenance margin rate. Upper mark: largest drop, (open − low) ÷ open. Lower mark: largest rise, (high − open) ÷ open. A mark at or past the end of the light part is a liquidation.',
      verdictLabel: 'Highest leverage that survived both ways',
      long: {
        allSurvived: 'Every long from {min}x to {max}x opened at the daily open survived.',
        mixed:
          'A {safe}x long opened at the daily open survived; a {dead}x long was liquidated in the {hour} UTC hour.',
        allLiquidated:
          'Every long from {min}x to {max}x opened at the daily open was liquidated, the {min}x one in the {hour} UTC hour.',
      },
      short: {
        allSurvived: 'Every short from {min}x to {max}x survived.',
        mixed: 'A {safe}x short survived; a {dead}x short was liquidated in the {hour} UTC hour.',
        allLiquidated:
          'Every short from {min}x to {max}x was liquidated, the {min}x one in the {hour} UTC hour.',
      },
      calculator: 'Open the liquidation calculator',
      history: {
        head: 'Last 90 days',
        leverage: 'Leverage',
        long: 'Long liquidated',
        short: 'Short liquidated',
        cell: '{days} of {total}, {share}',
        caption:
          '{from} to {to}. Days out of {total} on which a position opened at that day’s 00:00 UTC open, on isolated margin with a {mmr} maintenance margin rate, would have been liquidated before the day closed.',
        link: 'Liquidation data for all three contracts',
      },
      numbersHead: 'Funding, open interest, accounts',
      funding: {
        head: 'Funding rate',
        latest: 'Last settlement, {time} UTC',
        average: '7-day average per settlement',
        perDay: 'A long pays per day on {notional} USDT',
        per30: 'Per 30 days at that pace',
        usdt: '{value} USDT',
        note: 'Positive rate: longs pay shorts. A negative amount is paid to the long. Daily cost = the last 7 days of settlements added up ÷ 7 × {notional} USDT.',
        link: 'Funding rate data',
      },
      oi: {
        head: 'Open interest',
        latest: 'Reading at {time} UTC',
        weekAgo: 'Seven days earlier',
        change: '7-day change',
        value: '{value} {unit}',
        link: 'Open interest data',
      },
      ratio: {
        head: 'Long/short ratio',
        long: 'Accounts net long',
        short: 'Accounts net short',
        ratio: 'Long ÷ short, at {time} UTC',
        change: '7-day change in the long share',
        points: '{value} points',
        link: 'Long/short ratio data',
      },
      source: 'Data fetched {time} UTC. Figures from Bybit’s public API; the exchange is the reference.',
      method:
        'Candles are last traded prices and the test uses the simplified isolated-margin formula. Bybit liquidates on the mark price, so a real position can fare differently.',
      permalink: 'Permanent address of this report',
      earlier: 'Earlier reports',
      latest: 'Latest {name} report',
      all: 'All daily reports',
    },
  },
  'zh-hant': {
    coins: {
      btc: '比特幣',
      eth: '以太幣',
      sol: 'Solana',
    },
    lev: '{n} 倍',
    none: '無',
    index: {
      title: '每日報告：用數字看 BTC、ETH、SOL 永續合約',
      description:
        'Bybit 的 BTCUSDT、ETHUSDT、SOLUSDT 永續合約每天一份報告：多單與空單各自遇到的最大逆向幅度，以及哪些槓桿倍數會被強制平倉。',
      head: '每日報告',
      sub: '{date}（UTC），三個 Bybit 永續合約，全部由公開 K 線算出。',
      columns: {
        contract: '合約',
        open: '開盤',
        close: '收盤',
        drop: '最大跌幅',
        rise: '最大漲幅',
        survived: '多空都撐住的最高槓桿',
        funding: '資金費率 7 日平均',
      },
      caption:
        '跌幅與漲幅都從 00:00（UTC）的開盤價算起。「多空都撐住」指的是：以開盤價進場的多單和空單都不會被強制平倉的最高槓桿。',
      toData: '市場數據表',
    },
    report: {
      title: '{name}走勢每日報告：{symbol} 槓桿存活表',
      datedTitle: '{name}（{symbol}）{date} 報告',
      description:
        '用數字看 Bybit {symbol} 永續合約最近一個完整 UTC 日的走勢：多單與空單各自遇到的最大逆向幅度、哪些槓桿會爆倉、過去 90 天的爆倉天數，以及資金費率、未平倉量和多空比。',
      head: '{name}每日報告',
      lede: '{date}（UTC）。{symbol} 從開盤價 {open} 算起，最多下跌 {drop}，最多上漲 {rise}。',
      barsLabel: '各槓桿的存活情況',
      room: '空間 {pct}',
      barLabel: '{lev}的空間是當日開盤價的 {room}。當天最大跌幅 {drop}，最大漲幅 {rise}。',
      longSurvived: '多單撐住',
      longLiquidated: '多單爆倉，{hour}（UTC）這一小時',
      shortSurvived: '空單撐住',
      shortLiquidated: '空單爆倉，{hour}（UTC）這一小時',
      legend:
        '每一條都代表當日開盤價。淺色部分是該槓桿離爆倉的空間：1 ÷ 槓桿 − 維持保證金率 {mmr}。上方的記號是最大跌幅，(開盤 − 最低) ÷ 開盤；下方的記號是最大漲幅，(最高 − 開盤) ÷ 開盤。記號碰到或超出淺色部分的尾端，就是爆倉。',
      verdictLabel: '多空都撐住的最高槓桿',
      long: {
        allSurvived: '以當日開盤價進場的多單，從 {min} 倍到 {max} 倍都撐住了。',
        mixed: '以當日開盤價進場的 {safe} 倍多單撐住了；{dead} 倍多單在 {hour}（UTC）這一小時爆倉。',
        allLiquidated:
          '以當日開盤價進場的多單，從 {min} 倍到 {max} 倍全部爆倉；{min} 倍的那一張在 {hour}（UTC）這一小時爆倉。',
      },
      short: {
        allSurvived: '空單從 {min} 倍到 {max} 倍都撐住了。',
        mixed: '{safe} 倍空單撐住了；{dead} 倍空單在 {hour}（UTC）這一小時爆倉。',
        allLiquidated: '空單從 {min} 倍到 {max} 倍全部爆倉；{min} 倍的那一張在 {hour}（UTC）這一小時爆倉。',
      },
      calculator: '打開爆倉價計算機',
      history: {
        head: '過去 90 天',
        leverage: '槓桿',
        long: '多單爆倉',
        short: '空單爆倉',
        cell: '{total} 天中 {days} 天，{share}',
        caption:
          '{from} 到 {to}，共 {total} 天。以當天 00:00（UTC）開盤價進場、逐倉、維持保證金率 {mmr}，收盤前會被強制平倉，就算一天。',
        link: '三個合約的爆倉數據',
      },
      numbersHead: '資金費率、未平倉量、多空比',
      funding: {
        head: '資金費率',
        latest: '最近一次結算，{time}（UTC）',
        average: '7 日平均（每次結算）',
        perDay: '持有 {notional} USDT 多單，每天付出',
        per30: '照這個速度，30 天付出',
        usdt: '{value} USDT',
        note: '費率為正：多單付給空單。金額為負代表多單收到這筆錢。每日成本 = 最近 7 天的結算費率加總 ÷ 7 × {notional} USDT。',
        link: '資金費率數據',
      },
      oi: {
        head: '未平倉量',
        latest: '{time}（UTC）的讀數',
        weekAgo: '七天前',
        change: '7 日變化',
        value: '{value} {unit}',
        link: '未平倉量數據',
      },
      ratio: {
        head: '多空比',
        long: '淨多單帳戶',
        short: '淨空單帳戶',
        ratio: '多 ÷ 空，{time}（UTC）',
        change: '多單帳戶佔比的 7 日變化',
        points: '{value} 個百分點',
        link: '多空比數據',
      },
      source: '資料抓取時間 {time}（UTC）。數字來自 Bybit 公開 API，一切以交易所為準。',
      method:
        'K 線用的是最新成交價，判斷用的是逐倉簡化公式。Bybit 實際以標記價格判斷強制平倉，真實倉位的結果可能不同。',
      permalink: '這份報告的固定網址',
      earlier: '先前的報告',
      latest: '{name}最新報告',
      all: '所有每日報告',
    },
  },
});
