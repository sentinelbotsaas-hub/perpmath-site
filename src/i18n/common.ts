// Shared UI strings: header, footer, disclosures, and the labels of the shared
// components in src/components/ui/. Only the foundation owner edits this
// file. Other areas add their own file next to it (tools.ts, daily.ts, ...)
// following the same pattern.
import { defineStrings } from './strings';

export const common = defineStrings({
  en: {
    siteName: 'perpmath',
    related: 'Related lessons',
    skipToContent: 'Skip to content',
    nav: {
      label: 'Main',
      home: 'perpmath, home',
      // Section names. Also used in breadcrumbs and JSON-LD: do not rename.
      tools: 'Tools',
      learn: 'Learn',
      daily: 'Daily',
      data: 'Data',
      bot: 'Bot',
      backtests: 'Backtests',
      language: 'Language',
      // The four groups of the main menu.
      markets: 'Markets',
      research: 'Research',
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      // Entries inside the groups: a short label and one line of description.
      items: {
        toolsAll: { label: 'All tools', desc: 'Every calculator, and the ones still being built.' },
        dataAll: { label: 'Market data', desc: 'Funding, open interest, long/short ratio and liquidation.' },
        fundingRate: { label: 'Funding rate', desc: 'What holding a position costs at each settlement.' },
        openInterest: { label: 'Open interest', desc: 'How much is still open on each contract.' },
        longShortRatio: { label: 'Long/short ratio', desc: 'How accounts are split between long and short.' },
        liquidation: { label: 'Liquidation history', desc: 'How often each leverage would have been liquidated.' },
        daily: { label: 'Daily reports', desc: 'BTC, ETH and SOL in numbers, once a day.' },
        backtests: { label: 'Backtest results', desc: 'Strategies after costs. The losing ones are published too.' },
        bot: { label: 'Open-source backtester', desc: 'The code behind the results, free to run yourself.' },
        learn: { label: 'All lessons', desc: 'Perpetual futures explained with the numbers shown.' },
      },
    },
    theme: {
      label: 'Appearance',
      dark: 'Dark',
      light: 'Light',
      system: 'Follow system',
    },
    footer: {
      label: 'Footer',
      about: 'About',
      disclosure: 'How this site is paid for',
      risk: 'Leveraged trading is high risk. You can lose your entire margin. Not financial advice.',
      affiliate: 'Some links to Bybit are affiliate links. We may earn a commission at no cost to you.',
      // Shown while AFFILIATE_ACTIVE is false in site.config.mjs.
      plain: 'Links to Bybit are plain links today. This site earns nothing from them.',
      brand: 'Calculators, market data and backtests for crypto perpetual futures, with every formula shown.',
      method:
        'Exchange parameters come from Bybit’s public API and carry the date they were fetched. The calculators run in your browser.',
      aboutColumn: 'About',
    },
    cta: {
      // Shown while AFFILIATE_ACTIVE is false in site.config.mjs.
      disclosurePlain:
        'Plain link to Bybit. We earn nothing from it today. Leveraged trading can lose your entire margin.',
      disclosureLiveLinkPlain:
        'The live account link is a plain link to Bybit. We earn nothing from it today. Leveraged trading can lose your entire margin.',
      // One line under every block that contains an affiliate link.
      disclosure:
        'Affiliate link. We may earn a commission at no cost to you. Leveraged trading can lose your entire margin.',
      // Use this one when the block has a testnet button first and the
      // affiliate link second.
      disclosureLiveLink:
        'The live account link is an affiliate link. We may earn a commission at no cost to you. Leveraged trading can lose your entire margin.',
      // Under a block whose only exit is the testnet.
      disclosureTestnet:
        'The testnet uses practice funds, not real money. On a live account, leveraged trading can lose your entire margin.',
      testnet: 'Try on Bybit testnet',
      liveAccount: 'Open a live account',
    },
    breadcrumb: {
      label: 'Breadcrumb',
      home: 'Home',
    },
    coming: 'Coming',
    // Shared components (src/components/ui/).
    ui: {
      estimate: 'Results are estimates from the formula on this page. Your exchange’s own figure is the one that counts.',
      tableScroll: 'This table scrolls sideways.',
      dataAsOf: 'Data as of {date}',
      updated: 'Updated {time}',
      source: 'Source: {name}',
      stale: 'This data may be out of date.',
      chartEmptyTitle: 'No data to show',
      chartEmptyBody: 'There is nothing in this range yet.',
      chartErrorTitle: 'This chart could not be loaded',
      emptyTitle: 'Nothing here yet',
      errorTitle: 'This could not be loaded',
      errorBody: 'Reload the page to try again.',
      loading: 'Loading',
      about: 'About {term}',
    },
    // The risk ruler (src/components/ui/RiskRuler.astro). These go to the
    // browser as JSON, so they are plain strings with {placeholders}.
    ruler: {
      entry: 'Entry',
      liquidation: 'Liquidation',
      current: 'Now',
      long: 'Long',
      short: 'Short',
      distance: '{pct} to liquidation',
      summaryLong:
        'Long from {entry} {unit}, liquidation at {liq} {unit}. Price has to fall {pct} ({gap} {unit}) for the position to be closed.',
      summaryShort:
        'Short from {entry} {unit}, liquidation at {liq} {unit}. Price has to rise {pct} ({gap} {unit}) for the position to be closed.',
      summaryCurrent: 'Price now is {current} {unit}, {pct} away from liquidation.',
      summaryPast: 'Price now is {current} {unit}, already past the liquidation price.',
      scale: 'The axis starts at 0 and is drawn to scale.',
      empty: 'Enter an entry price and a liquidation price to draw the ruler.',
    },
  },
  'zh-hant': {
    siteName: 'perpmath',
    related: '相關教學',
    skipToContent: '跳到主要內容',
    nav: {
      label: '主選單',
      home: 'perpmath 首頁',
      tools: '工具',
      learn: '教學',
      daily: '每日報告',
      data: '市場數據',
      bot: '機器人',
      backtests: '回測',
      language: '語言',
      markets: '市場',
      research: '研究',
      openMenu: '開啟選單',
      closeMenu: '關閉選單',
      items: {
        toolsAll: { label: '所有工具', desc: '全部的計算機，以及還在製作的項目。' },
        dataAll: { label: '市場數據', desc: '資金費率、未平倉量、多空比與爆倉統計。' },
        fundingRate: { label: '資金費率', desc: '持有倉位，每次結算要付多少。' },
        openInterest: { label: '未平倉量', desc: '每個合約還有多少倉位沒有平掉。' },
        longShortRatio: { label: '多空比', desc: '做多與做空的帳戶各佔多少。' },
        liquidation: { label: '爆倉統計', desc: '每種槓桿在過去有幾天會被強制平倉。' },
        daily: { label: '每日報告', desc: '每天一次，用數字看 BTC、ETH、SOL。' },
        backtests: { label: '回測結果', desc: '扣掉成本後的策略回測，賠錢的也照登。' },
        bot: { label: '開源回測工具', desc: '跑出這些結果的程式碼，可以自己跑一次。' },
        learn: { label: '所有教學', desc: '把數字攤開來講的永續合約教學。' },
      },
    },
    theme: {
      label: '外觀',
      dark: '深色',
      light: '淺色',
      system: '跟隨系統',
    },
    footer: {
      label: '頁尾',
      about: '關於本站',
      disclosure: '本站的收入來源',
      risk: '槓桿交易風險很高，你可能賠光全部保證金。本站內容都不是投資建議。',
      affiliate: '部分前往 Bybit 的連結是聯盟連結，我們可能會收到佣金，你不會多付任何費用。',
      plain: '目前前往 Bybit 的連結都是一般連結，本站沒有從中得到任何收入。',
      brand: '加密貨幣永續合約的計算機、市場數據與回測，每一條公式都攤開來。',
      method: '交易所參數取自 Bybit 的公開 API，並標示抓取日期。計算機都在你的瀏覽器裡計算。',
      aboutColumn: '關於',
    },
    cta: {
      disclosurePlain: '這是前往 Bybit 的一般連結，本站目前沒有從中得到收入。槓桿交易可能讓你賠光全部保證金。',
      disclosureLiveLinkPlain:
        '「開立正式帳戶」是前往 Bybit 的一般連結，本站目前沒有從中得到收入。槓桿交易可能讓你賠光全部保證金。',
      disclosure: '這是聯盟連結，我們可能會收到佣金，你不會多付任何費用。槓桿交易可能讓你賠光全部保證金。',
      disclosureLiveLink:
        '「開立正式帳戶」是聯盟連結，我們可能會收到佣金，你不會多付任何費用。槓桿交易可能讓你賠光全部保證金。',
      disclosureTestnet: '測試網用的是練習資金，不是真錢。換成正式帳戶，槓桿交易可能讓你賠光全部保證金。',
      testnet: '到 Bybit 測試網試一次',
      liveAccount: '開立正式帳戶',
    },
    breadcrumb: {
      label: '頁面路徑',
      home: '首頁',
    },
    coming: '製作中',
    ui: {
      estimate: '結果是照這一頁的公式算出來的估計值，實際數字以交易所顯示的為準。',
      tableScroll: '這張表格可以左右捲動。',
      dataAsOf: '資料日期 {date}',
      updated: '更新時間 {time}',
      source: '資料來源：{name}',
      stale: '這份資料可能不是最新的。',
      chartEmptyTitle: '沒有資料可以顯示',
      chartEmptyBody: '這段期間還沒有資料。',
      chartErrorTitle: '這張圖表載入失敗',
      emptyTitle: '這裡還沒有內容',
      errorTitle: '這部分載入失敗',
      errorBody: '重新整理頁面再試一次。',
      loading: '載入中',
      about: '{term}的說明',
    },
    ruler: {
      entry: '進場價',
      liquidation: '爆倉價',
      current: '目前價',
      long: '做多',
      short: '做空',
      distance: '距離爆倉 {pct}',
      summaryLong: '做多，進場價 {entry} {unit}，爆倉價 {liq} {unit}。價格下跌 {pct}（{gap} {unit}）就會被強制平倉。',
      summaryShort: '做空，進場價 {entry} {unit}，爆倉價 {liq} {unit}。價格上漲 {pct}（{gap} {unit}）就會被強制平倉。',
      summaryCurrent: '目前價 {current} {unit}，離爆倉價還有 {pct}。',
      summaryPast: '目前價 {current} {unit}，已經越過爆倉價。',
      scale: '橫軸從 0 開始，照真實比例畫。',
      empty: '填入進場價與爆倉價，就會畫出這把尺。',
    },
  },
});
