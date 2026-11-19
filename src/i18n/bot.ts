// Strings for /bot/, the page of the open-source backtester.
//
// Only what is true of the engine today: it backtests strategies and grids,
// it places orders on the Bybit testnet only, it is free and MIT licensed, and
// nothing about it pays anyone (broker_id is empty). {version} is the latest
// release (src/lib/backtests/engine.ts); {n} comes from src/data/backtests/.
import { defineStrings } from './strings';

export const bot = defineStrings({
  en: {
    title: 'perpmath: an open-source backtester for Bybit perpetuals',
    description:
      'An open-source Python backtester for crypto perpetuals: Bybit public candles, fees and slippage on every fill, in-sample and out-of-sample results.',
    head: 'Backtest a rule with honest costs.',
    sub: 'An open-source backtester for Bybit perpetuals. Version {version} adds a grid backtest and an order runner for the Bybit testnet only.',
    primary: 'Read the quickstart',
    secondary: 'View on GitHub',
    // The facts strip under the page head. Each value restates something the
    // page already says (the install note, the licence line, the JSON-LD).
    facts: {
      label: 'The engine at a glance',
      version: 'Version',
      language: 'Language',
      languageValue: 'Python 3.10 or newer',
      dependency: 'Dependency',
      dependencyValue: 'NumPy',
      license: 'Licence',
      licenseValue: 'MIT',
    },
    quickstart: {
      head: 'Quickstart',
      install: 'Install',
      installNote: 'Python 3.10 or newer. The only dependency is NumPy.',
      download: 'Download candles',
      downloadNote: 'One year of 15-minute candles from the public endpoint. No account, no API key.',
      backtest: 'Run a backtest',
      backtestNote: 'Writes one JSON file with everything needed to check the result.',
    },
    does: {
      head: 'What it does',
      body: 'Downloads public Bybit candles, runs a rule or a grid with fixed parameters, and reports in-sample and out-of-sample results after fees and slippage, and for grids after funding too.',
    },
    doesNot: {
      head: 'What it does not do',
      body: 'It cannot trade with real money: version {version} refuses to connect to Bybit mainnet and only places orders on the testnet, with play money. The backtester needs no API key. It makes no return claims.',
    },
    funded: {
      head: 'How it is funded',
      body: 'Free and MIT licensed. No broker or affiliate arrangement is attached to it.',
    },
    results: {
      headAllLost: 'All {n} shipped strategies lose money.',
      head: '{n} shipped results, published as they came.',
      body: 'They show how the accounting works. They are not for trading.',
      link: 'See the backtests',
      tableLabel: 'Total return of each shipped strategy, after fees and slippage',
    },
  },
  'zh-hant': {
    title: 'perpmath：開源的 Bybit 永續合約回測工具',
    description:
      '一個小型的開源 Python 回測工具，給加密貨幣永續合約用：抓 Bybit 公開 K 線，每筆成交都扣手續費與滑價，樣本內、樣本外分開報告，也能回測網格。採 MIT 授權。',
    head: '回測一條規則，成本照實算。',
    sub: '開源的 Bybit 永續合約回測工具。{version} 版加上網格回測，以及只連 Bybit 測試網的下單程式。',
    primary: '看快速上手',
    secondary: '到 GitHub 看原始碼',
    facts: {
      label: '這個工具的基本資料',
      version: '版本',
      language: '語言',
      languageValue: 'Python 3.10 以上',
      dependency: '相依套件',
      dependencyValue: 'NumPy',
      license: '授權',
      licenseValue: 'MIT',
    },
    quickstart: {
      head: '快速上手',
      install: '安裝',
      installNote: '需要 Python 3.10 以上，唯一的相依套件是 NumPy。',
      download: '下載 K 線',
      downloadNote: '從公開端點下載一年的 15 分鐘 K 線，不需要帳戶，也不需要 API 金鑰。',
      backtest: '跑一次回測',
      backtestNote: '結果會寫成一個 JSON 檔，檢查結果需要的資料都在裡面。',
    },
    does: {
      head: '它做什麼',
      body: '下載 Bybit 的公開 K 線，用固定參數跑一條規則或一組網格，把樣本內和樣本外的結果分開報告。每筆成交都扣手續費與滑價，網格另外計入資金費。',
    },
    doesNot: {
      head: '它不做什麼',
      body: '它不能用真錢交易：{version} 版會拒絕連 Bybit 正式網，只會在測試網用練習資金下單。回測不需要 API 金鑰。它不對報酬做任何宣稱。',
    },
    funded: {
      head: '它怎麼維持',
      body: '這個工具免費，採 MIT 授權。它沒有綁任何經紀商或聯盟合作。',
    },
    results: {
      headAllLost: '隨附的 {n} 個策略全部賠錢。',
      head: '隨附 {n} 份回測結果，照實公開。',
      body: '放這些策略是為了示範帳怎麼算，不是要讓人拿去交易。',
      link: '看回測結果',
      tableLabel: '隨附策略的總報酬率，已扣手續費與滑價',
    },
  },
});
