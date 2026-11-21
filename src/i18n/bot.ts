// Strings for /bot/, the home page of the open-source engine.
//
// Only what is true of the engine today, and all of it from its README
// (perpmath-engine/README.md): it backtests strategies and grids, it places
// orders on the Bybit testnet only, it is free and MIT licensed, and its
// `broker_id` setting is empty by default. The commands, the version and the
// default limits are not written here: they live in
// src/lib/backtests/engine.ts, where a test compares them with the README.
// {version} is the latest release; counts, rates and returns come from
// src/data/backtests/.
import { defineStrings } from './strings';

export const bot = defineStrings({
  en: {
    title: 'perpmath: an open-source backtester for Bybit perpetuals',
    description:
      'An open-source Python backtester for crypto perpetuals: Bybit public candles, fees and slippage on every fill, in-sample and out-of-sample results.',
    head: 'Backtest a rule with honest costs.',
    sub: 'An open-source engine for Bybit perpetuals. Version {version} has three parts: a strategy backtester, a grid backtester and an order runner that connects to the Bybit testnet only.',
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
    parts: {
      head: 'What it is',
      body: 'perpmath downloads public candles from Bybit, runs fixed rules on them and writes one JSON file with everything needed to check the result. Every backtest on this site was made with it and can be made again with the commands below. It ships no profitable strategy and makes no return claims.',
      label: 'The three parts of version {version}',
      backtest: {
        title: 'Strategy backtester',
        body: 'One position at a time, a stop on every trade. It decides on a bar’s close, fills at the next open and charges a fee and slippage on every fill. Example strategies come with it.',
        link: 'Quickstart for strategies',
      },
      grid: {
        title: 'Grid backtester',
        body: 'Limit orders at fixed price levels, one small position a cell. Maker and taker fees, funding, leverage and liquidation are counted. Every bar is walked along two paths and the worse one is kept.',
        link: 'Quickstart for grids',
      },
      live: {
        title: 'Testnet order runner',
        body: 'Runs the same strategy code on the Bybit testnet, with play money. It refuses to start against mainnet. A dry run needs no account and no key.',
        link: 'Quickstart for the dry run',
      },
    },
    quickstart: {
      head: 'Quickstart',
      sub: 'Install once, then take any of the three tracks. None of them needs an account or an API key.',
      groups: {
        install: 'Set up once',
        backtest: 'Backtest a strategy',
        grid: 'Backtest a grid',
        live: 'Dry-run the order runner',
      },
      install: 'Install',
      installNote: 'Python 3.10 or newer. The only dependency is NumPy.',
      download: 'Download candles',
      downloadNote: 'One year of 15-minute candles from the public endpoint. No account, no API key.',
      backtest: 'Run a backtest',
      backtestNote: 'Writes one JSON file with everything needed to check the result.',
      gridDownload: 'Download candles for an exact range',
      gridDownloadNote: 'Dates instead of a number of days, so anyone who runs it gets the same bars.',
      funding: 'Download funding rates',
      fundingNote: 'Settled rates from Bybit’s public funding-history endpoint. The grid run stops with an error if this file has a gap inside the bar range.',
      grid: 'Run the grid backtest',
      gridNote: 'The result also holds the same run along three other intrabar paths, at the taker fee and without funding.',
      dryRun: 'Dry run, one bar',
      dryRunNote: 'Reads public testnet candles, runs the strategy and prints the exact order body it would send. No signed request is made. Drop --once to keep it running bar after bar.',
      gridResult: 'See the shipped grid result',
    },
    computed: {
      head: 'How a backtest is computed',
      sub: 'Four rules decide every number of a strategy backtest. Grids follow the same split and the same check, with their own fill rules.',
      timing: {
        head: 'Timing',
        body: 'A strategy decides on a bar’s close and its order fills at the next open. Stops and targets are checked against every bar’s high and low; a bar that opens beyond one fills at that open.',
        label: 'Order of events',
        formula:
          'bar closes → the strategy decides\nnext bar opens → the order fills\neach later bar → stop and target checked\nboth in one bar → the stop counts first',
      },
      costs: {
        head: 'Costs',
        body: 'Every fill pays the fee on its notional and is moved against you by the slippage, take-profit fills included. The default fee stands for Bybit’s base taker rate: check the current table and set your own. The slippage is an assumption, not a measurement.',
        label: 'One round trip in the shipped strategy results',
        formula: '2 × ({fee} fee + {slip} slippage) = {total} of notional',
      },
      split: {
        head: 'In-sample and out-of-sample',
        body: 'The data is cut at a UTC midnight and each part is simulated on its own from the same starting capital. Nothing is fitted; the split is there so that if you change a parameter by hand, you still have a period you did not look at.',
        shipped: 'The shipped results use the first {share} of the period as in-sample.',
      },
      lookahead: {
        head: 'Look-ahead check',
        body: 'Before simulating, the strategy is run again on shortened copies of the data. If any decision changes when later bars are removed, the run stops with an error. It cannot catch a strategy that gets future prices from somewhere other than the data it is given.',
      },
      metrics:
        'Each part reports its trades, win rate, average R, a t-statistic, total return and max drawdown. Under {min} trades the block is flagged as too small a sample. A value that cannot be computed is written as null, never as 0.',
      rule: 'How the verdict is decided',
    },
    live: {
      head: 'The testnet order runner',
      sub: 'perpmath live runs a strategy on the Bybit testnet with the same code and timing as the backtest. It is a learning tool: the example strategies lose money in backtests, and running them on the testnet will not change that.',
      tested: {
        title: 'What has been tested, and what has not',
        body: 'The signed endpoints (the key check, orders, positions) were tested against a fake server built from Bybit’s documentation, not against a real testnet account. The dry run and an optional smoke test use only the testnet’s public endpoints: no key, no order.',
      },
      safetyHead: 'Safety design',
      safety: [
        {
          head: 'Testnet only',
          body: 'The endpoint is the testnet, fixed in the code. A config, a URL setting or a --mainnet flag that asks for anything else is refused, and the first order waits until you type TESTNET.',
        },
        {
          head: 'Key permission check',
          body: 'The key is checked before anything else. One that can withdraw or transfer, is read-only, or lacks contract-order permission is refused. It is never printed.',
        },
        {
          head: 'Deterministic order IDs',
          body: 'Each order ID is built from the strategy, its settings, the bar time, the side and the action, and is looked up before sending. A restart or a timeout cannot send the same order twice.',
        },
        {
          head: 'Reconciliation',
          body: 'At start, positions and open orders on Bybit are compared with the runner’s state file. If they disagree in any way, it stops and says what it found. It does not guess.',
        },
        {
          head: 'The stop lives on Bybit',
          body: 'The stop-loss, and the target if there is one, are attached to the entry order on Bybit’s side, so they keep working while perpmath is not running.',
        },
        {
          head: 'Dry run',
          body: 'With --dry-run no signed request is sent and no key is needed. It keeps a paper position in its own state file.',
        },
      ],
      breakers: {
        head: 'Circuit breakers and their defaults',
        body: 'When one trips, the runner stops, writes the reason into its state file and exits with code {code}. It stays stopped until it is run with --clear-halt, which checks the condition again. The position is not closed: the stop-loss on Bybit stays in place.',
        tableLabel: 'Default limits of the testnet order runner',
        setting: 'Setting, and when it trips',
        default: 'Default',
        units: { usdt: '{n} USDT', count: '{n}', ms: '{n} ms' },
        when: {
          max_daily_loss_usdt: 'USDT equity has fallen this much since the runner’s first reading of the UTC day.',
          max_position_notional_usdt: 'An order (quantity × last close), or the position value on Bybit, is larger.',
          max_consecutive_api_errors: 'This many API errors come in a row, with no fully clean bar in between.',
          max_clock_skew_ms: 'Your clock and Bybit’s differ by more.',
        },
        also: 'A bar with missing candles in its history is not traded, and a decision more than {delay} seconds old is not acted on. Each entry is a fixed {notional} USDT of notional by default.',
      },
      moreHead: 'More about the runner',
      more: [
        {
          q: 'How is the API key checked and kept?',
          a: 'It is checked through Bybit’s query-api endpoint before the first order. perpmath reads it from two environment variables and nothing else, and never prints it: at most its length and its first and last four characters.',
        },
        {
          q: 'What makes it stop at start?',
          a: 'A position it did not open, a position it expected that Bybit no longer has, a different size, an unknown open order, a position without a stop-loss, or hedge mode. It trades one position at a time in one-way mode.',
        },
        {
          q: 'What does a real testnet run need?',
          a: 'A testnet account at testnet.bybit.com, which is separate from bybit.com, with test funds from its assets page, and an API key with contract orders and positions only. Do not tick withdrawal or transfer: perpmath refuses to start with such a key. Use one-way position mode, and put the key in the environment, never in a file in the repository.',
        },
        {
          q: 'How are partial fills and rejections handled?',
          a: 'The filled part is kept and protected by the stop; the rest is not chased. A partly filled exit is followed by another reduce-only order. Rejections are logged and counted as errors, and rate limits are waited out using Bybit’s reset time.',
        },
        {
          q: 'Where does it differ from the backtest?',
          a: 'Sizing is a fixed notional, not a fraction of equity. The target is computed from the signal bar’s close, because the order is sent before its fill price is known. The backtest’s maximum holding time is not applied, and order status is polled over REST, not streamed.',
        },
        {
          q: 'What do testnet results say about mainnet?',
          a: 'Little. Testnet prices and liquidity are not mainnet’s, so fills and results there do not carry over.',
        },
      ],
      readme: 'Runner docs in the README',
    },
    does: {
      head: 'What it does',
      body: 'Downloads public Bybit candles, runs a rule or a grid with fixed parameters, and reports in-sample and out-of-sample results after fees and slippage, and for grids after funding too. On the testnet it can place the orders of a strategy.',
    },
    doesNot: {
      head: 'What it does not do',
      body: 'It cannot trade with real money: version {version} refuses to connect to Bybit mainnet. It does not search for parameters and it makes no return claims. The strategy backtester leaves out funding, leverage, liquidation, maker fees, partial fills and order-book depth.',
    },
    funded: {
      head: 'How it is funded',
      body: 'Free and MIT licensed. The order runner has a broker_id setting for Bybit’s API Broker programme, which would let the project receive a share of the trading fees of orders sent with it. It is empty by default, and while it is empty no broker header is sent. It stays empty until Bybit has approved the project, and you can always clear it yourself.',
      link: 'Broker ID in the README',
    },
    results: {
      headAllLost: 'All {n} shipped strategies lose money.',
      head: '{n} shipped results, published as they came.',
      headRanged: 'The {s} example strategies listed here lose money. The grid gained in a range price never left.',
      body: 'They show how the accounting works. They are not for trading.',
      link: 'See the backtests',
      tableLabel: 'Total return of each shipped result, after costs',
      fundingOut: 'Funding not counted',
      fundingIn: 'Funding counted',
    },
    guides: {
      head: 'Guides that use this engine',
      sub: 'Lessons that go through the commands above step by step, with their own output.',
    },
  },
  'zh-hant': {
    title: 'perpmath：開源的 Bybit 永續合約回測工具',
    description:
      '一個小型的開源 Python 回測工具，給加密貨幣永續合約用：抓 Bybit 公開 K 線，每筆成交都扣手續費與滑價，樣本內、樣本外分開報告，也能回測網格。採 MIT 授權。',
    head: '回測一條規則，成本照實算。',
    sub: '給 Bybit 永續合約用的開源引擎。{version} 版有三個部分：策略回測、網格回測，以及只連 Bybit 測試網的下單程式。',
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
    parts: {
      head: '它是什麼',
      body: 'perpmath 會下載 Bybit 的公開 K 線，用固定的規則跑一遍，再把檢查結果需要的所有資料寫成一個 JSON 檔。本站每一份回測都是用它算的，照下面的指令就能自己重算一次。它沒有附任何會賺錢的策略，也不對報酬做任何宣稱。',
      label: '{version} 版的三個部分',
      backtest: {
        title: '策略回測',
        body: '同一時間只持有一個倉位，每筆交易都有停損。K 線收盤時做決定，下一根開盤成交，每次成交都扣手續費與滑價。隨附幾個範例策略。',
        link: '策略回測怎麼開始',
      },
      grid: {
        title: '網格回測',
        body: '在固定價位掛限價單，每一格一個小倉位。掛單與吃單手續費、資金費、槓桿與強制平倉都算進去。每根 K 線走兩種順序，留下比較差的那一種。',
        link: '網格回測怎麼開始',
      },
      live: {
        title: '測試網下單程式',
        body: '用同一份策略程式碼在 Bybit 測試網下單，用的是練習資金。它會拒絕連正式網。乾跑模式不需要帳戶，也不需要金鑰。',
        link: '乾跑怎麼開始',
      },
    },
    quickstart: {
      head: '快速上手',
      sub: '先安裝一次，再從三條路線裡挑一條。三條都不需要帳戶，也不需要 API 金鑰。',
      groups: {
        install: '先安裝一次',
        backtest: '回測一個策略',
        grid: '回測一組網格',
        live: '乾跑下單程式',
      },
      install: '安裝',
      installNote: '需要 Python 3.10 以上，唯一的相依套件是 NumPy。',
      download: '下載 K 線',
      downloadNote: '從公開端點下載一年的 15 分鐘 K 線，不需要帳戶，也不需要 API 金鑰。',
      backtest: '跑一次回測',
      backtestNote: '結果會寫成一個 JSON 檔，檢查結果需要的資料都在裡面。',
      gridDownload: '下載指定區間的 K 線',
      gridDownloadNote: '用起訖時間，不用天數，這樣不管誰來跑，拿到的都是同一批 K 線。',
      funding: '下載資金費率',
      fundingNote: '從 Bybit 公開的資金費率歷史端點下載實際結算的費率。這個檔案在 K 線區間內有缺漏的話，網格回測會直接報錯停下來。',
      grid: '跑網格回測',
      gridNote: '結果檔裡還會附上同一次回測改用另外三種 K 線內走法、改收吃單費率、以及不計資金費的數字。',
      dryRun: '乾跑一根 K 線',
      dryRunNote: '讀測試網的公開 K 線，跑一次策略，把原本要送出的下單內容原樣印出來，不會送出任何簽章請求。拿掉 --once 就會一根接一根跑下去。',
      gridResult: '看隨附的網格回測結果',
    },
    computed: {
      head: '回測是怎麼算的',
      sub: '策略回測的每一個數字都由四條規則決定。網格用同樣的樣本切法與同樣的檢查，成交規則則是它自己的。',
      timing: {
        head: '時序',
        body: '策略在 K 線收盤時做決定，訂單在下一根的開盤價成交。之後每一根都用最高價和最低價檢查停損與停利；開盤就已經越過的話，就用開盤價成交。',
        label: '事件的順序',
        formula:
          'K 線收盤 → 策略做決定\n下一根開盤 → 訂單成交\n之後的每一根 → 檢查停損與停利\n同一根兩個都碰到 → 當作先碰到停損',
      },
      costs: {
        head: '成本',
        body: '每次成交都依名目價值收手續費，並往不利的方向加上滑價，停利出場也一樣。預設手續費代表 Bybit 的基本吃單費率，請自己查目前的費率表再設定。滑價是假設值，不是量出來的。',
        label: '隨附策略結果裡，一筆交易進場加出場的成本',
        formula: '2 ×（手續費 {fee} + 滑價 {slip}）= 名目價值的 {total}',
      },
      split: {
        head: '樣本內與樣本外',
        body: '資料在某個 UTC 午夜切開，兩段各自從同樣的起始資金獨立模擬。這個工具不做參數擬合；切開是為了讓你手動改參數時，還留著一段沒看過的資料。',
        shipped: '隨附的結果用整段期間的前 {share} 當樣本內。',
      },
      lookahead: {
        head: '偷看未來檢查',
        body: '模擬之前，策略會先在截短的資料上重跑幾次。拿掉後面的 K 線之後，只要前面任何一個決定有變，回測就會報錯停下來。策略如果從資料以外的地方取得未來價格，這個檢查抓不到。',
      },
      metrics:
        '兩段各自報告交易筆數、勝率、平均 R、t 值、總報酬率與最大回撤。交易少於 {min} 筆時，那一段會被標成樣本太小。算不出來的值一律寫成 null，不會寫成 0。',
      rule: '判讀是怎麼決定的',
    },
    live: {
      head: '測試網下單程式',
      sub: 'perpmath live 用和回測同一份程式碼、同樣的時序，在 Bybit 測試網上跑一個策略。它是用來學習的工具：範例策略在回測裡是賠錢的，搬到測試網上跑也不會改變這件事。',
      tested: {
        title: '哪些測過，哪些沒有',
        body: '需要簽章的端點（金鑰檢查、下單、查倉位）只用依 Bybit 文件做的模擬伺服器測過，沒有用真正的測試網帳戶測過。乾跑和一個可選的冒煙測試只會用到測試網的公開端點：不需要金鑰，也不會下單。',
      },
      safetyHead: '安全設計',
      safety: [
        {
          head: '只連測試網',
          body: '連線端點就是測試網，寫死在程式裡。設定檔、網址設定或 --mainnet 參數要求連別的地方，都會被拒絕。第一次下單前要先輸入 TESTNET 確認。',
        },
        {
          head: '金鑰權限檢查',
          body: '一開始就先檢查金鑰。能提領或轉帳、唯讀、或是沒有合約下單權限的金鑰都會被拒絕。金鑰不會被印出來。',
        },
        {
          head: '確定性的訂單編號',
          body: '訂單編號由策略、設定、K 線時間、方向與動作組成，送出前會先查這個編號。重新啟動或請求逾時，都不會把同一張單送兩次。',
        },
        {
          head: '對帳',
          body: '啟動時會拿 Bybit 上的倉位與掛單，和自己的狀態檔比對。只要有任何一項對不上，它就停下來並說明看到了什麼，不會自己猜。',
        },
        {
          head: '停損單放在 Bybit 那一邊',
          body: '停損（以及策略有設的停利）直接附在進場單上，由 Bybit 那邊執行，所以 perpmath 沒在跑的時候它們照樣有效。',
        },
        {
          head: '乾跑',
          body: '加上 --dry-run 就不會送出任何簽章請求，也不需要金鑰。它會在自己的狀態檔裡記一個紙上倉位。',
        },
      ],
      breakers: {
        head: '熔斷機制與預設值',
        body: '任何一項觸發時，下單程式就會停下來，把原因寫進狀態檔，並以結束碼 {code} 離開。之後會一直維持停止，直到你加上 --clear-halt 再跑一次，它會重新檢查那個條件。倉位不會被平掉：Bybit 上的停損單還在。',
        tableLabel: '測試網下單程式的預設上限',
        setting: '設定，以及什麼時候觸發',
        default: '預設值',
        units: { usdt: '{n} USDT', count: '{n} 次', ms: '{n} 毫秒' },
        when: {
          max_daily_loss_usdt: '從下單程式當天（UTC）第一次讀到的權益算起，USDT 權益減少了這麼多。',
          max_position_notional_usdt: '一張訂單（數量 × 最新收盤價）或 Bybit 上的倉位價值超過這個數字。',
          max_consecutive_api_errors: 'API 連續出錯這麼多次，中間沒有任何一根 K 線是完全正常的。',
          max_clock_skew_ms: '你的時鐘和 Bybit 的時鐘差距超過這個數字。',
        },
        also: '歷史 K 線有缺漏時，那一根不會交易；K 線收盤超過 {delay} 秒之後的決定也不會執行。每次進場的名目價值預設固定為 {notional} USDT。',
      },
      moreHead: '下單程式的其他細節',
      more: [
        {
          q: '金鑰怎麼檢查、怎麼保存？',
          a: '第一次下單前，會先用 Bybit 的 query-api 端點檢查金鑰。perpmath 只從兩個環境變數讀金鑰，而且不會把它印出來，頂多顯示長度和頭尾各四個字元。',
        },
        {
          q: '啟動時哪些情況會讓它停下來？',
          a: '有不是它開的倉位、它以為還在但 Bybit 上已經沒有的倉位、數量不一樣、不認得的掛單、倉位沒有停損單，或是帳戶用的是雙向持倉模式。它同一時間只持有一個倉位，使用單向持倉模式。',
        },
        {
          q: '真的要在測試網上跑，需要準備什麼？',
          a: '一個 testnet.bybit.com 的測試網帳戶（和 bybit.com 是分開的），到資產頁領測試資金，再建立一把只有合約「訂單」與「倉位」權限的 API 金鑰。不要勾提領或轉帳，perpmath 看到這種金鑰會拒絕啟動。倉位模式用單向持倉。金鑰放在環境變數裡，不要寫進 repo 裡的任何檔案。',
        },
        {
          q: '部分成交和被拒絕的訂單怎麼處理？',
          a: '已成交的部分會保留，並由停損單保護；沒成交的部分不會追單。出場單只成交一部分時，會再送一張只減倉的訂單。被拒絕的訂單會記錄下來並算成一次錯誤；遇到限速就等到 Bybit 回報的重設時間。',
        },
        {
          q: '它和回測有哪些地方不一樣？',
          a: '倉位大小是固定的名目價值，不是權益的某個比例。停利價是用訊號那根 K 線的收盤價算的，因為送單時還不知道成交價。回測裡的最長持有時間在這裡沒有作用。訂單狀態是用 REST 輪詢，不是用串流。',
        },
        {
          q: '測試網的結果能說明正式網會怎樣嗎？',
          a: '幾乎不能。測試網的價格與流動性和正式網不同，那裡的成交與結果搬不過來。',
        },
      ],
      readme: 'README 的下單程式說明',
    },
    does: {
      head: '它做什麼',
      body: '下載 Bybit 的公開 K 線，用固定參數跑一條規則或一組網格，把樣本內和樣本外的結果分開報告。每筆成交都扣手續費與滑價，網格另外計入資金費。在測試網上，它可以替一個策略下單。',
    },
    doesNot: {
      head: '它不做什麼',
      body: '它不能用真錢交易：{version} 版會拒絕連 Bybit 正式網。它不會幫你找參數，也不對報酬做任何宣稱。策略回測沒有算資金費、槓桿、強制平倉、掛單手續費、部分成交與訂單簿深度。',
    },
    funded: {
      head: '它怎麼維持',
      body: '這個工具免費，採 MIT 授權。下單程式有一個 broker_id 設定，對應 Bybit 的 API Broker 計畫：帶著它送出的訂單，專案可以分到一部分交易手續費。這個設定預設是空的，空的時候不會送出任何經紀商標頭。在 Bybit 核准這個專案之前它會一直是空的，你也隨時可以自己把它清掉。',
      link: 'README 裡的 Broker ID 說明',
    },
    results: {
      headAllLost: '隨附的 {n} 個策略全部賠錢。',
      head: '隨附 {n} 份回測結果，照實公開。',
      headRanged: '這裡列出的 {s} 個範例策略都賠錢，網格在價格沒出界的區間裡有賺。',
      body: '放這些策略是為了示範帳怎麼算，不是要讓人拿去交易。',
      link: '看回測結果',
      tableLabel: '隨附回測的總報酬率，已扣成本',
      fundingOut: '沒有計入資金費',
      fundingIn: '已計入資金費',
    },
    guides: {
      head: '用這個引擎寫的教學',
      sub: '把上面的指令一步一步跑過，並附上實際輸出的文章。',
    },
  },
});
