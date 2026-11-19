// Strings for /tools/, the overview of all calculators.
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
    sub: '{ready} are ready to use and {planned} more are planned. Free, no account. What you type never leaves your browser.',
    subAllReady: 'All {ready} are ready to use. Free, no account. What you type never leaves your browser.',
    readyHead: 'Ready to use',
    plannedHead: 'Planned',
    plannedNote: 'These are not built yet, and there is no date for them.',
  },
  'zh-hant': {
    title: '加密貨幣永續合約計算機',
    description:
      '給永續合約交易者用的免費計算機。現在可以用的有：{names}。每個工具只回答一個問題，把答案照真實比例畫出來，公式也直接寫在頁面上。',
    separator: '、',
    head: '每個計算機只回答一個問題。',
    sub: '現在可以用的有 {ready} 個，另外 {planned} 個還在規劃中。免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    subAllReady: '{ready} 個計算機都可以用了。免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    readyHead: '現在可以用',
    plannedHead: '規劃中',
    plannedNote: '這些還沒做好，上線時間也還沒定。',
  },
});
