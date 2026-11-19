// Strings for /tools/drawdown-calculator/.
// `ui` is handed to src/scripts/drawdown-calculator.ts as JSON, so it holds
// templates only. Every result is filled in from the inputs or computed with
// src/lib/calc/drawdown.ts on the page. The few numbers written out here are
// plain arithmetic (half of 100 is 50) or name the page's starting state.
import { defineStrings } from './strings';

export const drawdown = defineStrings({
  en: {
    title: 'Drawdown calculator',
    description:
      'See what gain it takes to recover from a drawdown, and how much capital a losing streak leaves. Enter a drawdown, or a streak and a risk per trade. Bars drawn to scale.',
    lede: 'What gain it takes to get back to where you started, from a drawdown or from a losing streak.',
    noscript:
      'The calculator needs JavaScript. What you see is the result for a 50% drawdown; the formula, the table and the examples below can be done on paper.',
    fields: {
      mode: 'Start from',
      modeDrawdown: 'A drawdown',
      modeStreak: 'A losing streak',
      drawdown: 'Drawdown',
      losses: 'Losses in a row',
      lossesUnit: 'trades',
      risk: 'Risk per trade',
      riskHint: 'Share of the balance lost on each losing trade.',
    },
    ui: {
      lostBar: 'Lost',
      neededBar: 'Gain needed to recover',
      // What the drawdown slider says to a screen reader, and its two ends.
      ddText: '{value}%',
      barLabel: 'Two bars on one scale, where the full width is {scale}. Lost: {lost}. Gain needed to recover: {needed}.',
      figure: '{pct}',
      drawdown: 'After a loss of {lost}, {remaining} of the capital is left, and it has to grow {needed} to be back where it started.',
      streak:
        '{n} losses in a row at {risk} each leave {remaining} of the capital, a drawdown of {lost}. Getting back takes a gain of {needed}.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        drawdown: 'Enter a drawdown above 0% and below 100%. At 100% nothing is left to recover from.',
        losses: 'Enter a whole number of losses from 1 to {max}.',
        risk: 'Risk per trade must be above 0% and below 100%.',
        wipedOut:
          'This leaves less than {min} of the capital, so for practical purposes nothing is left to recover from. Enter a smaller number.',
      },
    },
    result: {
      label: 'Gain needed to recover',
      lost: 'Drawdown',
      remaining: 'Capital left',
    },
    // Shown in the result panel.
    assumptions: [
      'Losses and gains are percentages of the balance, so the result does not depend on the size of the account.',
      'In a losing streak every trade loses exactly the risk per trade, taken from what is left at that moment.',
      'Fees, funding and slippage are left out. They make the real loss a little larger.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'A loss is measured against the balance before it. The recovery is measured against the smaller balance after it. That is why the two percentages are not the same:',
      recover: 'gain needed to recover = drawdown ÷ (1 − drawdown)',
      streakIntro:
        'In a losing streak each loss takes its share of what is left at that moment, so the losses compound instead of adding up:',
      streak: 'capital remaining = (1 − risk per trade) ^ number of losses',
      streakDrawdown: 'drawdown = 1 − capital remaining',
      terms: [
        {
          term: 'Drawdown',
          text: 'The fall from the highest balance to the current one, as a share of the highest balance.',
        },
        { term: 'Risk per trade', text: 'The share of the current balance lost on one losing trade.' },
        { term: 'Number of losses', text: 'Losing trades in a row, with no winning trade in between.' },
      ],
      why: 'Worked through with round numbers: start with 100 and lose 50%, and 50 is left. To be back at 100 the 50 has to gain another 50, which is 100% of 50.',
      tableCaption: 'Every row is computed with the first formula.',
      tableLost: 'Drawdown',
      tableLeft: 'Capital left',
      tableNeeded: 'Gain needed to recover',
      leftOut:
        'What this leaves out: it assumes every loss in the streak is exactly the risk per trade. Fees, funding and stops that fill beyond their price make real losses a little larger. It also says nothing about how likely a streak is; that depends on your win rate.',
    },
    examples: {
      first: 'Example 1: a drawdown of {lost}',
      second: 'Example 2: {n} losses in a row at {risk} each',
      setupDrawdown: 'The account is {lost} below its highest balance.',
      setupStreak: '{n} losing trades in a row, each one losing {risk} of the balance at that moment.',
      workRecover: 'gain needed = {d} ÷ (1 − {d}) = {d} ÷ {rem} = {needed}',
      workRemaining: 'capital remaining = (1 − {r}) ^ {n} = {rem}',
      workDrawdown: 'drawdown = 1 − {rem} = {d}',
      workStreakRecover: 'gain needed = {d} ÷ {rem} = {needed}',
      resultDrawdown: '{remaining} of the capital is left. It has to grow {needed} to reach the old high again.',
      resultStreak:
        '{remaining} of the capital is left. The drawdown is {lost}, not {naive}, because each loss is taken from a smaller balance. Recovering takes a gain of {needed}.',
    },
    mistakes: [
      {
        title: 'Expecting the same percentage back',
        text: 'A loss of {lost} is not undone by a gain of {lost}. That gain only brings the balance back to {back} of where it started; it takes {needed}.',
      },
      {
        title: 'Adding the losses up',
        text: '{n} losses of {risk} are not a drawdown of {naive}. Each loss is taken from a smaller balance, so the drawdown is {streakLost}.',
      },
      {
        title: 'Underestimating a deep drawdown',
        text: 'The gain needed grows faster than the loss. The table above shows it: past a drawdown of 50% the recovery is more than a double.',
      },
      {
        title: 'Raising the risk to recover faster',
        text: 'A larger risk per trade makes the next losing streak deeper. {n} losses in a row leave {remaining} of the capital at {risk} per trade and {remainingDouble} at {riskDouble}.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '回撤計算機',
    description:
      '算出回撤之後要賺多少才能回本，以及連續虧損之後還剩多少資金。輸入回撤百分比，或是連虧次數加上單筆風險，結果會用照比例的橫條畫出來。',
    lede: '不管是一次回撤還是連續虧損，算出要賺多少才能回到原點。',
    noscript: '這個計算機需要 JavaScript。現在看到的是回撤 50% 的結果；下方的公式、表格和例題可以自己用紙筆算。',
    fields: {
      mode: '從哪裡算起',
      modeDrawdown: '回撤幅度',
      modeStreak: '連續虧損',
      drawdown: '回撤',
      losses: '連虧次數',
      lossesUnit: '筆',
      risk: '單筆風險',
      riskHint: '每一筆虧損賠掉當時餘額的比例。',
    },
    ui: {
      lostBar: '虧掉',
      neededBar: '回本要賺',
      ddText: '{value}%',
      barLabel: '同一個比例尺上的兩條橫條，整條代表 {scale}。虧掉 {lost}，回本要賺 {needed}。',
      figure: '{pct}',
      drawdown: '虧掉 {lost} 之後，資金剩下 {remaining}，要再賺 {needed} 才能回到原點。',
      streak: '連虧 {n} 筆、每筆賠 {risk}，資金剩下 {remaining}，回撤 {lost}。要賺 {needed} 才能回本。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        drawdown: '回撤要大於 0%、小於 100%。虧掉 100% 就沒有本金可以回本了。',
        losses: '連虧次數請填 1 到 {max} 的整數。',
        risk: '單筆風險要大於 0%、小於 100%。',
        wipedOut: '這樣算下來，資金剩不到 {min}，實際上已經沒有本金可以回本了。請填小一點的數字。',
      },
    },
    result: {
      label: '回本需要的報酬',
      lost: '回撤',
      remaining: '剩餘資金',
    },
    assumptions: [
      '虧損和報酬都是餘額的百分比，所以結果跟帳戶金額大小無關。',
      '連續虧損時，假設每一筆都剛好賠掉單筆風險那麼多，從當時剩下的餘額裡扣。',
      '沒有計入手續費、資金費和滑價，這些會讓實際虧損再大一點。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '虧損是用虧損之前的餘額當分母，回本卻是用虧損之後、比較小的餘額當分母，所以兩個百分比不會一樣：',
      recover: '回本需要的報酬 = 回撤 ÷ (1 − 回撤)',
      streakIntro: '連續虧損時，每一筆都是從當時剩下的餘額裡扣，所以虧損是連乘，不是相加：',
      streak: '剩餘資金 = (1 − 單筆風險) ^ 連虧次數',
      streakDrawdown: '回撤 = 1 − 剩餘資金',
      terms: [
        { term: '回撤', text: '從餘額的最高點跌到現在的幅度，以最高點的比例表示。' },
        { term: '單筆風險', text: '一筆虧損的交易賠掉當時餘額的比例。' },
        { term: '連虧次數', text: '連續虧損的筆數，中間沒有任何一筆獲利。' },
      ],
      why: '用整數走一遍：一開始有 100，虧掉 50% 剩下 50。要回到 100，這 50 得再賺 50，也就是 50 的 100%。',
      tableCaption: '每一列都是用第一條公式算出來的。',
      tableLost: '回撤',
      tableLeft: '剩餘資金',
      tableNeeded: '回本需要的報酬',
      leftOut:
        '這裡沒有算進去的：公式假設連虧的每一筆都剛好賠掉單筆風險那麼多。手續費、資金費，以及停損成交在比停損價更差的價格，都會讓實際虧損再大一點。公式也沒有告訴你連虧發生的機率有多高，那要看你的勝率。',
    },
    examples: {
      first: '例題 1：回撤 {lost}',
      second: '例題 2：連虧 {n} 筆，每筆賠 {risk}',
      setupDrawdown: '帳戶比最高點少了 {lost}。',
      setupStreak: '連續 {n} 筆虧損，每一筆都賠掉當時餘額的 {risk}。',
      workRecover: '回本需要的報酬 = {d} ÷ (1 − {d}) = {d} ÷ {rem} = {needed}',
      workRemaining: '剩餘資金 = (1 − {r}) ^ {n} = {rem}',
      workDrawdown: '回撤 = 1 − {rem} = {d}',
      workStreakRecover: '回本需要的報酬 = {d} ÷ {rem} = {needed}',
      resultDrawdown: '資金剩下 {remaining}，要再賺 {needed} 才能回到原本的最高點。',
      resultStreak:
        '資金剩下 {remaining}。回撤是 {lost}，不是 {naive}，因為每一筆虧損都是從更小的餘額裡扣的。回本要賺 {needed}。',
    },
    mistakes: [
      {
        title: '以為賺回同樣的百分比就回本',
        text: '虧掉 {lost}，再賺 {lost} 並不會回本，餘額只會回到原本的 {back}。要賺 {needed} 才夠。',
      },
      {
        title: '把每筆虧損直接加起來',
        text: '連虧 {n} 筆、每筆 {risk}，回撤不是 {naive}。每一筆都是從更小的餘額裡扣，所以回撤是 {streakLost}。',
      },
      {
        title: '低估深度回撤',
        text: '回本需要的報酬成長得比虧損快，上面的表格看得出來：回撤超過 50% 之後，回本就得翻一倍以上。',
      },
      {
        title: '加大風險想快點回本',
        text: '單筆風險放大，下一次連虧的回撤也會更深。同樣連虧 {n} 筆，單筆風險 {risk} 時資金剩下 {remaining}，{riskDouble} 時只剩 {remainingDouble}。',
      },
    ],
    allTools: '所有計算機',
  },
});
