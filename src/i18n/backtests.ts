// Strings for /backtests/ and /backtests/<slug>/.
//
// No figure is written here. Every number on those pages is filled in from
// src/data/backtests/*.json through {placeholders}, including the parameter
// values inside the rule sentences ({lookback}, {r_multiple} ...), which are
// named after the keys of the result's `config.params`.
//
// `strategies` is keyed by the engine's strategy name and `params` by the
// parameter name. The rule texts are a short plain-language version of each
// strategy module's docstring in the engine repository, kept to the site's
// budget of about 80 words a screen; the page links to the file for the exact
// wording. A result whose strategy or parameter has no entry here fails the
// build instead of printing a blank.
import { defineStrings } from './strings';

export const backtests = defineStrings({
  en: {
    crumb: 'Backtests',
    na: 'not computed',
    samples: { in_sample: 'In-sample', out_of_sample: 'Out-of-sample' },
    range: '{from} to {to}',
    columns: {
      sample: 'Sample',
      trades: 'Trades',
      winRate: 'Win rate',
      avgR: 'Average R',
      t: 't-statistic',
      totalReturn: 'Total return',
      maxDrawdown: 'Max drawdown',
      verdict: 'Verdict',
      // Head of the first column when the samples are the columns.
      metric: 'Metric',
      period: 'Period',
      strategy: 'Strategy',
    },
    // One line per metric block, chosen by src/lib/backtests/verdict.ts.
    verdict: {
      insufficient: 'Too few trades',
      'not-computable': 'Not computed',
      'loss-clear': 'Clear loss',
      'gain-clear': 'Clear gain',
      'no-difference': 'Cannot be told apart from zero',
    },
    index: {
      title: 'Backtests of perpetual futures strategies, losses included',
      description:
        'Every backtest perpmath has published: trades, win rate, average R, t-statistic and max drawdown, in-sample and out-of-sample, after fees and slippage. Losses stay up.',
      headAllLost: '{n} strategies tested. All {n} lost money.',
      head: '{n} strategies tested, results as they came.',
      sub: 'Fixed rules, public Bybit data, fees and slippage on every fill.',
      primary: 'Run them yourself',
      secondary: 'View on GitHub',
      tableHead: 'Every result',
      caption: 'Fees and slippage included. Funding payments are not.',
      captionPlain: 'Fees and slippage included.',
      ruleHead: 'The verdict rule',
      condition: 'In this order',
      conditions: {
        insufficient: 'Under {min} trades',
        'not-computable': 't not computed',
        'loss-clear': 't ≤ {neg}',
        'gain-clear': 't ≥ {pos}',
        'no-difference': '{neg} < t < {pos}',
      },
      tHead: 'What t measures',
      tBody: 'The average trade after costs, against zero. It assumes independent trades, which flatters it.',
      rHead: 'What R measures',
      rBody: 'A trade’s profit after costs, divided by what it would have lost at its stop before costs.',
      // The four figures above the results. Every value is computed from
      // src/data/backtests/*.json on the page; only the labels live here.
      summary: {
        label: 'All published backtests in four figures',
        strategies: 'Strategies tested',
        oosLost: 'Lost money out-of-sample',
        oosLostNote: 'Out-of-sample total return below zero, after fees and slippage.',
        trades: 'Trades in total',
        tradesNote: '{is} in-sample, {oos} out-of-sample',
        period: 'Data period',
        days: 'days',
      },
      cardLabel: '{name}: in-sample and out-of-sample',
      open: 'Rules, costs and equity curve',
      readHead: 'How to read these numbers',
    },
    detail: {
      title: '{name} backtest on {symbol} {interval}',
      description:
        '{name} on {symbol} {interval} bars: {isTrades} in-sample and {oosTrades} out-of-sample trades, after fees and slippage. Rules, parameters, equity curve and how to rerun it.',
      headLost: '{name} lost money.',
      head: '{name}, tested on {symbol}.',
      sub: 'After costs on {symbol} {interval}: {is} in-sample, {oos} out-of-sample.',
      primary: 'Run it yourself',
      secondary: 'View the code on GitHub',
      chart: {
        head: 'Equity, day by day',
        axis: 'Equity',
        title: 'Equity curve of {name} on {symbol}',
        desc: 'In-sample, {isFrom} to {isTo}: equity went from {isStart} to {isEnd}. Out-of-sample, {oosFrom} to {oosTo}: from {oosStart} to {oosEnd}. The lowest daily point was {min}, the highest {max}.',
        caption: 'Each sample starts again from {capital}. The value axis starts at 0.',
      },
      // Drawn from the same daily equity points as the chart above. {isDd},
      // {oosDd} and the days are computed on the page; {is} and {oos} are the
      // engine's own max drawdown from the result file.
      drawdown: {
        head: 'Drawdown, day by day',
        axis: 'Drawdown',
        title: 'Drawdown of {name} on {symbol}',
        desc: 'From the daily equity points. In-sample, the deepest day was {isDd} below the earlier high, on {isDay}. Out-of-sample, {oosDd}, on {oosDay}.',
        caption:
          'How far equity sits below its earlier high, one point a day. The axis runs from 0 to −100%, to scale. The engine measures max drawdown trade by trade ({is} in-sample, {oos} out-of-sample), so it can be deeper than the lowest daily point.',
      },
      distribution: {
        note: 'No histogram of trade returns is drawn here: the result file on this site keeps the daily equity points, not the list of trades. Every trade is in the full result on GitHub.',
      },
      compare: {
        label: 'In-sample and out-of-sample, side by side',
      },
      sections: {
        rules: 'The rules',
        assumptions: 'Assumptions and limits',
      },
      result: {
        head: 'After fees and slippage',
        totalReturn: { in_sample: 'Total return, in-sample', out_of_sample: 'Total return, out-of-sample' },
        verdictLine: '{verdict}: t is {t} over {n} trades.',
        computed: 'Computed by perpmath {version} on {date}. A backtest is arithmetic on past prices, not a forecast.',
      },
      winRate: {
        head: 'Win rate, drawn to scale',
        barLabel: '{sample} win rate: {pct}, {wins} winning trades out of {trades}.',
        line: '{sample}: {pct}, {wins} wins in {trades} trades',
        full: 'Full width: all {trades} trades',
        note: 'A win is a trade with a profit after costs.',
      },
      params: {
        head: 'Fixed parameters',
        note: 'Set before the first run on real data. Not adjusted since.',
      },
      data: {
        head: 'Data',
        market: 'Market',
        marketValue: '{symbol}, {interval} bars, Bybit public data',
        first: 'First bar',
        last: 'Last bar',
        bars: 'Bars',
        barsValue: '{bars}, {missing} missing',
        split: 'Out-of-sample from',
        hash: 'Data file SHA-256',
        resultHash: 'Result file SHA-256',
      },
      costs: {
        head: 'Costs',
        fee: 'Fee',
        feeValue: '{rate} per side',
        slippage: 'Slippage',
        slippageValue: '{rate} per fill, against you',
        size: 'Position size',
        sizeValue: '{size} of equity',
        capital: 'Starting capital',
        note: 'Fee: Bybit’s base taker rate, so check the current table. Slippage: an assumption, not a measurement.',
      },
      fills: {
        head: 'Fills',
        signal: 'Decision',
        signalValue: 'Bar close',
        fill: 'Fill',
        fillValue: 'Next bar open',
        both: 'Stop and target in one bar',
        bothValue: 'Stop first',
        lookahead: 'Look-ahead check',
        lookaheadValue: 'Passed, {runs} shortened runs',
      },
      omitted: {
        head: 'What is not modelled',
        funding: 'Funding payments.',
        items: [
          'Leverage, margin and liquidation.',
          'Maker fees, partial fills, latency, order-book depth and market impact.',
          'The order of events inside a bar, beyond stop-first.',
        ],
      },
      run: {
        head: 'Run it yourself',
        install: 'Install the engine',
        full: 'Full result',
      },
      back: 'All backtests',
    },
    params: {
      atr_period: 'ATR length, in bars',
      min_gap_atr: 'Smallest gap, in ATR',
      max_wait_bars: 'Longest wait, in bars',
      stop_buffer_atr: 'Stop buffer, in ATR',
      r_multiple: 'Target, in R',
      lookback: 'Range length, in bars',
      fast_period: 'Fast average, in bars',
      slow_period: 'Slow average, in bars',
      stop_atr_mult: 'Stop distance, in ATR',
    },
    strategies: {
      fvg: {
        name: 'Fair value gap entry',
        short: 'Fair value gap',
        rules: [
          {
            head: 'The gap',
            text: 'Three candles where the first and third do not overlap. The zone between must be at least {min_gap_atr} × ATR tall.',
          },
          {
            head: 'The wait',
            text: 'The gap waits up to {max_wait_bars} bars for price to return. Each gap is used once at most.',
          },
          {
            head: 'The entry',
            text: 'The first bar back in the zone decides: a close beyond the far edge drops the gap, anything else enters in its direction.',
          },
          {
            head: 'Not a limit order',
            text: 'Entry is a market order at the next bar’s open, not a limit order at the gap’s edge. The fill can land anywhere.',
          },
          {
            head: 'The exit',
            text: 'Stop: {stop_buffer_atr} × ATR beyond the zone’s far edge. Target: {r_multiple} times the distance from fill to stop. One position at a time.',
          },
        ],
      },
      liquidity_sweep: {
        name: 'Liquidity sweep fade',
        short: 'Liquidity sweep',
        rules: [
          {
            head: 'The range',
            text: 'The prior high is the highest high of the {lookback} bars before the current bar; the prior low, their lowest low.',
          },
          {
            head: 'The sweep',
            text: 'High above the prior high, close back below: short. Low below the prior low, close back above: long. Both in one bar: no signal.',
          },
          {
            head: 'The stop',
            text: 'Short: the sweep bar’s high plus {stop_buffer_atr} × ATR. Long: its low minus the same. ATR is averaged over {atr_period} bars.',
          },
          {
            head: 'The target',
            text: '{r_multiple} times the distance from fill to stop. One position at a time; signals during an open position are ignored.',
          },
        ],
      },
      ma_cross: {
        name: 'Moving-average cross',
        short: 'MA cross',
        rules: [
          {
            head: 'The averages',
            text: 'Fast is the simple average of the last {fast_period} closes. Slow, of the last {slow_period}.',
          },
          {
            head: 'The cross',
            text: 'Fast crosses above slow: close any short, go long. Fast crosses below slow: close any long, go short.',
          },
          {
            head: 'The stop',
            text: 'Long: the signal bar’s close minus {stop_atr_mult} × ATR. Short: the close plus the same. ATR is averaged over {atr_period} bars.',
          },
          {
            head: 'No target',
            text: 'No profit target. A position ends at the opposite cross or the stop. After a stop it waits, flat, for the next cross.',
          },
        ],
      },
    },
  },
  'zh-hant': {
    crumb: '回測',
    na: '無法計算',
    samples: { in_sample: '樣本內', out_of_sample: '樣本外' },
    range: '{from} 至 {to}',
    columns: {
      sample: '樣本',
      trades: '交易筆數',
      winRate: '勝率',
      avgR: '平均 R',
      t: 't 值',
      totalReturn: '總報酬率',
      maxDrawdown: '最大回撤',
      verdict: '判讀',
      metric: '指標',
      period: '期間',
      strategy: '策略',
    },
    verdict: {
      insufficient: '交易筆數太少',
      'not-computable': '無法計算',
      'loss-clear': '明確虧損',
      'gain-clear': '明確獲利',
      'no-difference': '和零分不出差別',
    },
    index: {
      title: '永續合約策略回測結果，賠錢的也照登',
      description:
        'perpmath 公開過的每一份回測：交易筆數、勝率、平均 R、t 值與最大回撤，樣本內與樣本外分開列，手續費與滑價都算進去。賠錢的結果也不會拿掉。',
      headAllLost: '測了 {n} 個策略，{n} 個都賠錢。',
      head: '測了 {n} 個策略，結果照實列出。',
      sub: '規則固定，用 Bybit 公開資料，每一筆成交都扣手續費與滑價。',
      primary: '自己跑一次',
      secondary: '到 GitHub 看程式碼',
      tableHead: '所有回測結果',
      caption: '已扣掉手續費與滑價，但沒有計入資金費率。',
      captionPlain: '已扣掉手續費與滑價。',
      ruleHead: '判讀規則',
      condition: '依這個順序',
      conditions: {
        insufficient: '交易少於 {min} 筆',
        'not-computable': 't 值算不出來',
        'loss-clear': 't ≤ {neg}',
        'gain-clear': 't ≥ {pos}',
        'no-difference': '{neg} < t < {pos}',
      },
      tHead: 't 值量的是什麼',
      tBody: '拿扣掉成本後的平均單筆報酬去跟零比。計算時假設每筆交易互相獨立，這會讓數字偏好看。',
      rHead: 'R 量的是什麼',
      rBody: '一筆交易扣掉成本後的損益，除以它剛好在停損出場、不計成本時會賠的金額。',
      summary: {
        label: '所有回測的四個數字',
        strategies: '測過的策略',
        oosLost: '樣本外賠錢',
        oosLostNote: '樣本外總報酬率小於零的策略數，已扣手續費與滑價。',
        trades: '合計交易筆數',
        tradesNote: '樣本內 {is} 筆，樣本外 {oos} 筆',
        period: '資料期間',
        days: '天',
      },
      cardLabel: '{name}：樣本內與樣本外',
      open: '看規則、成本與權益曲線',
      readHead: '這些數字怎麼讀',
    },
    detail: {
      title: '{name}回測：{symbol} {interval}',
      description:
        '{name}在 {symbol} {interval} K 線上的回測：樣本內 {isTrades} 筆、樣本外 {oosTrades} 筆交易，已計入手續費與滑價。附規則、參數、權益曲線，以及自己重跑一次的指令。',
      headLost: '{name}，回測結果是賠錢。',
      head: '{name}在 {symbol} 的回測結果。',
      sub: '{symbol} {interval} K 線，扣掉成本後：樣本內 {is}，樣本外 {oos}。',
      primary: '自己跑一次',
      secondary: '到 GitHub 看程式碼',
      chart: {
        head: '每日權益曲線',
        axis: '權益',
        title: '{name}在 {symbol} 的權益曲線',
        desc: '樣本內（{isFrom} 至 {isTo}）：權益從 {isStart} 變成 {isEnd}。樣本外（{oosFrom} 至 {oosTo}）：從 {oosStart} 變成 {oosEnd}。每日最低點 {min}，最高點 {max}。',
        caption: '樣本內和樣本外各自從 {capital} 重新開始。縱軸從 0 起算。',
      },
      drawdown: {
        head: '每日回撤',
        axis: '回撤',
        title: '{name}在 {symbol} 的回撤',
        desc: '由每日權益點算出。樣本內最深的一天比先前高點低 {isDd}（{isDay}）；樣本外最深 {oosDd}（{oosDay}）。',
        caption:
          '每天一個點，量的是權益比先前最高點低多少。縱軸從 0 畫到 −100%，照比例畫。回測工具的最大回撤是逐筆交易量的（樣本內 {is}，樣本外 {oos}），所以可能比圖上每日的最低點更深。',
      },
      distribution: {
        note: '這一頁沒有畫單筆報酬的分佈圖：本站的結果檔只留每日權益點，沒有留逐筆交易。每一筆交易都在 GitHub 上的完整結果裡。',
      },
      compare: {
        label: '樣本內與樣本外對照',
      },
      sections: {
        rules: '策略規則',
        assumptions: '假設與限制',
      },
      result: {
        head: '扣掉手續費與滑價之後',
        totalReturn: { in_sample: '樣本內總報酬率', out_of_sample: '樣本外總報酬率' },
        verdictLine: '{verdict}：{n} 筆交易，t 值 {t}。',
        computed: '由 perpmath {version} 於 {date} 算出。回測只是對過去的價格做計算，不是預測。',
      },
      winRate: {
        head: '勝率，照比例畫',
        barLabel: '{sample}勝率 {pct}：{trades} 筆交易當中有 {wins} 筆獲利。',
        line: '{sample}：{pct}，{trades} 筆當中贏 {wins} 筆',
        full: '整條代表全部 {trades} 筆交易',
        note: '扣掉成本後還有獲利的交易才算贏。',
      },
      params: {
        head: '固定參數',
        note: '在第一次用真實資料跑之前就定下來，之後沒有再調整。',
      },
      data: {
        head: '資料',
        market: '市場',
        marketValue: '{symbol}，{interval} K 線，Bybit 公開資料',
        first: '第一根 K 線',
        last: '最後一根 K 線',
        bars: 'K 線數量',
        barsValue: '{bars} 根，缺 {missing} 根',
        split: '樣本外起點',
        hash: '資料檔 SHA-256',
        resultHash: '結果檔 SHA-256',
      },
      costs: {
        head: '成本',
        fee: '手續費',
        feeValue: '單邊 {rate}',
        slippage: '滑價',
        slippageValue: '每次成交 {rate}，一律往不利的方向算',
        size: '倉位大小',
        sizeValue: '權益的 {size}',
        capital: '起始資金',
        note: '手續費代表 Bybit 的基本吃單費率，實際費率請查目前的費率表。滑價是假設值，不是量出來的。',
      },
      fills: {
        head: '成交方式',
        signal: '做決定的時間',
        signalValue: 'K 線收盤時',
        fill: '成交價',
        fillValue: '下一根 K 線的開盤價',
        both: '同一根同時碰到停損和停利',
        bothValue: '當作先碰到停損',
        lookahead: '偷看未來檢查',
        lookaheadValue: '通過，縮短資料重跑 {runs} 次',
      },
      omitted: {
        head: '沒有算進去的東西',
        funding: '資金費率。',
        items: [
          '槓桿、保證金與強制平倉。',
          '掛單手續費、部分成交、延遲、訂單簿深度與市場衝擊。',
          '同一根 K 線內事件的先後順序；只有「先停損」這一條規則。',
        ],
      },
      run: {
        head: '自己跑一次',
        install: '安裝回測工具',
        full: '完整結果',
      },
      back: '所有回測',
    },
    params: {
      atr_period: 'ATR 長度（K 線根數）',
      min_gap_atr: '缺口最小高度（ATR 倍數）',
      max_wait_bars: '最長等待（K 線根數）',
      stop_buffer_atr: '停損緩衝（ATR 倍數）',
      r_multiple: '停利目標（R 倍數）',
      lookback: '區間長度（K 線根數）',
      fast_period: '快線長度（K 線根數）',
      slow_period: '慢線長度（K 線根數）',
      stop_atr_mult: '停損距離（ATR 倍數）',
    },
    strategies: {
      fvg: {
        name: '公平價值缺口進場',
        short: '公平價值缺口',
        rules: [
          {
            head: '缺口',
            text: '連續三根 K 線，第一根和第三根的價格範圍沒有重疊，中間空出來的區域就是缺口。缺口高度至少要有 {min_gap_atr} 倍 ATR。',
          },
          {
            head: '等待',
            text: '缺口形成後，最多等 {max_wait_bars} 根 K 線讓價格回來。每個缺口頂多用一次，不管最後有沒有進場。',
          },
          {
            head: '進場',
            text: '第一根回到缺口的 K 線決定結果：收盤價穿過缺口的另一側，這個缺口就作廢；沒有穿過，就照缺口的方向進場。',
          },
          {
            head: '不是限價單',
            text: '進場用的是市價單，在下一根 K 線的開盤價成交，不是掛在缺口邊緣的限價單，所以成交價可能落在任何位置。',
          },
          {
            head: '出場',
            text: '停損放在缺口另一側再往外 {stop_buffer_atr} 倍 ATR。停利目標是成交價到停損距離的 {r_multiple} 倍。同一時間只持有一個倉位。',
          },
        ],
      },
      liquidity_sweep: {
        name: '流動性掃蕩反向進場',
        short: '流動性掃蕩',
        rules: [
          {
            head: '區間',
            text: '前高和前低，分別是這根 K 線之前 {lookback} 根的最高價和最低價。',
          },
          {
            head: '掃蕩',
            text: '最高價突破前高、收盤卻收回前高之下：做空。最低價跌破前低、收盤卻收回前低之上：做多。同一根兩邊都掃到，就不進場。',
          },
          {
            head: '停損',
            text: '做空時，停損放在掃蕩那根 K 線的最高價再加 {stop_buffer_atr} 倍 ATR；做多時，放在最低價再減同樣的距離。ATR 取最近 {atr_period} 根的平均。',
          },
          {
            head: '停利目標',
            text: '成交價到停損距離的 {r_multiple} 倍。同一時間只持有一個倉位，持倉期間出現的訊號一律略過。',
          },
        ],
      },
      ma_cross: {
        name: '均線交叉',
        short: '均線交叉',
        rules: [
          {
            head: '兩條均線',
            text: '快線是最近 {fast_period} 根收盤價的簡單平均，慢線是最近 {slow_period} 根的簡單平均。',
          },
          {
            head: '交叉',
            text: '快線由下往上穿過慢線：平掉空單並做多。快線由上往下穿過慢線：平掉多單並做空。',
          },
          {
            head: '停損',
            text: '做多時，停損放在訊號那根 K 線的收盤價減 {stop_atr_mult} 倍 ATR；做空時則是加上同樣的距離。ATR 取最近 {atr_period} 根的平均。',
          },
          {
            head: '沒有停利目標',
            text: '這個策略不設停利目標。倉位在反向交叉或停損時結束。停損出場後空手等下一次交叉。',
          },
        ],
      },
    },
  },
});
