// Shared UI strings: nav, footer, disclosures, labels used on more than one
// page. Only the skeleton owner edits this file. Other areas add their own
// file next to it (tools.ts, daily.ts, ...) following the same pattern.
import { defineStrings } from './strings';

export const common = defineStrings({
  en: {
    siteName: 'perpmath',
    skipToContent: 'Skip to content',
    nav: {
      label: 'Main',
      home: 'perpmath, home',
      tools: 'Tools',
      learn: 'Learn',
      daily: 'Daily',
      data: 'Data',
      bot: 'Bot',
      backtests: 'Backtests',
      language: 'Language',
    },
    footer: {
      label: 'Footer',
      about: 'About',
      disclosure: 'How this site is paid for',
      risk: 'Leveraged trading is high risk. You can lose your entire margin. Not financial advice.',
      affiliate: 'Some links to Bybit are affiliate links. We may earn a commission at no cost to you.',
      // Shown while AFFILIATE_ACTIVE is false in site.config.mjs.
      plain: 'Links to Bybit are plain links today. This site earns nothing from them.',
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
  },
  'zh-hant': {
    siteName: 'perpmath',
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
    },
    footer: {
      label: '頁尾',
      about: '關於本站',
      disclosure: '本站的收入來源',
      risk: '槓桿交易風險很高，你可能賠光全部保證金。本站內容都不是投資建議。',
      affiliate: '部分前往 Bybit 的連結是聯盟連結，我們可能會收到佣金，你不會多付任何費用。',
      plain: '目前前往 Bybit 的連結都是一般連結，本站沒有從中得到任何收入。',
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
  },
});
