// Strings for /bot/, the page of the open-source backtester.
//
// Only what is true of the engine today: it backtests, it cannot trade, it is
// free and MIT licensed, and nothing about it pays anyone. {version} and {n}
// are filled in from the published results in src/data/backtests/.
import { defineStrings } from './strings';

export const bot = defineStrings({
  en: {
    title: 'perpmath: an open-source backtester for Bybit perpetuals',
    description:
      'An open-source Python backtester for crypto perpetuals: Bybit public candles, fees and slippage on every fill, in-sample and out-of-sample results.',
    head: 'Backtest a rule with honest costs.',
    sub: 'An open-source backtester for Bybit perpetuals; version {version} cannot place orders.',
    primary: 'Read the quickstart',
    secondary: 'View on GitHub',
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
      body: 'Downloads public Bybit candles, runs a rule with fixed parameters, and reports in-sample and out-of-sample results after fees and slippage.',
    },
    doesNot: {
      head: 'What it does not do',
      body: 'Version {version} cannot trade live and never asks for an API key. It ships no profitable strategy and makes no return claims.',
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
    },
  },
  'zh-hant': {
    title: 'perpmath：開源的 Bybit 永續合約回測工具',
    description:
      '一個小型的開源 Python 回測工具，給加密貨幣永續合約用：抓 Bybit 公開 K 線，每筆成交都扣手續費與滑價，樣本內、樣本外分開報告。目前只能回測，採 MIT 授權。',
    head: '回測一條規則，成本照實算。',
    sub: '開源的 Bybit 永續合約回測工具；{version} 版還不能下單。',
    primary: '看快速上手',
    secondary: '到 GitHub 看原始碼',
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
      body: '下載 Bybit 的公開 K 線，用固定參數跑一條規則，把樣本內和樣本外的結果分開報告，每筆成交都扣手續費與滑價。',
    },
    doesNot: {
      head: '它不做什麼',
      body: '{version} 版不能實際下單交易，也不會跟你要 API 金鑰。它沒有附任何會賺錢的策略，也不對報酬做任何宣稱。',
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
    },
  },
});
