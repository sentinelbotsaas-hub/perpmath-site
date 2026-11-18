// Strings for the home page. `{name}` placeholders are filled with fmt().
// The hero strings are also handed to src/scripts/home-hero.ts through a data
// attribute, which is why they are templates and not functions.
import { defineStrings } from './strings';

export const home = defineStrings({
  en: {
    title: 'perpmath: perpetual futures math, drawn to scale',
    description:
      'Free calculators for crypto perpetual futures. See how little room your leverage leaves before liquidation, with every number drawn at its true proportion.',
    hero: {
      // {lev} is the leverage written with levFormat, e.g. "20x"
      head: '{lev} leaves you this much room.',
      levFormat: '{n}x',
      levUnit: 'x',
      barLabel: 'The light part of the bar is how far price can move before liquidation: {pct} of the entry price.',
      liquidation: 'Liquidation {price}',
      entry: 'Entry {price} is the full width',
      sub: 'Price moves {pct} against you and the exchange closes the position.',
      leverage: 'Leverage',
      leverageNumber: 'Leverage, typed as a number from 2 to 100',
      sliderText: '{lev}, {pct} of room',
      primary: 'Open the calculator',
      secondary: 'See how it is calculated',
      fine: 'Example: a BTCUSDT long on Bybit, isolated margin, {mmr} maintenance margin rate (tier 1, Bybit data from {date}).',
    },
    recover: {
      head: 'Lose 50% and you need 100% to get back.',
      lost: 'Lost, 50%',
      needed: 'Needed to recover, 100%',
      body: 'A loss and its recovery start from different bases. Half of 100 is 50; from 50 back to 100 is a double.',
      link: 'Open the drawdown calculator',
      coming: 'The drawdown calculator is being built.',
    },
    tools: {
      head: 'Each calculator answers one question.',
      sub: 'Free, no account. What you type never leaves your browser.',
    },
  },
  'zh-hant': {
    title: 'perpmath：照比例畫出來的永續合約數學',
    description:
      '免費的加密貨幣永續合約計算機。你開的槓桿離爆倉還剩多少空間，這裡照真實比例畫給你看。不用註冊，所有計算都在你的瀏覽器裡完成。',
    hero: {
      head: '{lev}槓桿，只剩這麼一點空間。',
      levFormat: '{n} 倍',
      levUnit: '倍',
      barLabel: '橫條淺色的部分，是價格在爆倉前還能走的距離：進場價的 {pct}。',
      liquidation: '爆倉價 {price}',
      entry: '整條代表進場價 {price}',
      sub: '價格只要逆向走 {pct}，交易所就會把你的倉位強制平倉。',
      leverage: '槓桿',
      leverageNumber: '槓桿倍數，直接輸入 2 到 100 的數字',
      sliderText: '{lev}，剩 {pct} 的空間',
      primary: '打開爆倉價計算機',
      secondary: '看它是怎麼算的',
      fine: '範例：Bybit 的 BTCUSDT 多單、逐倉，用簡化公式計算，維持保證金率 {mmr}（風險級距第 1 級，Bybit 資料日期 {date}）。',
    },
    recover: {
      head: '虧掉 50%，要賺 100% 才能回本。',
      lost: '虧掉 50%',
      needed: '回本要賺 100%',
      body: '虧損和回本是從不同的起點算的。100 虧掉一半剩 50，從 50 回到 100 卻要整整翻一倍。',
      link: '打開回撤計算機',
      coming: '回撤計算機還在製作中。',
    },
    tools: {
      head: '每個計算機只回答一個問題。',
      sub: '免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    },
  },
});
