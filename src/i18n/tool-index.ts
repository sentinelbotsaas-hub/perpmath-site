// The ten planned calculators: the name of each and the one question it
// answers. Order is the launch order. Owned by the skeleton; the tools area
// reads it (see src/lib/tools.ts) but keeps its own strings in tools.ts.
//
// A tool shows up as a link as soon as its page exists at
// src/pages/[...locale]/tools/<slug>/index.astro. Until then it is listed as
// plain text marked "Coming". Nobody has to edit this file for that.
import { defineStrings } from './strings';

export const toolSlugs = [
  'liquidation-price-calculator',
  'leverage-calculator',
  'position-size-calculator',
  'drawdown-calculator',
  'risk-of-ruin-calculator',
  'risk-reward-calculator',
  'dca-calculator',
  'crypto-profit-calculator',
  'kelly-criterion-calculator',
  'sharpe-ratio-calculator',
] as const;

export type ToolSlug = (typeof toolSlugs)[number];

type ToolCopy = Record<ToolSlug, { name: string; question: string }>;

export const toolIndex = defineStrings<ToolCopy>({
  en: {
    'liquidation-price-calculator': {
      name: 'Liquidation price calculator',
      question: 'At what price does the exchange close my position?',
    },
    'leverage-calculator': {
      name: 'Leverage calculator',
      question: 'How much leverage keeps my stop ahead of liquidation?',
    },
    'position-size-calculator': {
      name: 'Position size calculator',
      question: 'How big a position fits my risk per trade?',
    },
    'drawdown-calculator': {
      name: 'Drawdown calculator',
      question: 'What gain do I need to recover this loss?',
    },
    'risk-of-ruin-calculator': {
      name: 'Risk of ruin calculator',
      question: 'How likely am I to empty the account?',
    },
    'risk-reward-calculator': {
      name: 'Risk reward calculator',
      question: 'What win rate breaks even after fees?',
    },
    'dca-calculator': {
      name: 'DCA calculator',
      question: 'What are my new average and liquidation prices?',
    },
    'crypto-profit-calculator': {
      name: 'Futures profit calculator',
      question: 'What do I keep after fees and funding?',
    },
    'kelly-criterion-calculator': {
      name: 'Kelly criterion calculator',
      question: 'How much does the Kelly formula say to risk?',
    },
    'sharpe-ratio-calculator': {
      name: 'Sharpe ratio calculator',
      question: 'Is my track record long enough to mean anything?',
    },
  },
  'zh-hant': {
    'liquidation-price-calculator': {
      name: '爆倉價計算機',
      question: '價格走到哪裡，交易所會把我的倉位強制平倉？',
    },
    'leverage-calculator': {
      name: '槓桿計算機',
      question: '最多開幾倍，停損才會比爆倉先觸發？',
    },
    'position-size-calculator': {
      name: '倉位大小計算機',
      question: '只想賠掉帳戶的固定比例，這筆單可以開多大？',
    },
    'drawdown-calculator': {
      name: '回撤計算機',
      question: '虧了這麼多，要賺多少才能回本？',
    },
    'risk-of-ruin-calculator': {
      name: '破產風險計算機',
      question: '照我的勝率和單筆風險，把帳戶賠光的機率有多高？',
    },
    'risk-reward-calculator': {
      name: '風險報酬比計算機',
      question: '這筆單扣掉手續費之後，勝率要多少才不賠？',
    },
    'dca-calculator': {
      name: 'DCA 均價計算機',
      question: '加倉之後，均價和爆倉價會變成多少？',
    },
    'crypto-profit-calculator': {
      name: '合約損益計算機',
      question: '扣掉手續費和資金費之後，實際賺賠多少？',
    },
    'kelly-criterion-calculator': {
      name: '凱利公式計算機',
      question: '照凱利公式算，每筆該拿帳戶的幾成去冒險？',
    },
    'sharpe-ratio-calculator': {
      name: '夏普值計算機',
      question: '我的交易紀錄夠長、足以下結論了嗎？',
    },
  },
});
