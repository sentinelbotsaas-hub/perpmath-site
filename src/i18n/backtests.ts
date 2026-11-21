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
//
// `definitions` is for the strategies whose idea has no agreed definition
// (order blocks, breaks of structure, breaker blocks). Keyed like
// `strategies`, it holds the two extra parts of their pages, both taken from
// the same docstring: the judgement calls the module fixes ("Judgement
// calls"), and what the engine cannot do that the usual description assumes
// ("Approximation forced by the engine"). A strategy without an entry has no
// such section on its page.
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
        'Every backtest perpmath has published: total return and max drawdown, in-sample and out-of-sample, after costs, with the rules and code behind each. Losses stay up.',
      headAllLost: '{n} strategies tested. All {n} lost money.',
      head: '{n} strategies tested, results as they came.',
      // Chosen by src/lib/backtests/overview.ts when every signal strategy
      // lost in both samples and the one grid gained without price leaving
      // its range. {s} and {g} are counts; {is} and {oos} the grid's returns.
      headRanged: '{s} signal strategies lost money. {g} grid gained while price stayed in its range.',
      sub: 'Fixed rules, public Bybit data, fees and slippage on every fill.',
      subRanged:
        'Fixed rules, public Bybit data, costs on every fill. The grid’s {is} and {oos} come from one year in which price never closed outside its range, and its in-sample bounds were known only afterwards.',
      primary: 'Run them yourself',
      secondary: 'View on GitHub',
      tableHead: 'Every result',
      signalsHead: 'Signal strategies',
      gridHead: 'Grid',
      caption: 'Fees and slippage included. Funding payments are not.',
      captionPlain: 'Fees and slippage included.',
      captionMixed: 'Fees and slippage included. Funding is counted for the grid only.',
      // The funding half of the captions alone, for the home page, which has already said the rest.
      fundingNone: 'Funding payments are not counted.',
      fundingGridOnly: 'Funding is counted for the grid only.',
      gridCaption: 'Maker and taker fees, slippage and funding included.',
      gridCaptionPlain: 'Maker and taker fees and slippage included. Funding is not.',
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
      gridWhyHead: 'Why the grid has no verdict',
      gridWhyBody:
        'Its round trips are not independent bets, so the engine reports no t-statistic for it. Read it as an accounting example.',
      // The four figures above the results. Every value is computed from
      // src/data/backtests/*.json on the page; only the labels live here.
      summary: {
        label: 'All published backtests in four figures',
        strategies: 'Strategies tested',
        backtests: 'Backtests published',
        backtestsNote: '{s} signal strategies and {g} grid, on {markets}',
        oosLost: 'Lost money out-of-sample',
        oosLostNote: 'Out-of-sample total return below zero, after fees and slippage.',
        oosLostNoteRanged:
          'Out-of-sample total return below zero, after costs. The one above zero is the grid, in a period when price stayed inside its range.',
        trades: 'Trades in total',
        tradesNote: '{is} in-sample, {oos} out-of-sample',
        tradesNoteGrid: '{is} in-sample, {oos} out-of-sample, plus {trips} grid round trips',
        period: 'Data period',
        days: 'days',
      },
      cardLabel: '{name}: in-sample and out-of-sample',
      // Under the table of a card whose sample has fewer than {min} trades.
      thin: '{sample}: {trades} trades, under {min}. Read every number in that column as noise.',
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
          'How far equity sits below its earlier high, one point a day. The axis runs from 0 to −100%, to scale. The engine measures max drawdown at every bar close, with an open position valued at that close ({is} in-sample, {oos} out-of-sample), so it can be deeper than the lowest daily point.',
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
      // The warning under the two returns when a sample has fewer than {min}
      // trades (the engine's `insufficient_sample`). Every figure is filled in
      // from that sample's metric block. `title` is also the short flag on
      // /bot/.
      thin: {
        title: '{sample}: {trades} trades, too few to read',
        body: 'Under {min} trades the engine marks a sample as insufficient. Treat every number in it as noise, whichever way it points.',
        // Added when the average R is above zero while equity fell.
        rUp: 'The average R here is {avgR}, and equity still fell {loss} over the same period. R counts every trade equally, whatever the distance to its stop; the return is compounded on the full position, so trades with a far stop move it more. At {trades} trades neither figure is a result.',
        // Added when signals were skipped because a position was open.
        why: 'A position was held for {held} bars on average, and {skipped} signals came while one was open and were ignored. The parameters were not changed to get more trades.',
      },
      // The section of a strategy that has an entry in `definitions`.
      definition: {
        head: 'The definition used here, and the judgement calls it fixes',
        only: 'Ideas like this one have no agreed definition: two teachers will mark the same chart differently. The result on this page is a result for this one definition, not for every reading of the idea.',
        callsLabel: 'Judgement calls and how each is fixed',
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
      swing_left: 'Swing: bars before the pivot',
      swing_right: 'Swing: bars after the pivot',
      impulse_bars: 'Shortest impulse, in bars',
      min_impulse_atr: 'Smallest impulse, in ATR',
    },
    // The grid backtest: /backtests/<slug>/ of a grid result, its card on
    // /backtests/, its row on the home page and on /bot/. Like the rest of
    // this file it holds no figure: prices, rates and counts are placeholders
    // filled from the result file. Sentences that depend on a setting are
    // keyed by the engine's own value (neutral, geometric, continue ...).
    grid: {
      name: 'Grid bot',
      short: 'Grid',
      chartName: 'the grid',
      directions: { neutral: 'neutral', long: 'long', short: 'short' },
      spacings: { geometric: 'geometric', arithmetic: 'arithmetic' },
      outOfRange: { continue: 'keep running', stop: 'stop', close: 'close everything' },
      costsAll: 'fees, slippage and funding',
      costsNoFunding: 'fees and slippage',
      description:
        'A {count}-cell {direction} grid on {symbol} {interval} bars: {isTrips} in-sample and {oosTrips} out-of-sample round trips, after {costs}. Rules, limits and how to rerun it.',
      headRanged: 'A {direction} grid on {symbol} gained, on two conditions.',
      headLost: 'A {direction} grid on {symbol} lost money.',
      head: 'A {direction} grid on {symbol}, as it came.',
      sub: 'After {costs} on {symbol} {interval}: {is} in-sample, {oos} out-of-sample.',
      resultHead: 'After {costs}',
      // One short line under each headline return, and the same facts in full
      // in the box that follows.
      notes: {
        hindsight: 'Bounds taken from this period’s own low and high.',
        fixed: 'Bounds fixed before the run.',
        inRange: 'Every bar closed inside the range.',
        outOfRange: '{pct} of bar closes were outside the range.',
      },
      premises: {
        title: 'Read this before the numbers',
        hindsight: {
          head: 'The in-sample bounds were known only afterwards.',
          body: 'The grid runs from {lower} to {upper}, the lowest low and the highest high of the in-sample period itself. Nobody had that range on the first day, and with it price cannot leave the grid: the in-sample result is optimistic by construction.',
        },
        inRange: {
          head: 'Out-of-sample, price never left the range.',
          body: 'Every out-of-sample bar closed inside it. A 1x long over the same period returned {bh}, and the grid closed its last position for {inv} USDT. Against a trend a grid carries a growing position, so a period that leaves the range would look very different.',
        },
        outOfRange: {
          head: 'Out-of-sample, price left the range.',
          body: '{pct} of out-of-sample bar closes were outside the grid. A 1x long held over the same period returned {bh}.',
        },
        close: 'One period, one market, one config: an accounting example, not evidence that a grid makes money.',
      },
      compare: {
        label: 'Grid result, in-sample and out-of-sample',
        roundTrips: 'Round trips',
        fills: 'Fills',
        buyHold: 'Buy and hold',
        buyHoldFunding: 'Buy and hold, with funding',
        outside: 'Bar closes outside the range',
        liquidated: 'Liquidated',
        yes: 'Yes',
        no: 'No',
        caption:
          'Round trip: one cell opened and closed by its own grid orders. Buy and hold: a 1x long perpetual from the first open to the last close. Computed by perpmath {version} on {date}. A backtest is arithmetic on past prices, not a forecast.',
      },
      ledger: {
        head: 'Where the change in equity came from',
        label: 'Change in equity by source, in USDT',
        source: 'USDT',
        roundTrips: 'Completed round trips, before fees',
        inventory: 'Positions closed at market',
        fees: 'Fees',
        funding: 'Funding',
        liquidation: 'Lost at liquidation',
        net: 'Change in equity',
        note: 'On {capital} USDT of starting capital in each sample. The round-trip line is the engine’s trading profit minus the positions closed at market. Lines are rounded, so they can miss the total by a cent.',
        inventoryLine: '{sample}: {qty} {base} still open at the last bar, closed at {price}.',
      },
      chart: {
        drawdownCaption:
          'How far equity sits below its earlier high, one point a day. The axis runs from 0 to −100%, to scale. The engine measures max drawdown at every bar close ({is} in-sample, {oos} out-of-sample), so it can be deeper than the lowest daily point.',
        note: 'The file on this site keeps the daily equity points, not the list of fills. Every fill is in the full result on GitHub.',
      },
      sections: {
        rules: 'The grid rules',
        paths: 'Inside a bar: four paths',
        variants: 'The same run with one cost changed',
        assumptions: 'Assumptions and limits',
      },
      rules: {
        levels: {
          head: 'Levels',
          geometric: '{count} cells between {lower} and {upper}, so {levels} price levels. Geometric spacing: every cell is {width} wide.',
          arithmetic:
            '{count} cells between {lower} and {upper}, so {levels} price levels. Arithmetic spacing: equal width in price, {widthMin} to {widthMax} in percent.',
        },
        cells: {
          head: 'Cells',
          text: 'A long cell buys at its lower level and sells at its upper level. A short cell sells at its upper level and buys back at its lower level. One position a cell. A position closed by its own grid order is one round trip.',
        },
        size: {
          head: 'Size',
          text: 'Every cell opens {cellNotional} USDT of notional: starting capital × leverage ÷ number of cells.',
        },
        start: {
          head: 'Start',
          neutral:
            'The grid is placed at the first open of each sample. Cells below that price are long cells, cells above it are short cells. Nothing is traded at the start.',
          long: 'The grid is placed at the first open of each sample. Every cell is a long cell, and the ones above that price are bought at market straight away.',
          short:
            'The grid is placed at the first open of each sample. Every cell is a short cell, and the ones below that price are sold short at market straight away.',
        },
        fills: {
          head: 'Fills',
          text: 'An order fills only when price trades strictly through its level, and at the level, never at a better price, even after a gap. Slippage is then applied against you.',
        },
        range: {
          head: 'Leaving the range',
          continue:
            'All orders and positions stay in place when price leaves the range. That is what exchange grid bots do unless a stop is set.',
          stop: 'When price leaves the range the orders are cancelled and the position is kept to the end of the sample.',
          close: 'When price leaves the range the orders are cancelled and everything is closed with a market order at the bound.',
        },
        liquidation: {
          head: 'Leverage and liquidation',
          text: 'Leverage {leverage}, isolated margin: the grid’s whole equity backs its net position. It is liquidated when equity falls to {mmr} of the position’s value.',
        },
        end: {
          head: 'End of a sample',
          text: 'Anything still open at a sample’s last bar is closed at its close with a market order. Each sample starts flat with the same capital.',
        },
      },
      params: {
        head: 'Fixed parameters',
        note: 'Ordinary defaults, chosen once. No other grid settings were run to pick them.',
        lower: 'Lower bound',
        upper: 'Upper bound',
        boundsHindsight: 'in-sample low and high',
        boundsFixed: 'fixed in the config',
        grid_count: 'Cells',
        spacing: 'Spacing',
        direction: 'Direction',
        leverage: 'Leverage',
        out_of_range: 'When price leaves the range',
        cell_notional: 'Notional per cell, USDT',
        cell_width: 'Cell width',
        widthRange: '{min} to {max}',
      },
      paths: {
        intro:
          'A {interval} bar does not say whether its high or its low came first. For a grid it matters: an order bought on the way down can be sold on the way back up inside the same bar. The engine walks every bar both ways and keeps the path that leaves less equity at the close. The other rows show how far that choice moves the result.',
        bound: 'None of the four is a hard bound. Real prices swing many times inside a bar, which would fill more orders than any of these paths.',
        readme: '1-minute check in the README',
        label: 'The same grid under four intrabar paths',
        path: 'Path inside a bar',
        used: 'published',
        names: {
          worst_of_two: 'Worse of the two, bar by bar',
          low_first: 'Low first',
          high_first: 'High first',
          best_of_two: 'Better of the two, bar by bar',
        },
      },
      variants: {
        intro: 'Two costs decide much of a grid result: the fee on every fill, and the funding on the position it carries.',
        label: 'The same grid at the taker fee and without funding',
        run: 'Run',
        published: 'As published',
        publishedNote: '{maker} on grid fills, funding counted',
        publishedNoteNoFunding: '{maker} on grid fills',
        taker: 'Grid fills at the taker rate',
        takerNote: '{taker} instead of {maker}',
        noFunding: 'Funding left out',
        fees: 'Fees paid, USDT',
      },
      costs: {
        head: 'Costs',
        gridFee: 'Grid fills',
        gridFeeValue: '{rate} per fill, the maker rate',
        takerFee: 'Market orders',
        takerFeeValue: '{rate} per fill, the taker rate',
        slippage: 'Slippage',
        slippageValue: '{rate} per fill, against you, limit fills included',
        roundTrip: 'One round trip',
        roundTripValue: '{cost} of the cell’s notional. The narrowest cell is {width} wide.',
        funding: 'Funding',
        fundingValue: 'Bybit’s settled rates, {records} settlements in the data',
        fundingOff: 'Not counted',
        mmr: 'Maintenance margin',
        mmrValue: '{rate}, Bybit risk tier 1',
        capital: 'Starting capital',
        note: 'Fees are Bybit’s VIP 0 rates for perpetual contracts, read on {date}. Rates depend on your account tier and change, so check the current table. Slippage is an assumption, not a measurement.',
        feeTable: 'Bybit’s fee table',
      },
      timing: {
        head: 'Fills and timing',
        start: 'Grid placed',
        startValue: 'First open of each sample',
        order: 'A grid order fills',
        orderValue: 'Strictly through its level, at the level',
        path: 'Inside a bar',
        fundingPrice: 'Funding charged on',
        fundingPriceValue: 'The bar close at each settlement, not the mark price',
        lookahead: 'Look-ahead check',
        lookaheadValue: 'Passed, {runs} shortened runs',
      },
      limits: {
        head: 'Limits',
        items: [
          'No queue position, partial fills or latency. A fill on a strict cross of the level is an assumption, not order-book data.',
          'Liquidation uses risk tier 1 only and ignores the liquidation fee beyond losing the remaining margin.',
          'Exchange grid bots differ in details: how the start position is bought, quantity per grid, trailing ranges. This follows the rules above, not any exchange’s bot.',
          'There is no t-statistic, because the round trips of a grid are not independent bets.',
          'The look-ahead check shows the simulator does not read later bars. It cannot show that the bounds were chosen without hindsight.',
        ],
        // Added to the list when neither sample left the range.
        rangeUntested: 'Price never left the range in this run, so the range-exit rule was never exercised.',
      },
      run: {
        fundingRecords: 'Funding records',
        fundingRecordsValue: '{records}, {from} to {to}',
        fundingHash: 'Funding file SHA-256',
        readme: 'Grid section of the README',
      },
      // The card on /backtests/ and the row on the home page and on /bot/.
      card: {
        label: '{name}: in-sample and out-of-sample',
        reading: 'Keep in mind',
        hindsight: 'Bounds known only afterwards',
        fixed: 'Bounds fixed beforehand',
        inRange: 'Price never left the range',
        outOfRange: 'Price left the range',
        open: 'Rules, paths and equity curve',
      },
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
      // The three below describe the long side; the short side is the exact
      // mirror image, as in the engine's docstrings.
      order_block: {
        name: 'Order block return entry',
        short: 'Order block',
        rules: [
          {
            head: 'The impulse',
            text: 'A run of {impulse_bars} or more up bars in a row (close above open) that has risen at least {min_impulse_atr} × ATR from the open of its first bar. Down runs are the mirror image, here and below.',
          },
          {
            head: 'The break',
            text: 'The run’s latest close must be above the latest confirmed swing high, which the bar before the run had not closed above, and above the high of the bar before the run.',
          },
          {
            head: 'The swing high',
            text: 'A bar whose high is above the highs of the {swing_left} bars before it and the {swing_right} bars after it. It is known, and used, only once those {swing_right} bars have closed.',
          },
          {
            head: 'The block',
            text: 'The bar immediately before the run, if it is a down bar. The zone is that whole candle, low to high, wicks included. ATR is the average of the last {atr_period} true ranges on that bar.',
          },
          {
            head: 'The return',
            text: 'The block waits up to {max_wait_bars} bars. The first bar whose low reaches the top of the zone decides: a close below the bottom drops the block, anything else goes long. Each block is used once.',
          },
          {
            head: 'The exit',
            text: 'Stop: {stop_buffer_atr} × ATR below the bottom of the zone. Target: {r_multiple} times the distance from fill to stop. One position at a time.',
          },
        ],
      },
      break_of_structure: {
        name: 'Break of structure entry',
        short: 'Break of structure',
        rules: [
          {
            head: 'The swing',
            text: 'A swing high is a bar whose high is above the highs of the {swing_left} bars before it and the {swing_right} bars after it. A swing low is the mirror image, on lows. A tie with a neighbour means no swing.',
          },
          {
            head: 'Confirmation',
            text: 'A swing is known only when the {swing_right} bars after it have closed. Before that it is neither a level to break nor a stop. A newly confirmed swing replaces the older one, higher or lower.',
          },
          {
            head: 'The break',
            text: 'A close above the latest swing high: go long. A close below the latest swing low: go short. A wick through the level without a close beyond it is not a break.',
          },
          {
            head: 'Once per level',
            text: 'Each swing level can be broken once, whether or not the break led to a trade. The next signal on that side needs a newly confirmed swing.',
          },
          {
            head: 'The stop',
            text: 'Long: the latest swing low minus {stop_buffer_atr} × ATR. Short: the latest swing high plus the same. ATR is averaged over {atr_period} bars. With no confirmed swing on that side, or a stop that is not on the losing side of the close, there is no signal.',
          },
          {
            head: 'The target',
            text: '{r_multiple} times the distance from fill to stop. One position at a time; breaks during an open position are ignored.',
          },
        ],
      },
      breaker_block: {
        name: 'Breaker block retest entry',
        short: 'Breaker block',
        rules: [
          {
            head: 'The order block',
            text: 'Found exactly as in the order block backtest, same code and same parameters: the down bar before an up run of {impulse_bars} or more bars that covers {min_impulse_atr} × ATR and closes above the latest swing high ({swing_left} bars before, {swing_right} after). The zone is that whole candle.',
          },
          {
            head: 'The failure',
            text: 'Within {max_wait_bars} bars of the block forming, a bar closes below the bottom of the zone. From that close the zone is a bearish breaker. A bearish block closed through upwards becomes a bullish breaker, the mirror image.',
          },
          {
            head: 'The retest',
            text: 'The breaker waits up to {max_wait_bars} bars from the bar that broke it. The first bar whose high reaches the bottom of the zone decides: a close above the top drops the breaker, anything else goes short.',
          },
          {
            head: 'Once each',
            text: 'Each breaker is used once, whether or not it leads to a trade. If several trigger on the same bar, the most recently broken one is used.',
          },
          {
            head: 'The stop',
            text: 'Short: {stop_buffer_atr} × ATR above the top of the zone. Long, from a bullish breaker: the same distance below the bottom. ATR is averaged over {atr_period} bars on the bar that broke the block.',
          },
          {
            head: 'The target',
            text: '{r_multiple} times the distance from fill to stop. One position at a time; signals during an open position are ignored.',
          },
        ],
      },
    },
    definitions: {
      order_block: {
        intro: 'Order blocks are taught from chart examples, and the examples disagree. This page tests one definition that can be checked bar by bar.',
        calls: [
          {
            head: 'Which candle is the block',
            text: 'The single bar immediately before the run, not “the last down candle somewhere near the low”.',
          },
          {
            head: 'How big a move counts',
            text: '{impulse_bars} same-direction closes in a row covering {min_impulse_atr} × ATR, plus a close beyond the latest confirmed swing point. A fair value gap inside the move is not required.',
          },
          {
            head: 'The zone',
            text: 'The whole candle, high to low. Body-only zones and the candle’s midpoint (“mean threshold”) are also taught; they are not used.',
          },
          {
            head: 'Mitigation',
            text: 'The first bar that touches the zone uses the block up.',
          },
          {
            head: 'Filters left out',
            text: 'No higher-timeframe bias, no session filter, no premium/discount filter.',
          },
        ],
        engine: {
          head: 'Engine approximation: no limit order',
          text: 'The usual description rests a limit order at the edge of the block. The engine has no limit orders, so the entry is a market order at the open after the bar that came back to the zone, and it pays the {fee} taker fee. The fill can be anywhere relative to the zone: above it, inside it, or below it but above the stop.',
        },
      },
      break_of_structure: {
        intro: '“Structure” is taught with a chart and a marker pen. This page pins it down as one rule set that can be checked bar by bar.',
        calls: [
          {
            head: 'How many bars make a swing',
            text: '{swing_left} before and {swing_right} after. The three-candle swing of ICT teaching (1 each side) and the five-bar fractal (2 each side) are also common. Fewer bars give more, smaller swings.',
          },
          {
            head: 'Wick or close',
            text: 'A close beyond the level is required.',
          },
          {
            head: 'BOS or CHoCH',
            text: 'The usual teaching calls a break in the direction of the trend a break of structure and the first break against it a change of character. Telling them apart needs a definition of trend. None is made here: every break of the latest swing is traded the same way.',
          },
          {
            head: 'Filters and entry left out',
            text: 'No higher-timeframe bias, no session filter, no retest entry.',
          },
          {
            head: 'The stop distance',
            text: 'Whatever the distance to the opposite swing is. It is not capped, so risk per trade in price terms varies a lot.',
          },
        ],
        engine: {
          head: 'How the engine enters: a market order at the next open',
          text: 'The engine has no limit orders, only market orders at the next bar’s open. This definition does not ask for one: the entry is a market order at the open after the breaking bar, not an order waiting for a retest. It pays the {fee} taker fee, and the fill is that open, not the close that broke the level.',
        },
      },
      breaker_block: {
        intro: 'A breaker block is an order block that price has closed straight through, expected to act the other way round from then on. The order blocks here are exactly those of the order block backtest; what counts as “failed” is fixed below.',
        calls: [
          {
            head: 'What “failed” means',
            text: 'One close beyond the far edge of the block. A wick through it does not count, and no minimum size is asked of the breaking bar.',
          },
          {
            head: 'A liquidity sweep first',
            text: 'Some descriptions only call it a breaker when the failed block came from a move that first ran a prior high or low (a liquidity sweep). That condition is not applied: every failed order block is a breaker.',
          },
          {
            head: 'The zone',
            text: 'The whole order-block candle, high to low, unchanged by the failure.',
          },
          {
            head: 'Time limits',
            text: 'One parameter, max_wait_bars ({max_wait_bars} bars), is used for both clocks: block to failure, and failure to retest.',
          },
          {
            head: 'Filters left out',
            text: 'No higher-timeframe bias, no session filter.',
          },
        ],
        engine: {
          head: 'Engine approximation: no limit order',
          text: 'As in the order block backtest, there is no resting limit order at the edge of the zone: the entry is a market order at the open after the retest bar has closed, and it pays the {fee} taker fee. The fill can be anywhere relative to the zone.',
        },
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
        'perpmath 公開過的每一份回測：總報酬率與最大回撤，樣本內與樣本外分開列，成本都算進去，並附上每一份的規則與可以重跑的程式。賠錢的結果也不會拿掉。',
      headAllLost: '測了 {n} 個策略，{n} 個都賠錢。',
      head: '測了 {n} 個策略，結果照實列出。',
      headRanged: '{s} 個訊號策略都賠錢，{g} 個網格在價格沒出界的區間裡有賺。',
      sub: '規則固定，用 Bybit 公開資料，每一筆成交都扣手續費與滑價。',
      subRanged:
        '規則固定，用 Bybit 公開資料，每一筆成交都扣成本。網格的 {is} 與 {oos} 來自價格整年都沒有收在區間外的一段行情，而且樣本內的上下界是事後才知道的。',
      primary: '自己跑一次',
      secondary: '到 GitHub 看程式碼',
      tableHead: '所有回測結果',
      signalsHead: '訊號策略',
      gridHead: '網格',
      caption: '已扣掉手續費與滑價，但沒有計入資金費率。',
      captionPlain: '已扣掉手續費與滑價。',
      captionMixed: '已扣掉手續費與滑價。只有網格計入資金費。',
      fundingNone: '沒有計入資金費率。',
      fundingGridOnly: '只有網格計入資金費。',
      gridCaption: '已計入掛單與吃單手續費、滑價與資金費。',
      gridCaptionPlain: '已計入掛單與吃單手續費和滑價，沒有計入資金費。',
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
      gridWhyHead: '網格為什麼沒有判讀',
      gridWhyBody: '網格的每一次配對不是互相獨立的賭注，所以回測工具不替它算 t 值。請把它當成記帳範例來讀。',
      summary: {
        label: '所有回測的四個數字',
        strategies: '測過的策略',
        backtests: '已公開的回測',
        backtestsNote: '{s} 個訊號策略、{g} 個網格，市場都是 {markets}',
        oosLost: '樣本外賠錢',
        oosLostNote: '樣本外總報酬率小於零的策略數，已扣手續費與滑價。',
        oosLostNoteRanged: '樣本外總報酬率小於零的回測數，已扣成本。大於零的那一個是網格，那段期間價格一直留在區間裡。',
        trades: '合計交易筆數',
        tradesNote: '樣本內 {is} 筆，樣本外 {oos} 筆',
        tradesNoteGrid: '樣本內 {is} 筆，樣本外 {oos} 筆，另有網格配對 {trips} 次',
        period: '資料期間',
        days: '天',
      },
      cardLabel: '{name}：樣本內與樣本外',
      thin: '{sample}只有 {trades} 筆交易，不到 {min} 筆。這一欄的每個數字都可能只是運氣。',
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
          '每天一個點，量的是權益比先前最高點低多少。縱軸從 0 畫到 −100%，照比例畫。回測工具的最大回撤是在每一根 K 線收盤時量的，還沒平倉的部位也照那個收盤價計入（樣本內 {is}，樣本外 {oos}），所以可能比圖上每日的最低點更深。',
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
      thin: {
        title: '{sample}只有 {trades} 筆交易，太少，不能判讀',
        body: '交易少於 {min} 筆時，回測工具會把那一段標成樣本不足。這一段的每個數字都可能只是運氣，不管它看起來偏好還是偏壞。',
        rUp: '這一段的平均 R 是 {avgR}，但同一段期間權益還是少了 {loss}。平均 R 把每一筆交易看得一樣重，不管停損放多遠；總報酬率則是用整個倉位複利算的，停損放得遠的交易對它影響比較大。只有 {trades} 筆交易，這兩個數字都不能當成結果。',
        why: '每筆交易平均持有 {held} 根 K 線，持倉期間出現的 {skipped} 個訊號都被略過。參數沒有為了多做幾筆交易而調整。',
      },
      definition: {
        head: '這裡採用的定義，以及固定下來的裁量點',
        only: '這類概念沒有統一的定義，兩位老師在同一張圖上圈出來的位置可能不一樣。這一頁的結果只代表這一種定義，不代表這個概念的每一種讀法。',
        callsLabel: '裁量點，以及這裡怎麼固定',
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
      swing_left: '波段點左側根數',
      swing_right: '波段點右側根數',
      impulse_bars: '推動走勢最少根數',
      min_impulse_atr: '推動走勢最小幅度（ATR 倍數）',
    },
    grid: {
      name: '網格機器人',
      short: '網格',
      chartName: '網格',
      directions: { neutral: '中性', long: '做多', short: '做空' },
      spacings: { geometric: '等比', arithmetic: '等差' },
      outOfRange: { continue: '繼續跑', stop: '停止掛單', close: '全部平倉' },
      costsAll: '手續費、滑價與資金費',
      costsNoFunding: '手續費與滑價',
      description:
        '{symbol} {interval} K 線上的 {count} 格{direction}網格回測：樣本內配對 {isTrips} 次、樣本外 {oosTrips} 次，已計入{costs}。附規則、限制，以及自己重跑一次的指令。',
      headRanged: '{symbol} {direction}網格有賺，但有兩個前提。',
      headLost: '{symbol} {direction}網格，回測結果是賠錢。',
      head: '{symbol} {direction}網格的回測結果。',
      sub: '{symbol} {interval} K 線，扣掉{costs}之後：樣本內 {is}，樣本外 {oos}。',
      resultHead: '扣掉{costs}之後',
      notes: {
        hindsight: '上下界取自這段期間自己的最低價與最高價。',
        fixed: '上下界在回測前就固定。',
        inRange: '每一根 K 線都收在區間內。',
        outOfRange: '有 {pct} 的 K 線收在區間外。',
      },
      premises: {
        title: '看數字之前先讀這兩件事',
        hindsight: {
          head: '樣本內的上下界是事後才知道的。',
          body: '網格的範圍是 {lower} 到 {upper}，也就是樣本內這段期間自己的最低價與最高價。第一天沒有人知道這個範圍；用了它，價格就不可能跑出網格，所以樣本內的結果天生偏樂觀。',
        },
        inRange: {
          head: '樣本外，價格整段沒有出界。',
          body: '樣本外每一根 K 線都收在區間內。同一段期間買進持有 1 倍多單的報酬是 {bh}，網格最後留著的倉位平掉時的損益是 {inv} USDT。遇到趨勢，網格會抱著愈來愈大的逆勢倉位，所以價格走出區間的行情，結果會很不一樣。',
        },
        outOfRange: {
          head: '樣本外，價格跑出了區間。',
          body: '樣本外有 {pct} 的 K 線收在網格之外。同一段期間買進持有 1 倍多單的報酬是 {bh}。',
        },
        close: '一段期間、一個市場、一組設定：這是記帳範例，不是網格會賺錢的證據。',
      },
      compare: {
        label: '網格回測結果：樣本內與樣本外對照',
        roundTrips: '配對次數',
        fills: '成交次數',
        buyHold: '買進持有',
        buyHoldFunding: '買進持有（含資金費）',
        outside: '收在區間外的 K 線',
        liquidated: '是否被強制平倉',
        yes: '有',
        no: '沒有',
        caption:
          '配對：一格由自己的網格掛單開倉再平倉。買進持有：1 倍槓桿的永續多單，從第一根開盤抱到最後一根收盤。由 perpmath {version} 於 {date} 算出。回測只是對過去的價格做計算，不是預測。',
      },
      ledger: {
        head: '權益的變化是從哪裡來的',
        label: '權益變化的來源（USDT）',
        source: 'USDT',
        roundTrips: '完成的配對（未扣手續費）',
        inventory: '用市價平掉的倉位',
        fees: '手續費',
        funding: '資金費',
        liquidation: '強制平倉損失',
        net: '權益變化',
        note: '樣本內和樣本外各以 {capital} USDT 起始。「完成的配對」是回測工具的交易損益減掉用市價平掉的倉位。每一列都四捨五入過，加起來可能和合計差一點尾數。',
        inventoryLine: '{sample}：最後一根 K 線時還有 {qty} {base} 沒平，以 {price} 平倉。',
      },
      chart: {
        drawdownCaption:
          '每天一個點，量的是權益比先前最高點低多少。縱軸從 0 畫到 −100%，照比例畫。回測工具的最大回撤是在每一根 K 線收盤時量的（樣本內 {is}，樣本外 {oos}），所以可能比圖上每日的最低點更深。',
        note: '本站的結果檔只留每日權益點，沒有留逐筆成交。每一筆成交都在 GitHub 上的完整結果裡。',
      },
      sections: {
        rules: '網格規則',
        paths: 'K 線內部的四種走法',
        variants: '同一次回測，只改一項成本',
        assumptions: '假設與限制',
      },
      rules: {
        levels: {
          head: '價位',
          geometric: '在 {lower} 到 {upper} 之間切成 {count} 格，共 {levels} 個價位。等比間距：每一格的寬度都是 {width}。',
          arithmetic: '在 {lower} 到 {upper} 之間切成 {count} 格，共 {levels} 個價位。等差間距：每一格的價差相同，換算成百分比是 {widthMin} 到 {widthMax}。',
        },
        cells: {
          head: '格子',
          text: '多單格在下緣買進、上緣賣出；空單格在上緣賣出、下緣買回。每一格同時只有一個倉位。一個倉位被自己那一格的掛單平掉，算一次配對。',
        },
        size: {
          head: '每格大小',
          text: '每一格開 {cellNotional} USDT 的名目價值：起始資金 × 槓桿 ÷ 格數。',
        },
        start: {
          head: '起始',
          neutral: '網格在每個樣本第一根 K 線的開盤價掛上去。低於這個價格的是多單格，高於的是空單格，一開始不做任何交易。',
          long: '網格在每個樣本第一根 K 線的開盤價掛上去。每一格都是多單格，高於這個價格的格子會立刻用市價買進。',
          short: '網格在每個樣本第一根 K 線的開盤價掛上去。每一格都是空單格，低於這個價格的格子會立刻用市價放空。',
        },
        fills: {
          head: '成交',
          text: '價格要確實穿過價位，掛單才算成交，而且一律以價位本身成交，就算跳空也不會拿到更好的價格。成交後再往不利的方向加上滑價。',
        },
        range: {
          head: '價格出界時',
          continue: '價格跑出區間時，所有掛單與倉位都保留不動。交易所的網格機器人沒設停損時也是這樣。',
          stop: '價格跑出區間時取消所有掛單，倉位留到樣本結束。',
          close: '價格跑出區間時取消所有掛單，並在邊界用市價把倉位全部平掉。',
        },
        liquidation: {
          head: '槓桿與強制平倉',
          text: '槓桿 {leverage} 倍，逐倉保證金：整個網格的權益就是淨倉位的保證金。權益跌到倉位價值的 {mmr} 時強制平倉。',
        },
        end: {
          head: '樣本結束',
          text: '樣本最後一根 K 線還沒平的倉位，一律用那根的收盤價市價平掉。每個樣本都從空手、同樣的資金開始。',
        },
      },
      params: {
        head: '固定參數',
        note: '都是一般的預設值，只定過一次。沒有為了挑選它們而跑過其他網格設定。',
        lower: '下界',
        upper: '上界',
        boundsHindsight: '樣本內的最低價與最高價',
        boundsFixed: '寫死在設定檔',
        grid_count: '格數',
        spacing: '間距',
        direction: '方向',
        leverage: '槓桿',
        out_of_range: '價格出界時',
        cell_notional: '每格名目價值（USDT）',
        cell_width: '每格寬度',
        widthRange: '{min} 到 {max}',
      },
      paths: {
        intro:
          '一根 {interval} K 線不會告訴你最高價和最低價哪個先出現。這對網格有差：下跌途中買到的單，可能在同一根 K 線回升時就賣掉。回測工具把每一根 K 線兩種順序都走一遍，留下收盤時權益比較低的那一種。其他幾列是用來看這個選擇會讓結果差多少。',
        bound: '這四種都不是真正的上下限。實際價格在一根 K 線裡會來回很多次，成交的掛單會比任何一種走法都多。',
        readme: 'README 的 1 分鐘 K 線對照',
        label: '同一組網格在四種 K 線內走法下的結果',
        path: 'K 線內的走法',
        used: '公開的結果',
        names: {
          worst_of_two: '每根取兩種裡比較差的',
          low_first: '先到最低價',
          high_first: '先到最高價',
          best_of_two: '每根取兩種裡比較好的',
        },
      },
      variants: {
        intro: '網格的結果很大一部分取決於兩項成本：每次成交的手續費，以及持倉要付或收的資金費。',
        label: '同一組網格改用吃單費率、以及不計資金費的結果',
        run: '版本',
        published: '公開的結果',
        publishedNote: '網格成交收 {maker}，計入資金費',
        publishedNoteNoFunding: '網格成交收 {maker}',
        taker: '網格成交改收吃單費率',
        takerNote: '{taker}，原本是 {maker}',
        noFunding: '不計資金費',
        fees: '付出的手續費（USDT）',
      },
      costs: {
        head: '成本',
        gridFee: '網格成交',
        gridFeeValue: '每次成交 {rate}，掛單費率',
        takerFee: '市價單',
        takerFeeValue: '每次成交 {rate}，吃單費率',
        slippage: '滑價',
        slippageValue: '每次成交 {rate}，一律往不利的方向算，限價成交也算',
        roundTrip: '一次配對的成本',
        roundTripValue: '該格名目價值的 {cost}。最窄的一格寬 {width}。',
        funding: '資金費',
        fundingValue: 'Bybit 實際結算的費率，資料裡共 {records} 次結算',
        fundingOff: '沒有計入',
        mmr: '維持保證金率',
        mmrValue: '{rate}，Bybit 風險限額第 1 級',
        capital: '起始資金',
        note: '手續費是 Bybit 永續合約 VIP 0 的費率，查閱日期 {date}。費率會隨帳戶等級與時間改變，實際費率請查目前的費率表。滑價是假設值，不是量出來的。',
        feeTable: 'Bybit 費率表',
      },
      timing: {
        head: '成交與時序',
        start: '網格掛上去的時間',
        startValue: '每個樣本第一根 K 線的開盤',
        order: '網格掛單成交的條件',
        orderValue: '價格確實穿過價位，以價位成交',
        path: 'K 線內的走法',
        fundingPrice: '資金費用哪個價格算',
        fundingPriceValue: '結算時那根 K 線的收盤價，不是標記價格',
        lookahead: '偷看未來檢查',
        lookaheadValue: '通過，縮短資料重跑 {runs} 次',
      },
      limits: {
        head: '限制',
        items: [
          '沒有模擬排隊順序、部分成交與延遲。「價格穿過價位就成交」是假設，不是訂單簿資料。',
          '強制平倉只用風險限額第 1 級，除了賠掉剩下的保證金之外，沒有另外計強平手續費。',
          '各交易所的網格機器人細節不同，例如起始倉位怎麼買、每格數量、移動區間。這裡照上面的規則算，不代表任何一家交易所的機器人。',
          '沒有 t 值，因為網格的每一次配對不是互相獨立的賭注。',
          '偷看未來檢查只能證明模擬器沒有讀後面的 K 線，不能證明上下界不是事後挑的。',
        ],
        rangeUntested: '這次回測價格沒有出界，所以出界時的處理規則完全沒有用到。',
      },
      run: {
        fundingRecords: '資金費資料',
        fundingRecordsValue: '{records} 筆，{from} 至 {to}',
        fundingHash: '資金費檔 SHA-256',
        readme: 'README 的網格章節',
      },
      card: {
        label: '{name}：樣本內與樣本外',
        reading: '要留意',
        hindsight: '上下界是事後才知道的',
        fixed: '上下界事先固定',
        inRange: '價格整段沒出界',
        outOfRange: '價格跑出了區間',
        open: '看規則、K 線內走法與權益曲線',
      },
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
      order_block: {
        name: '訂單塊（order block）進場',
        short: '訂單塊（order block）',
        rules: [
          {
            head: '推動走勢（impulse）',
            text: '連續 {impulse_bars} 根以上的上漲 K 線（收盤高於開盤），而且從第一根的開盤算起，漲幅至少有 {min_impulse_atr} 倍 ATR。下跌的情況完全對稱，以下都只講上漲。',
          },
          {
            head: '突破結構',
            text: '這段走勢最新一根的收盤，要高於最近一個已確認的波段高點（走勢開始前的那一根還沒有收在它上面），同時高於走勢開始前那一根的最高價。',
          },
          {
            head: '波段高點（swing high）',
            text: '一根 K 線的最高價，比前面 {swing_left} 根和後面 {swing_right} 根的最高價都高。要等後面那 {swing_right} 根都收盤才知道，在那之前不會拿來用。',
          },
          {
            head: '訂單塊',
            text: '走勢開始前緊鄰的那一根 K 線，而且它必須是下跌 K 線。區塊範圍是整根 K 線，從最低價到最高價，影線也算。ATR 取這一根當下最近 {atr_period} 根真實波幅的平均。',
          },
          {
            head: '回到區塊',
            text: '區塊最多等 {max_wait_bars} 根 K 線。第一根最低價碰到區塊上緣的 K 線決定結果：收盤跌破區塊下緣，這個區塊就作廢；沒有跌破，就做多。每個區塊只用一次。',
          },
          {
            head: '出場',
            text: '停損放在區塊下緣再往下 {stop_buffer_atr} 倍 ATR。停利目標是成交價到停損距離的 {r_multiple} 倍。同一時間只持有一個倉位。',
          },
        ],
      },
      break_of_structure: {
        name: '結構突破（break of structure）進場',
        short: '結構突破（BOS）',
        rules: [
          {
            head: '波段高低點（swing）',
            text: '波段高點是最高價比前面 {swing_left} 根和後面 {swing_right} 根的最高價都高的 K 線；波段低點反過來，看最低價。和旁邊任何一根平手就不算。',
          },
          {
            head: '確認',
            text: '波段點要等後面 {swing_right} 根都收盤才成立。在那之前，它既不是可以被突破的價位，也不能拿來放停損。新確認的波段點會取代舊的，不管比較高還是比較低。',
          },
          {
            head: '突破',
            text: '收盤價高於最近的波段高點：做多。收盤價低於最近的波段低點：做空。只有影線穿過、收盤沒有站過去，不算突破。',
          },
          {
            head: '每個價位只算一次',
            text: '每個波段價位只能被突破一次，不管那一次有沒有進場。同一側要再出訊號，得等新的波段點確認。',
          },
          {
            head: '停損',
            text: '做多時放在最近的波段低點再減 {stop_buffer_atr} 倍 ATR；做空時放在最近的波段高點再加同樣的距離。ATR 取最近 {atr_period} 根的平均。那一側還沒有已確認的波段點，或算出來的停損不在收盤價的虧損那一側，就不進場。',
          },
          {
            head: '停利目標',
            text: '成交價到停損距離的 {r_multiple} 倍。同一時間只持有一個倉位，持倉期間出現的突破一律略過。',
          },
        ],
      },
      breaker_block: {
        name: 'Breaker block 進場',
        short: 'Breaker block',
        rules: [
          {
            head: '訂單塊',
            text: '找法和訂單塊那一份回測完全相同，同一段程式、同樣的參數：一段連續 {impulse_bars} 根以上、漲幅 {min_impulse_atr} 倍 ATR、收盤突破最近波段高點（前面 {swing_left} 根、後面 {swing_right} 根）的上漲走勢，它開始前的那一根下跌 K 線。區塊範圍是整根 K 線。',
          },
          {
            head: '失效',
            text: '區塊成立後 {max_wait_bars} 根 K 線之內，有一根收盤跌破區塊下緣。從那一根收盤起，這個區塊就是看空的 breaker。看空的訂單塊被收盤向上穿過，則變成看多的 breaker，規則完全對稱。',
          },
          {
            head: '重測（retest）',
            text: 'breaker 從收盤穿過它的那一根算起，最多等 {max_wait_bars} 根 K 線。第一根最高價碰到區塊下緣的 K 線決定結果：收盤高於區塊上緣，這個 breaker 就作廢；沒有，就做空。',
          },
          {
            head: '只用一次',
            text: '每個 breaker 只用一次，不管最後有沒有進場。同一根 K 線有好幾個同時觸發時，用最晚被穿過的那一個。',
          },
          {
            head: '停損',
            text: '做空時放在區塊上緣再往上 {stop_buffer_atr} 倍 ATR；做多時（看多的 breaker）放在區塊下緣再往下同樣的距離。ATR 取收盤穿過區塊那一根當下最近 {atr_period} 根的平均。',
          },
          {
            head: '停利目標',
            text: '成交價到停損距離的 {r_multiple} 倍。同一時間只持有一個倉位，持倉期間出現的訊號一律略過。',
          },
        ],
      },
    },
    definitions: {
      order_block: {
        intro: '訂單塊在教學裡是用圖例教的，而各家的圖例彼此並不一致。這一頁測的是其中一種可以逐根 K 線檢查的定義。',
        calls: [
          {
            head: '哪一根 K 線算訂單塊',
            text: '走勢開始前緊鄰的那一根，不是「低點附近最後一根下跌 K 線」這種說法。',
          },
          {
            head: '多大的走勢才算',
            text: '連續 {impulse_bars} 根同方向收盤、合計 {min_impulse_atr} 倍 ATR，再加上收盤越過最近一個已確認的波段點。走勢裡面不需要有公平價值缺口。',
          },
          {
            head: '區塊範圍',
            text: '整根 K 線，從最高價到最低價。也有人教只取實體，或取 K 線的中點（mean threshold），這裡都不採用。',
          },
          {
            head: 'Mitigation（區塊被用掉）',
            text: '第一根碰到區塊的 K 線，就把這個區塊用掉。',
          },
          {
            head: '沒有加的過濾條件',
            text: '沒有大週期方向（higher-timeframe bias），沒有交易時段過濾，也沒有 premium/discount 過濾。',
          },
        ],
        engine: {
          head: '引擎的近似：沒有限價單',
          text: '一般的說法是在區塊邊緣掛一張限價單等成交。這個引擎沒有限價單，所以是等價格回到區塊的那一根 K 線收盤，再用下一根的開盤價市價進場，付的是 {fee} 的吃單（taker）費率。成交價可能在區塊上方、在區塊裡面，或在區塊下方但還沒到停損。',
        },
      },
      break_of_structure: {
        intro: '「結構」在教學裡是拿著圖表、用筆圈出來的。這一頁把它寫成一組可以逐根 K 線檢查的規則。',
        calls: [
          {
            head: '幾根 K 線定一個波段點',
            text: '前面 {swing_left} 根、後面 {swing_right} 根。ICT 教學常見的三根 K 線波段（左右各 1 根）和五根 K 線的 fractal（左右各 2 根）也很常用。根數愈少，波段點愈多、愈小。',
          },
          {
            head: '看影線還是看收盤',
            text: '要收盤價越過那個價位才算。',
          },
          {
            head: 'BOS 還是 CHoCH',
            text: '一般的教法把順著趨勢的突破叫 break of structure，把第一次逆著趨勢的突破叫 change of character（CHoCH）。要分辨這兩種，得先定義什麼是趨勢。這裡沒有定義：最近的波段點只要被突破，一律用同樣的方式交易。',
          },
          {
            head: '沒有加的過濾條件與進場方式',
            text: '沒有大週期方向，沒有交易時段過濾，也不等價格回頭重測才進場。',
          },
          {
            head: '停損距離',
            text: '到對側波段點有多遠就是多遠，沒有上限，所以每筆交易以價格計的風險差異很大。',
          },
        ],
        engine: {
          head: '引擎的進場方式：下一根開盤市價',
          text: '這個引擎沒有限價單，只有下一根開盤成交的市價單。這個定義本來就不需要限價單：突破的那一根 K 線收盤後，用下一根的開盤價市價進場，不是掛單等價格回頭重測。付的是 {fee} 的吃單（taker）費率，成交價是那個開盤價，不是突破時的收盤價。',
        },
      },
      breaker_block: {
        intro: 'Breaker block 指的是被價格直接收盤穿過的訂單塊，一般認為它從此會反過來作用。這裡的訂單塊和訂單塊那一份回測完全相同；怎樣才算「失效」，固定如下。',
        calls: [
          {
            head: '怎樣算「失效」',
            text: '有一根 K 線收盤越過區塊另一側的邊緣。只有影線穿過不算，對那一根 K 線的大小也沒有要求。',
          },
          {
            head: '要不要先掃過流動性',
            text: '有些教法認為，失效的訂單塊要來自一段先掃過前高或前低的走勢（流動性掃蕩），才叫 breaker。這裡沒有加這個條件：只要是失效的訂單塊，就算 breaker。',
          },
          {
            head: '區塊範圍',
            text: '整根訂單塊 K 線，從最高價到最低價，失效之後也不變。',
          },
          {
            head: '時間限制',
            text: '兩段等待共用同一個參數 max_wait_bars（{max_wait_bars} 根）：訂單塊成立到失效，以及失效到重測。',
          },
          {
            head: '沒有加的過濾條件',
            text: '沒有大週期方向，也沒有交易時段過濾。',
          },
        ],
        engine: {
          head: '引擎的近似：沒有限價單',
          text: '和訂單塊那一份回測一樣，區塊邊緣沒有掛著等成交的限價單：等重測的那一根 K 線收盤，再用下一根的開盤價市價進場，付的是 {fee} 的吃單（taker）費率。成交價可能落在區塊的任何一側。',
        },
      },
    },
  },
});
