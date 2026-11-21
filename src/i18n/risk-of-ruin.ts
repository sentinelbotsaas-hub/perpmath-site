// Strings for /tools/risk-of-ruin-calculator/.
// `ui` is handed to src/scripts/risk-of-ruin-calculator.ts as JSON, so it
// holds templates only. Every figure is filled in from the inputs or computed
// with src/lib/calc/risk-of-ruin.ts on the page; no result is written out here.
import { defineStrings } from './strings';

export const riskOfRuin = defineStrings({
  en: {
    title: 'Risk of ruin calculator',
    description:
      'Risk of ruin calculator: the chance your account hits a drawdown threshold, from win rate, payoff ratio and risk per trade. Exact count plus a seeded simulation.',
    lede: 'How likely the account is to fall to a drawdown threshold, given your win rate, payoff ratio and risk per trade.',
    noscript:
      'The calculator needs JavaScript. What you see is the starting example: {win} win rate, payoff ratio {payoff}, {risk} risked per trade, a {dd} threshold and {n} trades. The formulas and the worked examples are below.',
    fields: {
      win: 'Win rate',
      payoff: 'Payoff ratio',
      payoffHint: 'Average win divided by average loss. 2 means a win makes twice what a loss costs.',
      risk: 'Risk per trade',
      riskHint: 'Share of the balance a losing trade takes.',
      dd: 'Drawdown threshold',
      ddHint: 'Measured from the starting balance: 20% means the account is down to 80% of where it began.',
      trades: 'Number of trades',
      tradesUnit: 'trades',
      tradesHint: 'How far ahead to look, from 1 to {max}.',
    },
    ui: {
      winText: '{value}%',
      withinBar: 'Within {n} trades',
      everBar: 'With no end to the trading, at most',
      everBarCertain: 'With no end to the trading',
      barLabel:
        'Two bars on one scale from 0% to 100%. Within {n} trades: {within}. With no end to the trading: between {lower} and {upper}.',
      barLabelCertain:
        'Two bars on one scale from 0% to 100%. Within {n} trades: {within}. With no end to the trading the threshold is reached sooner or later: 100%.',
      sentence:
        'With a win rate of {win}, a payoff ratio of {payoff} and {risk} of the balance risked per trade, the account touches a {dd} drawdown from its starting balance within {n} trades with a probability of {prob}.',
      impossible:
        'A {dd} drawdown takes at least {k} losses in a row at {risk} per trade, so it cannot be reached within {n} trades.',
      sim: '{est} ± {se}',
      // No path, or every path, touched the threshold: a standard error of
      // zero would claim a certainty the simulation does not have.
      simNone: '0 of {paths} paths',
      simAll: 'All {paths} paths',
      simPending: 'running',
      eventualRange: '{lower} to {upper}',
      eventualCertain: '100%',
      edge: '{value}R',
      noEdge:
        'No edge: the expected result is {edge} per trade. The balance shrinks in the long run, so with no end to the trading the threshold is reached sooner or later.',
      overbet:
        'The expected result per trade is positive ({edge}), but at {risk} per trade the balance still shrinks in the long run (log growth of {growth} per trade). With no end to the trading the threshold is reached sooner or later.',
      invalid: 'Fix the marked input to see a result.',
      noValue: 'n/a',
      errors: {
        winRate: 'Enter a win rate above 0% and below 100%.',
        payoff: 'Enter a payoff ratio above 0, up to {max}.',
        risk: 'Risk per trade must be above 0% and below 100%.',
        threshold:
          'Enter a drawdown above 0% and below 100%. Risking a share of what is left never empties the account, so 100% cannot be reached.',
        trades: 'Enter a whole number of trades from 1 to {max}.',
      },
    },
    result: {
      label: 'Chance of reaching the threshold',
      caption: 'The other figures for these inputs',
      sim: 'Monte Carlo estimate, {paths} paths',
      eventual: 'With no end to the trading',
      streak: 'Losses in a row that reach the threshold',
      edge: 'Expected result per trade',
      growth: 'Expected log growth of the balance per trade',
    },
    // Shown in the result panel.
    assumptions: [
      'Fixed-fraction betting: every trade risks the same share of the balance at that moment. Such a balance never reaches zero, so "ruin" here is the drawdown threshold, measured from the starting balance.',
      'Every win makes exactly the payoff ratio times the risk and every loss costs exactly the risk. Trades are independent, and the win rate and the payoff ratio never change.',
      'The main figure is an exact count over every order of wins and losses. The Monte Carlo line is a simulation estimate: {paths} paths, seed {seed}, ± one standard error.',
      'Fees, funding and slippage are left out.',
    ],
    toc: {
      formula: 'How it is calculated',
      examples: 'Worked examples',
      mistakes: 'Common mistakes',
    },
    formula: {
      intro:
        'The model is fixed-fraction betting. Every trade risks the same share of the balance at that moment: a win adds the payoff ratio times that share, a loss takes the share. After any mix of wins and losses the balance is:',
      balance: 'balance = starting balance × (1 + payoff ratio × risk)^wins × (1 − risk)^losses',
      ruinLine: 'threshold reached when balance ≤ starting balance × (1 − drawdown threshold)',
      notZero:
        'A balance like this never reaches zero, because each loss takes a share of what is left: after {k} losses in a row at {risk} the account still holds {left}. Under this model the chance of losing everything is 0 for every input, which answers nothing. So the page asks for a drawdown threshold and works out the chance of touching it.',
      exactHead: 'The main figure is an exact count',
      exact:
        'The balance depends on how many trades were won and how many were lost, and the order does not matter. The calculator therefore walks the tree of outcomes one trade at a time. It carries the probability of every combination of wins and losses that is still above the threshold, and sets aside the probability of each one that reaches it. What has been set aside after the last trade is the answer. Nothing is approximated: for the model above, the figure is exact.',
      closedHead: 'The closed form, and when it holds',
      closed:
        'A textbook formula covers one special case. If a win exactly undoes a loss, so that (1 + payoff ratio × risk) × (1 − risk) = 1, the balance moves on a ladder of equal steps. With the threshold k steps below the start and a win rate p above 50%, the chance of ever reaching it is the classical gambler’s ruin result:',
      classical: 'P(ever) = ((1 − p) ÷ p)^k',
      bounds:
        'For any other payoff ratio a loss can carry the balance past the threshold, and no exact closed form exists. A pair of bounds does hold (Lundberg’s inequality). Find the number θ above 0 that solves the first line; the chance of ever reaching the threshold lies between the two ends of the second:',
      theta: 'p × (1 + payoff ratio × risk)^(−θ) + (1 − p) × (1 − risk)^(−θ) = 1',
      inequality: '((1 − threshold) × (1 − risk))^θ < P(ever) ≤ (1 − threshold)^θ',
      certain:
        'θ exists only when the expected log growth per trade, p × ln(1 + payoff ratio × risk) + (1 − p) × ln(1 − risk), is above zero. That is the case in which the balance grows in the long run. When the sum is zero or negative, the threshold is reached sooner or later with a probability of 100%, however deep it is. A positive expected result per trade does not guarantee growth: risk a large enough share and the balance shrinks in the long run even with an edge.',
      simHead: 'The Monte Carlo check',
      sim: 'The third figure is a simulation, so it is an estimate and not an exact value. The calculator draws {paths} paths of random trades from a seeded generator (mulberry32, seed {seed}) and counts the paths that touch the threshold within the horizon. The seed is fixed, so the same inputs give the same estimate every time, on this page and in your browser. The ± is one standard error, √(estimate × (1 − estimate) ÷ {paths}). The exact figure should sit within about two standard errors of the estimate.',
      tableCaption:
        'Exact count against the simulation for a {win} win rate, a payoff ratio of {payoff}, a {dd} threshold and {n} trades. Every row is computed by the code this page runs.',
      tableRisk: 'Risk per trade',
      tableExact: 'Exact, within {n} trades',
      tableSim: 'Monte Carlo, {paths} paths',
      tableEver: 'No end to the trading, at most',
      terms: [
        { term: 'Win rate', text: 'The share of trades that end in a profit. In the formulas it is p.' },
        {
          term: 'Payoff ratio',
          text: 'The average win divided by the average loss. With a ratio of 2 a winning trade makes twice what a losing trade costs.',
        },
        { term: 'Risk per trade', text: 'The share of the current balance a losing trade takes.' },
        {
          term: 'Drawdown threshold',
          text: 'The fall from the starting balance that you count as ruin: the point where you would stop, or where the account is too small to carry on.',
        },
        { term: 'Number of trades', text: 'The horizon. The chance of touching the threshold can only rise as trades are added.' },
      ],
      sources:
        'Sources. The gambler’s ruin formula: W. Feller, An Introduction to Probability Theory and Its Applications, vol. 1, 3rd ed. (Wiley, 1968), chapter XIV. The bounds follow from Wald’s identity (A. Wald, “On cumulative sums of random variables”, Annals of Mathematical Statistics 15(3), 1944, pp. 283–296) and are known in risk theory as Lundberg’s inequality: S. Asmussen and H. Albrecher, Ruin Probabilities, 2nd ed. (World Scientific, 2010).',
      leftOut:
        'Real trades are not independent: losses tend to come together when the market changes character. The win rate and the payoff ratio are estimates from a limited sample and drift over time. Wins and losses are not all the same size, and a stop can fill beyond its price. Fees and funding are not counted. A drawdown measured from a later high is reached more often than one measured from the start. None of this is in the model, so read the figure as the risk under ideal conditions, not as an upper limit.',
    },
    examples: {
      first: 'Example 1: {win} wins at a payoff ratio of {payoff}',
      second: 'Example 2: {win} wins at a payoff ratio of {payoff}, no edge',
      setup:
        'Win rate {win}, payoff ratio {payoff}, {risk} of the balance risked per trade. The threshold is a {dd} drawdown from the starting balance and the horizon is {n} trades.',
      workWin: 'a win multiplies the balance by 1 + {payoff} × {r} = {up}',
      workLoss: 'a loss multiplies it by 1 − {r} = {down}',
      workStreak: '{k} losses in a row leave {down}^{k} = {after}, at or below {level}',
      workEdge: 'expected result per trade = {p} × {payoff} − {q} = {edge}',
      workGrowth: 'expected log growth per trade = {p} × ln {up} + {q} × ln {down} = {growth}',
      workExact: 'exact count over {n} trades = {prob}',
      workSim: 'Monte Carlo, {paths} paths, seed {seed} = {sim}',
      workEver: 'θ = {theta}, so with no end to the trading: between {lower} and {upper}',
      workEverCertain: 'growth is not above zero, so no θ exists: 100% with no end to the trading',
      resultEdge:
        '{prob} of all possible runs of {n} trades touch the {dd} line at some point, even though the expected result per trade is positive. The simulation gives {sim}, {gap} standard errors away from the exact figure. With no end to the trading the figure is at most {upper}.',
      resultNoEdge:
        '{prob} of all possible runs of {n} trades touch the {dd} line. The expected result per trade is zero, yet the balance shrinks in the long run, because a win followed by a loss leaves {up} × {down} = {round} of the balance. With no end to the trading the line is reached with certainty.',
    },
    mistakes: [
      {
        title: 'Reading it as the chance of losing everything',
        text: 'Risking a share of what is left never takes the balance to zero. The figure is the chance of touching the threshold you chose, measured from the starting balance. Choose the drawdown at which you would stop trading.',
      },
      {
        title: 'Treating the win rate as known',
        text: 'The win rate you type is an estimate from past trades. In example 1 a win rate of {win} gives {prob}. At {winLow}, with nothing else changed, it is {probLow}.',
      },
      {
        title: 'Assuming twice the risk means twice the chance',
        text: 'In example 1, {risk} per trade gives {prob}. Halve it to {riskHalf} and the figure is {probHalf}. Double it to {riskDouble} and it is {probDouble}.',
      },
      {
        title: 'Quoting the figure without its horizon',
        text: 'The numbers of example 1 give {probShort} over {nShort} trades, {prob} over {n} trades and up to {upper} with no end to the trading. The figure means nothing without the number of trades it covers.',
      },
    ],
    allTools: 'All calculators',
  },
  'zh-hant': {
    title: '破產風險計算機',
    description:
      '照你的勝率、賺賠比和單筆風險，算出帳戶在一定筆數內跌到某個回撤門檻的機率。主要結果是精確計算，另外附上固定亂數種子的蒙地卡羅模擬對照，公式和假設都寫在頁面上。',
    lede: '照你的勝率、賺賠比和單筆風險，算出帳戶跌到某個回撤門檻的機率。',
    noscript:
      '這個計算機需要 JavaScript。現在看到的是一開始的例題：勝率 {win}、賺賠比 {payoff}、單筆風險 {risk}、回撤門檻 {dd}、交易 {n} 筆。公式和例題都在下方。',
    fields: {
      win: '勝率',
      payoff: '賺賠比',
      payoffHint: '平均獲利除以平均虧損。2 代表賺一筆的金額是賠一筆的兩倍。',
      risk: '單筆風險',
      riskHint: '一筆虧損的交易賠掉當時餘額的比例。',
      dd: '回撤門檻',
      ddHint: '從起始資金算起：20% 代表帳戶剩下一開始的 80%。',
      trades: '交易筆數',
      tradesUnit: '筆',
      tradesHint: '要往後看幾筆，1 到 {max}。',
    },
    ui: {
      winText: '{value}%',
      withinBar: '{n} 筆之內',
      everBar: '一直交易下去，最多',
      everBarCertain: '一直交易下去',
      barLabel: '同一個比例尺上的兩條橫條，整條代表 100%。{n} 筆之內：{within}。一直交易下去：介於 {lower} 和 {upper} 之間。',
      barLabelCertain:
        '同一個比例尺上的兩條橫條，整條代表 100%。{n} 筆之內：{within}。一直交易下去，遲早會碰到門檻：100%。',
      sentence:
        '勝率 {win}、賺賠比 {payoff}、每筆拿餘額的 {risk} 去冒險，帳戶在 {n} 筆交易之內從起始資金回撤 {dd} 的機率是 {prob}。',
      impossible: '每筆賠 {risk}，至少要連虧 {k} 筆才會回撤 {dd}，所以 {n} 筆之內碰不到這個門檻。',
      sim: '{est} ± {se}',
      simNone: '{paths} 條路徑裡 0 條',
      simAll: '{paths} 條路徑全部',
      simPending: '計算中',
      eventualRange: '{lower} 到 {upper}',
      eventualCertain: '100%',
      edge: '{value}R',
      noEdge: '沒有優勢：每筆的期望值是 {edge}。餘額長期下來會縮水，所以一直交易下去，遲早會碰到門檻。',
      overbet:
        '每筆的期望值是正的（{edge}），但每筆押 {risk} 太大，餘額長期下來還是會縮水（每筆的對數成長率 {growth}）。一直交易下去，遲早會碰到門檻。',
      invalid: '請先修正標示的欄位，才能算出結果。',
      noValue: '無',
      errors: {
        winRate: '勝率要大於 0%、小於 100%。',
        payoff: '賺賠比要大於 0，最大到 {max}。',
        risk: '單筆風險要大於 0%、小於 100%。',
        threshold: '回撤門檻要大於 0%、小於 100%。每筆只拿剩下的餘額的一部分去冒險，帳戶不會歸零，所以碰不到 100%。',
        trades: '交易筆數請填 1 到 {max} 的整數。',
      },
    },
    result: {
      label: '碰到回撤門檻的機率',
      caption: '同一組輸入的其他數字',
      sim: '蒙地卡羅模擬估計（{paths} 條路徑）',
      eventual: '一直交易下去',
      streak: '連虧幾筆會碰到門檻',
      edge: '每筆的期望值',
      growth: '每筆的期望對數成長率',
    },
    assumptions: [
      '固定比例下注：每一筆都拿當時餘額的同一個比例去冒險。這樣的餘額不會歸零，所以這裡的「破產」指的是從起始資金算起的回撤門檻。',
      '每一筆獲利都剛好是風險的賺賠比倍，每一筆虧損都剛好賠掉單筆風險。每筆交易互相獨立，勝率和賺賠比從頭到尾不變。',
      '主要結果是把所有輸贏順序都算過一遍的精確值。蒙地卡羅那一列是模擬估計：{paths} 條路徑、亂數種子 {seed}，± 後面是一個標準誤。',
      '沒有計入手續費、資金費和滑價。',
    ],
    toc: {
      formula: '公式怎麼來的',
      examples: '例題',
      mistakes: '常見錯誤',
    },
    formula: {
      intro:
        '這裡用的模型是固定比例下注：每一筆都拿當時餘額的同一個比例去冒險，贏了加上這個比例乘以賺賠比，輸了扣掉這個比例。不管輸贏怎麼排列，餘額都是：',
      balance: '餘額 = 起始資金 × (1 + 賺賠比 × 單筆風險)^獲利筆數 × (1 − 單筆風險)^虧損筆數',
      ruinLine: '碰到門檻的條件：餘額 ≤ 起始資金 × (1 − 回撤門檻)',
      notZero:
        '這樣的餘額不會歸零，因為每一筆虧損扣的都是剩下的餘額的一部分：每筆賠 {risk}，連虧 {k} 筆之後帳戶還剩 {left}。在這個模型裡，「賠到一毛不剩」的機率不管怎麼輸入都是 0，這個答案沒有用處。所以這一頁請你自己訂一個回撤門檻，算的是碰到這條線的機率。',
      exactHead: '主要結果是精確計算',
      exact:
        '餘額只跟贏了幾筆、輸了幾筆有關，跟順序無關。所以計算機一筆一筆往下走整棵結果樹：還在門檻之上的每一種輸贏筆數組合，把它的機率帶到下一筆；碰到門檻的組合，把它的機率收到一邊。走完最後一筆，收到一邊的機率加起來就是答案。這個過程沒有任何近似，在上面的模型裡它是精確值。',
      closedHead: '封閉解，以及它什麼時候成立',
      closed:
        '教科書上的公式只適用一種特殊情況。如果贏一筆剛好抵銷輸一筆，也就是 (1 + 賺賠比 × 單筆風險) × (1 − 單筆風險) = 1，餘額就是在一把等距的梯子上走。門檻在起點下方 k 階、勝率 p 高於 50% 時，遲早碰到門檻的機率就是經典的賭徒破產公式：',
      classical: 'P(遲早碰到) = ((1 − p) ÷ p)^k',
      bounds:
        '其他賺賠比之下，一筆虧損可能讓餘額直接跌過門檻，沒有精確的封閉解，但有一組上下界（Lundberg 不等式）。先解出第一行裡大於 0 的 θ，遲早碰到門檻的機率就落在第二行的兩端之間：',
      theta: 'p × (1 + 賺賠比 × 單筆風險)^(−θ) + (1 − p) × (1 − 單筆風險)^(−θ) = 1',
      inequality: '((1 − 回撤門檻) × (1 − 單筆風險))^θ < P(遲早碰到) ≤ (1 − 回撤門檻)^θ',
      certain:
        'θ 只有在每筆的期望對數成長率 p × ln(1 + 賺賠比 × 單筆風險) + (1 − p) × ln(1 − 單筆風險) 大於 0 時才存在，這時候餘額長期下來會成長。這個值等於 0 或是負的時候，不管門檻訂得多深，遲早都會碰到，機率是 100%。每筆的期望值是正的，並不保證餘額會成長：押的比例夠大，就算有優勢，餘額長期下來還是會縮水。',
      simHead: '蒙地卡羅模擬對照',
      sim: '第三個數字是模擬出來的，所以是估計值，不是精確值。計算機用固定亂數種子的產生器（mulberry32，種子 {seed}）抽出 {paths} 條隨機的交易路徑，數一數有幾條在指定筆數內碰到門檻。種子是固定的，所以同一組輸入每次都得到同一個估計值，這一頁和你的瀏覽器算出來的也一樣。± 後面是一個標準誤，√(估計值 × (1 − 估計值) ÷ {paths})。精確值應該落在估計值上下大約兩個標準誤之內。',
      tableCaption: '精確值和模擬的對照：勝率 {win}、賺賠比 {payoff}、回撤門檻 {dd}、交易 {n} 筆。每一列都是這一頁的程式算出來的。',
      tableRisk: '單筆風險',
      tableExact: '精確值（{n} 筆之內）',
      tableSim: '蒙地卡羅（{paths} 條路徑）',
      tableEver: '一直交易下去，最多',
      terms: [
        { term: '勝率', text: '以獲利收場的交易佔全部交易的比例，公式裡寫成 p。' },
        { term: '賺賠比', text: '平均獲利除以平均虧損。賺賠比是 2，代表賺一筆的金額是賠一筆的兩倍。' },
        { term: '單筆風險', text: '一筆虧損的交易賠掉當時餘額的比例。' },
        { term: '回撤門檻', text: '從起始資金跌掉多少算是「破產」：你會停手的那個點，或是帳戶小到沒辦法繼續交易的那個點。' },
        { term: '交易筆數', text: '往後看幾筆。筆數越多，碰到門檻的機率只會更高，不會更低。' },
      ],
      sources:
        '出處。賭徒破產公式：W. Feller, An Introduction to Probability Theory and Its Applications, vol. 1, 3rd ed.（Wiley, 1968）第 XIV 章。上下界來自 Wald 恆等式（A. Wald, “On cumulative sums of random variables”, Annals of Mathematical Statistics 15(3), 1944, pp. 283–296），在風險理論裡稱為 Lundberg 不等式：S. Asmussen and H. Albrecher, Ruin Probabilities, 2nd ed.（World Scientific, 2010）。',
      leftOut:
        '真實的交易並不獨立：行情性質改變的時候，虧損常常接連出現。勝率和賺賠比是從有限的樣本估出來的，也會隨時間改變。每筆獲利和虧損的大小不會都一樣，停損也可能成交在比停損價更差的價格。手續費和資金費沒有算進去。從後來的高點算起的回撤，比從起始資金算起的更容易碰到。這些都不在模型裡，所以請把結果當成理想條件下的風險，不要當成上限。',
    },
    examples: {
      first: '例題 1：勝率 {win}、賺賠比 {payoff}',
      second: '例題 2：勝率 {win}、賺賠比 {payoff}，沒有優勢',
      setup: '勝率 {win}、賺賠比 {payoff}，每筆拿餘額的 {risk} 去冒險。門檻是從起始資金回撤 {dd}，往後看 {n} 筆。',
      workWin: '贏一筆，餘額乘以 1 + {payoff} × {r} = {up}',
      workLoss: '輸一筆，餘額乘以 1 − {r} = {down}',
      workStreak: '連虧 {k} 筆剩下 {down}^{k} = {after}，已經在 {level} 以下',
      workEdge: '每筆的期望值 = {p} × {payoff} − {q} = {edge}',
      workGrowth: '每筆的期望對數成長率 = {p} × ln {up} + {q} × ln {down} = {growth}',
      workExact: '{n} 筆之內的精確值 = {prob}',
      workSim: '蒙地卡羅（{paths} 條路徑、種子 {seed}）= {sim}',
      workEver: 'θ = {theta}，一直交易下去：介於 {lower} 和 {upper} 之間',
      workEverCertain: '成長率沒有大於 0，θ 不存在：一直交易下去是 100%',
      resultEdge:
        '每筆的期望值是正的，但在所有可能的 {n} 筆交易當中，還是有 {prob} 會在某個時點碰到回撤 {dd} 這條線。模擬估計是 {sim}，和精確值差了 {gap} 個標準誤。一直交易下去，這個機率最多是 {upper}。',
      resultNoEdge:
        '在所有可能的 {n} 筆交易當中，有 {prob} 會碰到回撤 {dd} 這條線。每筆的期望值是 0，餘額長期下來卻會縮水，因為贏一筆再輸一筆之後，餘額只剩 {up} × {down} = {round}。一直交易下去，一定會碰到這條線。',
    },
    mistakes: [
      {
        title: '把它當成賠光的機率',
        text: '每筆只拿剩下的餘額的一部分去冒險，餘額不會變成 0。這裡算的是碰到你自己訂的門檻的機率，從起始資金算起。門檻請訂在你會停手的那個回撤。',
      },
      {
        title: '把勝率當成已知的數字',
        text: '你填的勝率是從過去的交易估出來的。例題 1 的勝率 {win} 算出來是 {prob}；其他條件不變，勝率換成 {winLow} 就是 {probLow}。',
      },
      {
        title: '以為風險加倍，機率也只是加倍',
        text: '例題 1 每筆押 {risk}，結果是 {prob}。減半成 {riskHalf} 是 {probHalf}，加倍成 {riskDouble} 是 {probDouble}。',
      },
      {
        title: '只講機率，不講看幾筆',
        text: '例題 1 的數字，看 {nShort} 筆是 {probShort}，看 {n} 筆是 {prob}，一直交易下去最多 {upper}。沒有說明涵蓋幾筆交易的機率沒有意義。',
      },
    ],
    allTools: '所有計算機',
  },
});
