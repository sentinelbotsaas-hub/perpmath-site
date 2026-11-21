// Strings for /tools/kelly-criterion-calculator/.
// `ui` is handed to src/scripts/kelly-calculator.ts as JSON, so it holds
// templates only. Every figure is filled in from the inputs or computed with
// src/lib/calc/kelly.ts on the page; no result is written out here.
import { defineStrings } from './strings';

export const kelly = defineStrings({
  en: {
    title: 'Kelly criterion calculator',
    description:
      'Kelly criterion calculator: the share of the account the Kelly formula puts at risk per trade, from win rate and payoff ratio, with half and quarter Kelly.',
    lede: 'What the Kelly formula says to risk per trade for your win rate and payoff ratio, with half and quarter Kelly beside it.',
    noscript:
      'The calculator needs JavaScript. What you see is the starting example: a {win} win rate and a payoff ratio of {payoff}. The formula and the examples below can be worked on paper.',
    fields: {
      win: 'Win rate',
      payoff: 'Payoff ratio',
      payoffHint: 'Average win divided by average loss. 2 means a win makes twice what a loss costs.',
    },
    ui: {
      winText: '{value}%',
      fullBar: 'Full Kelly',
      halfBar: 'Half Kelly',
      barLabel: 'Two bars on one scale, where the full width is the whole account, 100%. Full Kelly: {full}. Half Kelly: {half}.',
      barLabelNoBet: 'Two bars on one scale, where the full width is the whole account, 100%. Both are empty: the formula says not to bet.',
      noBet: 'No bet',
      sentence:
        'With a win rate of {win} and a payoff ratio of {payoff}, the Kelly formula puts {full} of the account at risk on each trade. Half Kelly is {half} and quarter Kelly is {quarter}. The formula takes the win rate as exact; yours is an estimate.',
      sentenceNoBet:
        'With a win rate of {win} and a payoff ratio of {payoff}, the expected result is {edge} per trade. That is not above zero, so the Kelly formula says not to take this bet at any size.',
      edge: '{value}R',
      lowLabel: 'Full Kelly if the true win rate is {win}',
      lowGrowthLabel: 'Expected log growth per trade at {full}, if the true win rate is {win}',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        winRate: 'Enter a win rate above 0% and below 100%.',
        payoff: 'Enter a payoff ratio above 0, up to {max}.',
      },
    },
    result: {
      label: 'Full Kelly: share of the account at risk per trade',
      half: 'Half Kelly',
      quarter: 'Quarter Kelly',
      edge: 'Expected result per trade',
      caption: 'Expected log growth for these inputs',
      growthFull: 'Expected log growth per trade at full Kelly',
      growthHalf: 'Expected log growth per trade at half Kelly',
      growthQuarter: 'Expected log growth per trade at quarter Kelly',
    },
    // Shown in the result panel.
    assumptions: [
      'A trade has two outcomes: it makes exactly the payoff ratio times the amount at risk, or it loses exactly that amount.',
      'The win rate and the payoff ratio are taken as known and constant, and trades as independent. In practice both numbers are estimates from a sample of past trades, and an estimate that is too high makes the formula risk too much.',
      'The share is of the balance at that moment, and it is what a losing trade takes. It is not the leverage and not the position value.',
      'Kelly looks for the fastest long-run growth and takes no account of how deep the drawdowns are on the way. Fees, funding and slippage are left out.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'The Kelly criterion answers one question: which share of the account, risked on every trade, makes the account grow fastest over a long run of trades? For a trade with two outcomes the answer is:',
      kelly: 'f* = p − (1 − p) ÷ b',
      fractions: 'half Kelly = f* ÷ 2\nquarter Kelly = f* ÷ 4',
      where:
        'It comes from the expected log growth of the account per trade. When a share f is risked every time, a win multiplies the balance by 1 + b × f and a loss by 1 − f, so the expected log growth per trade is:',
      growth: 'g(f) = p × ln(1 + b × f) + (1 − p) × ln(1 − f)',
      max: 'g is highest where its slope is zero, p × b ÷ (1 + b × f) = (1 − p) ÷ (1 − f). Solving that for f gives the formula above. Below f* the account grows more slowly. Above f* it also grows more slowly, with larger swings, and far enough above the growth turns negative. The table shows this for the starting example.',
      negative:
        'When p × b is not larger than 1 − p, the trade has no edge and the formula returns zero or a negative number. A negative share has no meaning for a trade you can only take or leave, so the calculator shows “{noBet}” instead of that number.',
      tableCaption:
        'Expected log growth per trade for a {win} win rate and a payoff ratio of {payoff}, at multiples of full Kelly ({full}). Every row is computed with the growth formula.',
      tableMultiple: 'Multiple of full Kelly',
      tableShare: 'Share at risk per trade',
      tableGrowth: 'Expected log growth per trade',
      multiple: '{m}×',
      estimateHead: 'The formula assumes you know the true win rate',
      estimate:
        'Kelly treats p and b as facts. In trading they are estimates from a limited number of past trades, and an estimate that is too high makes the formula bet too much. For the starting example the formula says {full}. If the true win rate is {winLow} and not {win}, full Kelly is {fullLow}, and risking {full} has an expected log growth of {growthLow} per trade. Half and quarter Kelly are shown next to the full figure for this reason: a smaller share gives up part of the growth and leaves room for an estimate that is off. In the starting example half Kelly keeps {keepHalf} of the growth of full Kelly.',
      terms: [
        { term: 'p, the win rate', text: 'The probability that a trade ends in a profit.' },
        {
          term: 'b, the payoff ratio',
          text: 'The average win divided by the average loss. With b = 2 a winning trade makes twice what a losing trade costs.',
        },
        {
          term: 'f*, the Kelly share',
          text: 'The share of the current balance that a losing trade takes. A share of 10% on a 10,000 USDT account means the stop costs 1,000 USDT.',
        },
      ],
      sources:
        'Sources. The criterion is from J. L. Kelly Jr., “A New Interpretation of Information Rate”, Bell System Technical Journal 35(4), 1956, pp. 917–926, which works the even-money case. The form with a payoff ratio b used on this page, and the discussion of betting a fraction of Kelly, follow E. O. Thorp, “The Kelly Criterion in Blackjack Sports Betting, and the Stock Market”, chapter 9 of Handbook of Asset and Liability Management, vol. 1 (Elsevier, 2006), pp. 385–428, where it is written f* = (bp − q)/b with q = 1 − p.',
      leftOut:
        'Real trades do not have two fixed outcomes: wins and losses vary in size, and a stop can fill beyond its price. Fees and funding lower the payoff ratio. Positions that are open at the same time share one account. The formula also says nothing about leverage: the share is the loss at the stop, and the position that goes with it depends on how far away the stop is.',
    },
    examples: {
      first: 'Example 1: {win} wins at a payoff ratio of {payoff}',
      second: 'Example 2: {win} wins at a payoff ratio of {payoff}',
      setup: 'Win rate {win}, payoff ratio {payoff}: a winning trade makes {payoff} times what a losing trade costs.',
      workEdge: 'expected result per trade = {p} × {payoff} − {q} = {edge}',
      workKelly: 'f* = {p} − {q} ÷ {payoff} = {raw}',
      workHalf: 'half Kelly = {full} ÷ 2 = {half}',
      workQuarter: 'quarter Kelly = {full} ÷ 4 = {quarter}',
      workGrowth: 'g(f*) = {p} × ln {up} + {q} × ln {down} = {growth}',
      resultBet:
        'The formula puts {full} of the account at risk per trade, {half} at half Kelly and {quarter} at quarter Kelly. On an account of {account} USDT, full Kelly means a losing trade costs {amount} USDT.',
      resultNoBet:
        'The expected result per trade is {edge}, so there is no edge to size. The formula returns {raw}, which the calculator shows as “{noBet}”. No bet size turns a negative expectation into a positive one.',
    },
    mistakes: [
      {
        title: 'Treating the estimate as the truth',
        text: 'A win rate measured over a limited number of trades is an estimate. Full Kelly sized for {win} is {full}. If the true rate is {winLow}, the formula would have said {fullLow}, and {full} has an expected log growth of {growthLow} per trade.',
      },
      {
        title: 'Reading the Kelly share as leverage',
        text: 'The share is what a losing trade takes from the account, not the size of the position. Risking {full} with a stop {stopPct} from the entry is a position worth {mult} times the account.',
      },
      {
        title: 'Betting more than Kelly to grow faster',
        text: 'Past f* the expected log growth falls. In example 1 it is {growth} per trade at full Kelly, {growthDouble} at twice Kelly and {growthOver} at two and a half times Kelly.',
      },
      {
        title: 'Forgetting the drawdowns on the way',
        text: 'Kelly maximises growth and nothing else. Under the same assumptions, risking {full} per trade reaches a {dd} drawdown from the starting balance within {n} trades with a probability of {ddProb}. At half Kelly it is {ddProbHalf}.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '凱利公式計算機',
    description:
      '輸入勝率和賺賠比，算出凱利公式建議每筆交易拿帳戶的多少比例去冒險，同時列出半凱利和四分之一凱利。公式的假設和高估勝率的後果都寫在頁面上。',
    lede: '照你的勝率和賺賠比，算出凱利公式建議每筆押多少，旁邊列出半凱利和四分之一凱利。',
    noscript:
      '這個計算機需要 JavaScript。現在看到的是一開始的例題：勝率 {win}、賺賠比 {payoff}。下方的公式和例題可以自己用紙筆算。',
    fields: {
      win: '勝率',
      payoff: '賺賠比',
      payoffHint: '平均獲利除以平均虧損。2 代表賺一筆的金額是賠一筆的兩倍。',
    },
    ui: {
      winText: '{value}%',
      fullBar: '全凱利',
      halfBar: '半凱利',
      barLabel: '同一個比例尺上的兩條橫條，整條代表整個帳戶（100%）。全凱利 {full}，半凱利 {half}。',
      barLabelNoBet: '同一個比例尺上的兩條橫條，整條代表整個帳戶（100%）。兩條都是空的：公式的答案是不該下注。',
      noBet: '不該下注',
      sentence:
        '勝率 {win}、賺賠比 {payoff}，凱利公式算出每筆交易拿帳戶的 {full} 去冒險。半凱利是 {half}，四分之一凱利是 {quarter}。公式把勝率當成確定的數字，但你的勝率是估計值。',
      sentenceNoBet: '勝率 {win}、賺賠比 {payoff}，每筆的期望值是 {edge}，沒有大於 0。凱利公式的答案是：不管押多少，這筆都不該下注。',
      edge: '{value}R',
      lowLabel: '真實勝率如果是 {win}，全凱利會是',
      lowGrowthLabel: '真實勝率如果是 {win}，還照 {full} 去押的每筆期望對數成長率',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        winRate: '勝率要大於 0%、小於 100%。',
        payoff: '賺賠比要大於 0，最大到 {max}。',
      },
    },
    result: {
      label: '全凱利：每筆交易拿帳戶的多少去冒險',
      half: '半凱利',
      quarter: '四分之一凱利',
      edge: '每筆的期望值',
      caption: '同一組輸入的期望對數成長率',
      growthFull: '全凱利的每筆期望對數成長率',
      growthHalf: '半凱利的每筆期望對數成長率',
      growthQuarter: '四分之一凱利的每筆期望對數成長率',
    },
    assumptions: [
      '一筆交易只有兩種結果：剛好賺到風險金額的賺賠比倍，或是剛好賠掉風險金額。',
      '公式把勝率和賺賠比當成已知而且不變的數字，每筆交易互相獨立。實際上這兩個數字都是從過去的交易估出來的，估得太高，公式就會叫你押太大。',
      '這個比例是當時餘額的比例，指的是一筆虧損會賠掉多少，不是槓桿倍數，也不是倉位價值。',
      '凱利公式只追求長期成長最快，不管過程中的回撤有多深。手續費、資金費和滑價都沒有計入。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro: '凱利公式只回答一個問題：每一筆都拿帳戶的同一個比例去冒險，哪個比例會讓帳戶在長期成長得最快？一筆交易只有兩種結果時，答案是：',
      kelly: 'f* = p − (1 − p) ÷ b',
      fractions: '半凱利 = f* ÷ 2\n四分之一凱利 = f* ÷ 4',
      where: '它是從帳戶每筆交易的期望對數成長率推出來的。每次都拿比例 f 去冒險，贏了餘額乘以 1 + b × f，輸了乘以 1 − f，所以每筆的期望對數成長率是：',
      growth: 'g(f) = p × ln(1 + b × f) + (1 − p) × ln(1 − f)',
      max: 'g 的最高點在斜率等於 0 的地方，也就是 p × b ÷ (1 + b × f) = (1 − p) ÷ (1 − f)，解出 f 就是上面的公式。押得比 f* 少，帳戶成長得比較慢。押得比 f* 多，成長同樣比較慢，起伏卻更大；多到一個程度，成長率會變成負的。下面的表格用一開始的例題算給你看。',
      negative:
        'p × b 沒有大於 1 − p 的時候，這筆交易沒有優勢，公式會算出 0 或負數。一筆只能選擇做或不做的交易，負的比例沒有意義，所以計算機這時候顯示「{noBet}」，不顯示那個數字。',
      tableCaption: '勝率 {win}、賺賠比 {payoff} 時，押全凱利（{full}）的幾倍，每筆的期望對數成長率是多少。每一列都是用成長率公式算出來的。',
      tableMultiple: '全凱利的幾倍',
      tableShare: '每筆冒險的比例',
      tableGrowth: '每筆的期望對數成長率',
      multiple: '{m} 倍',
      estimateHead: '公式假設你知道真實的勝率',
      estimate:
        '凱利公式把 p 和 b 當成事實。交易上這兩個數字都是從有限的過去交易估出來的，估得太高，公式就會叫你押太大。一開始的例題公式算出 {full}。如果真實勝率是 {winLow} 而不是 {win}，全凱利其實是 {fullLow}，這時候還照 {full} 去押，每筆的期望對數成長率是 {growthLow}。全凱利旁邊同時列出半凱利和四分之一凱利，就是這個原因：押少一點會少掉一部分成長，換來勝率估錯時的緩衝。一開始的例題裡，半凱利保有全凱利 {keepHalf} 的成長率。',
      terms: [
        { term: 'p（勝率）', text: '一筆交易以獲利收場的機率。' },
        { term: 'b（賺賠比）', text: '平均獲利除以平均虧損。b = 2 代表賺一筆的金額是賠一筆的兩倍。' },
        {
          term: 'f*（凱利比例）',
          text: '一筆虧損的交易賠掉當時餘額的比例。帳戶有 10,000 USDT、比例是 10%，代表停損觸發時賠 1,000 USDT。',
        },
      ],
      sources:
        '出處。這個準則出自 J. L. Kelly Jr., “A New Interpretation of Information Rate”, Bell System Technical Journal 35(4), 1956, pp. 917–926，原文處理的是一賠一的情形。這一頁用的帶賺賠比 b 的寫法，以及只押凱利的一部分的討論，依據 E. O. Thorp, “The Kelly Criterion in Blackjack Sports Betting, and the Stock Market”，Handbook of Asset and Liability Management, vol. 1（Elsevier, 2006）第 9 章，pp. 385–428，原式寫成 f* = (bp − q)/b，其中 q = 1 − p。',
      leftOut:
        '真實的交易不會只有兩種固定的結果：每筆獲利和虧損的大小不一樣，停損也可能成交在比停損價更差的價格。手續費和資金費會拉低賺賠比。同時持有的幾個倉位共用同一個帳戶。公式也沒有提到槓桿：這個比例是停損觸發時的虧損，對應的倉位有多大，要看停損離進場價多遠。',
    },
    examples: {
      first: '例題 1：勝率 {win}、賺賠比 {payoff}',
      second: '例題 2：勝率 {win}、賺賠比 {payoff}',
      setup: '勝率 {win}、賺賠比 {payoff}：賺一筆的金額是賠一筆的 {payoff} 倍。',
      workEdge: '每筆的期望值 = {p} × {payoff} − {q} = {edge}',
      workKelly: 'f* = {p} − {q} ÷ {payoff} = {raw}',
      workHalf: '半凱利 = {full} ÷ 2 = {half}',
      workQuarter: '四分之一凱利 = {full} ÷ 4 = {quarter}',
      workGrowth: 'g(f*) = {p} × ln {up} + {q} × ln {down} = {growth}',
      resultBet:
        '公式算出每筆拿帳戶的 {full} 去冒險，半凱利是 {half}，四分之一凱利是 {quarter}。帳戶有 {account} USDT 的話，全凱利代表一筆虧損會賠掉 {amount} USDT。',
      resultNoBet:
        '每筆的期望值是 {edge}，沒有優勢可以放大。公式算出 {raw}，計算機會顯示成「{noBet}」。期望值是負的交易，不管押多少都不會變成正的。',
    },
    mistakes: [
      {
        title: '把估計值當成事實',
        text: '從有限的交易筆數量出來的勝率是估計值。照勝率 {win} 算的全凱利是 {full}。如果真實勝率是 {winLow}，公式其實會算出 {fullLow}，而照 {full} 去押的每筆期望對數成長率是 {growthLow}。',
      },
      {
        title: '把凱利比例當成槓桿',
        text: '這個比例是一筆虧損會從帳戶賠掉多少，不是倉位大小。每筆冒 {full} 的風險、停損設在離進場價 {stopPct} 的地方，倉位價值是帳戶的 {mult} 倍。',
      },
      {
        title: '押得比凱利多，想賺得更快',
        text: '超過 f* 之後，期望對數成長率反而下降。例題 1 的每筆期望對數成長率，全凱利是 {growth}，兩倍凱利是 {growthDouble}，兩倍半是 {growthOver}。',
      },
      {
        title: '忘了過程中的回撤',
        text: '凱利公式只追求成長最快。在同樣的假設下，每筆押 {full}，{n} 筆之內從起始資金回撤 {dd} 的機率是 {ddProb}；押半凱利則是 {ddProbHalf}。',
      },
    ],
    allTools: '所有計算機',
  },
});
