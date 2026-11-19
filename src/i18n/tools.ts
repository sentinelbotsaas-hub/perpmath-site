// Strings for /tools/, the overview of all calculators, and (in `calc`) the
// labels every calculator page shares.
// {ready} and {planned} are counted at build time from the pages that exist
// (src/lib/tools.ts), so the page never claims a calculator that is not built.
import { defineStrings } from './strings';

export const tools = defineStrings({
  en: {
    title: 'Calculators for crypto perpetual futures',
    description:
      'Free perpetual futures calculators: {names}. Answers drawn to scale.',
    // Joins the names of the ready calculators in the description.
    separator: ', ',
    head: 'Each calculator answers one question.',
    sub: '{ready} are ready to use and {planned} more are in development. Free, no account. What you type never leaves your browser.',
    subAllReady: 'All {ready} are ready to use. Free, no account. What you type never leaves your browser.',
    // Groups of the ready calculators. A group is only shown when one of its
    // calculators exists (see the page).
    groups: {
      risk: {
        name: 'Risk management',
        desc: 'Where a position ends, and how far back a loss sets you.',
      },
      planning: {
        name: 'Position planning',
        desc: 'Settle the leverage and the size before you open.',
      },
    },
    // One worked result per card, computed at build time by the calc library
    // from the same starting values as the calculator page.
    exampleTag: 'Example',
    examples: {
      'liquidation-price-calculator': {
        setup: '{lev}x long from {entry} USDT',
        label: 'Liquidation price',
        value: '{price} USDT',
      },
      'leverage-calculator': {
        setup: 'Long from {entry} USDT, stop at {stop}',
        label: 'Maximum leverage',
        value: '{lev}x',
      },
      'position-size-calculator': {
        setup: '{account} USDT account, {risk} risk, stop {pct} away',
        label: 'Position size',
        value: '{qty} BTC',
      },
      'drawdown-calculator': {
        setup: 'After a {lost} drawdown',
        label: 'Gain needed to recover',
        value: '{needed}',
      },
    },
    plannedHead: 'In development',
    plannedNote: 'These are not built yet, and there is no date for them. They have no page until they work.',
  },
  'zh-hant': {
    title: '加密貨幣永續合約計算機',
    description:
      '給永續合約交易者用的免費計算機。現在可以用的有：{names}。每個工具只回答一個問題，把答案照真實比例畫出來，公式也直接寫在頁面上。',
    separator: '、',
    head: '每個計算機只回答一個問題。',
    sub: '現在可以用的有 {ready} 個，另外 {planned} 個還在開發中。免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    subAllReady: '{ready} 個計算機都可以用了。免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    groups: {
      risk: {
        name: '風險管理',
        desc: '倉位會在哪裡結束，虧損之後要爬多久。',
      },
      planning: {
        name: '倉位規劃',
        desc: '開倉之前，先決定開幾倍、開多大。',
      },
    },
    exampleTag: '範例',
    examples: {
      'liquidation-price-calculator': {
        setup: '做多 {lev} 倍，進場價 {entry} USDT',
        label: '爆倉價',
        value: '{price} USDT',
      },
      'leverage-calculator': {
        setup: '做多，進場價 {entry} USDT，停損 {stop}',
        label: '最高槓桿',
        value: '{lev} 倍',
      },
      'position-size-calculator': {
        setup: '帳戶 {account} USDT，單筆風險 {risk}，停損距離 {pct}',
        label: '倉位大小',
        value: '{qty} BTC',
      },
      'drawdown-calculator': {
        setup: '回撤 {lost} 之後',
        label: '回本需要的報酬',
        value: '{needed}',
      },
    },
    plannedHead: '開發中',
    plannedNote: '這些還沒做好，上線時間也還沒定。做好之前不會有自己的頁面。',
  },
});

// Labels shared by the four calculator pages (CalculatorShell and the parts
// around it). The four of `actions` are handed to the browser as JSON.
export const calc = defineStrings({
  en: {
    inputs: 'Inputs',
    result: 'Result',
    reset: 'Reset',
    advanced: 'Advanced settings',
    copy: 'Copy result',
    copyLink: 'Copy link',
    peek: 'Full result',
    assumptions: 'What this assumes',
    source: 'Bybit public API',
    onThisPage: 'On this page',
    leftOut: 'What the formula leaves out',
    related: 'Related calculators',
    slider: '{label}, slider',
    actions: {
      resetDone: 'The inputs are back to the starting example.',
      copyDone: 'Result copied.',
      copyLinkDone: 'Link copied. It opens this page with the same inputs.',
      copyFail: 'Could not copy. Select the text and copy it by hand.',
    },
  },
  'zh-hant': {
    inputs: '輸入',
    result: '結果',
    reset: '重設',
    advanced: '進階參數',
    copy: '複製結果',
    copyLink: '複製連結',
    peek: '完整結果',
    assumptions: '計算假設',
    source: 'Bybit 公開 API',
    onThisPage: '這一頁的內容',
    leftOut: '公式沒有算進去的',
    related: '相關計算機',
    slider: '{label}滑桿',
    actions: {
      resetDone: '已恢復成一開始的例題。',
      copyDone: '已複製結果。',
      copyLinkDone: '已複製連結，打開後會帶入同一組數字。',
      copyFail: '複製失敗，請手動選取文字後複製。',
    },
  },
});
