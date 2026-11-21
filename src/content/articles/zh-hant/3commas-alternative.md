---
title: "3Commas 替代方案：免費、開源的交易機器人，以及 API 金鑰放在誰那裡"
slug: "3commas-alternative"
description: "3Commas 月費 $20 到 $140。想找 3Commas 替代方案，這裡照各家官方文件比較五個開源交易機器人：授權、Bybit 支援、回測，以及 API 金鑰放在哪裡。"
date: "2026-12-04"
lastmod: "2026-12-04"
lang: "zh-Hant"
category: "交易機器人"
tags: ["3Commas", "開源交易機器人", "免費交易機器人", "API 金鑰", "Bybit"]
keywords: ["3Commas 替代", "免費交易機器人", "開源交易機器人", "3Commas 免費", "自架交易機器人"]
tldr: "2026-11-22 這天，3Commas 的定價頁列出三個方案，月費 $20、$50、$140，沒有免費方案；要做合約，得從 $50 那個方案起跳。Freqtrade、Hummingbot、Jesse、OctoBot 都是開源的，可以裝在自己的電腦上跑，各有各的但書，其中 Jesse 要真錢交易得買 $899 起的授權。我們自己的機器人 perpmath 從安裝到跑完第一次乾跑花了 24 秒，但它只連 Bybit 測試網，不能下真單。價目表會改，不會改的差別是 API 金鑰存在哪裡。"
---

我在 2026-11-22 打開 3Commas 的定價頁，最上面的大標題寫著「Automation that pays for itself」，意思是這套自動化會自己回本。標題底下排著三個方案，最便宜的一個月 $20，沒有免費的。如果你就是看到這個才來找 3Commas 替代方案，免費的選項確實存在，只是每一個都會把一件 3Commas 替客戶做掉的工作，交回你手上。

<!-- unique:field-note -->
先交代這一頁是什麼。2026-11-22 這天，我讀了 3Commas 的定價頁和安全說明頁，還有四個開源機器人的文件，把它們各自怎麼形容自己記下來。這五個我們都沒有拿來交易過，所以這裡沒有使用心得、沒有評分，也沒有名次。這一頁有兩件事是我們自己動手做的：把自己的機器人 perpmath 裝進一個空資料夾並計時，以及把六組編出來的 API 金鑰描述，丟給它交易前會跑的那道檢查。perpmath 會出現在表裡只有一個原因：它是我們的。它不能下真單，表裡照寫。

## 3Commas 收多少錢（2026-11-22 查閱）

三個付費方案，可以月繳或年繳。下面的數字來自 [3Commas 定價頁](https://3commas.io/pricing)（2026-11-22 查閱），月繳和年繳兩個切換鈕各選一次讀到的。價格前面掛的是 $ 符號，頁面沒有寫是哪一種貨幣。

| 方案 | 月繳 | 年繳，換算每月 | 市場 | DCA 機器人 | 網格機器人 | 訊號機器人 |
| --- | --- | --- | --- | --- | --- | --- |
| Starter | $20 | $15 | 現貨，1 間交易所 | 5 | 2 | 2 |
| Pro | $50 | $38 | 現貨與合約 | 20 | 10 | 20 |
| Expert | $140 | $105 | 現貨與合約 | 1,000 | 1,000 | 1,000 |

機器人的數量指的是同時啟用的數量。每個方案都含一個模擬帳戶（demo account）、webhook execution，以及九間交易所的連線；是哪九間，定價頁沒有列。功能表在 DCA 機器人和網格機器人底下都列了回測，訊號機器人底下列了 TradingView 自動化，Expert 那張卡片上有可讀可寫的開發者 API。表裡的 DCA 機器人是價格跌一段就加碼一次的那種，不是定期定額。

<!-- unique:original-calc -->
有兩筆帳，頁面留給你自己算。年繳的話，三個方案一年是 $180、$456、$1,260；照月繳的價格付滿一年，是 $240、$600、$1,680。另外，Starter 只有現貨，所以要在 3Commas 上跑永續合約的機器人，最便宜的路是 Pro：只付一個月是 $50，一次繳一年是 $456。

定價頁沒有列免費方案。每個方案都有一顆試用按鈕，頁面的常見問題提到有試用期，卻沒寫多長。我在定價頁上找不到試用期的長度。

## 免費的開源交易機器人，各自提供什麼？

四個知名的專案把程式碼用開放授權公開，讓你在自己的機器上跑。下表照各專案自己的 repo 和文件整理，2026-11-22 查閱；授權那一欄，是當天 GitHub API 對每個 repo 回的 license 欄位。內文裡寫「查不到」，意思是我讀的那幾頁沒有寫，不代表沒有這個功能。

| 專案 | 授權 | Bybit 永續合約 | 回測 | 練習模式 | 介面 | 真單 |
| --- | --- | --- | --- | --- | --- | --- |
| Freqtrade | GPL-3.0 | 有列，逐倉 | 有 | 乾跑（dry-run） | 網頁介面、Telegram | 可以 |
| Hummingbot | Apache-2.0 | 有列連接器 | 限 controllers | paper trade、測試網 | 終端機 | 可以 |
| Jesse | MIT | 有列 | 有 | 模擬交易，要授權 | dashboard | 要授權 |
| OctoBot | GPL-3.0 | 有列，見下方說明 | 有 | 模擬交易 | 網頁、手機 | 可以 |
| perpmath（我們的） | MIT | 只有測試網 | 有 | 乾跑、測試網 | 命令列 | 不行 |

**Freqtrade。** 它的[文件](https://www.freqtrade.io/en/stable/)列了七間可以做合約的交易所，Bybit 在內，並介紹回測、乾跑模式、參數最佳化、網頁介面，以及用 Telegram 操控。策略用 Python 搭 pandas 寫。[交易所注意事項](https://www.freqtrade.io/en/stable/exchanges/)寫著：Bybit 合約走逐倉保證金；機器人啟動時會把持倉模式設成單向；Bybit 的 demo trading 模式不能和乾跑一起用。在我讀的那幾頁上，沒看到付費方案。

**Hummingbot。** [repo](https://github.com/hummingbot/hummingbot) 的自我介紹是一套以造市為主的 Python 框架，操作介面在終端機裡。它的 [Bybit 頁面](https://hummingbot.org/exchanges/bybit/)列了現貨和永續兩個連接器，寫明永續那個支援測試網，現貨連接器另有一個 paper trade（模擬交易）版本。回測只在一種策略底下提到，叫「controllers」；首頁完全沒提回測。

**Jesse。** 框架本身是 MIT 授權，[支援的交易所清單](https://docs.jesse.trade/docs/supported-exchanges)裡有 Bybit USDT 永續合約，回測和真錢交易兩邊都列了。回測免費。真錢交易是另一個預先編好的外掛，[文件](https://docs.jesse.trade/docs/livetrade)說只開給持有授權的人，[定價頁](https://jesse.trade/pricing)上的終身授權是 $899、$999 和 $1,599。同一頁的免費方案，live trading 那一列寫著只限測試網交易所，paper trading 那一列寫「No」。

**OctoBot。** [README](https://github.com/Drakkar-Software/OctoBot) 介紹的是一個有圖形介面的機器人，內建網格、DCA、TradingView 幾種現成模式，還有回測引擎和模擬交易。它列了 Bybit 現貨與合約，後面跟著一句註記，說 Bybit API「will soon be available again」，也就是很快會恢復。Bybit 現在在 OctoBot 上到底能不能用：查不到。README 指向它雲端站上的代管版本；價格不在 README 裡，而那個站拒絕了我們的自動化請求。

<!-- unique:cross-reference -->
把 Jesse 那一列和我們那一列擺在一起看。Jesse 的免費方案停在測試網交易所，理由是商業上的：真錢交易就是它賣的產品。perpmath 也停在測試網，理由不一樣：還沒有人拿它的下單程式碼對真的帳戶跑過，而且倉位防護（position guard）做出來以前，它拒絕連正式網。從外面看，兩個限制長得一樣。如果你說的「免費」得包含下真單，照各家自己的說法，表裡剩下 Freqtrade、Hummingbot 和 OctoBot。

<!-- unique:cross-reference -->
免費軟體還是得有人付錢，README 裡就看得到錢從哪來。Hummingbot 的 README 列了帶手續費折扣的交易所註冊連結，它的[交易所頁面](https://hummingbot.org/exchanges/)對交易所開出 $50,000 起跳的合作方案。OctoBot 的 Bybit 連結是邀請連結。我們也是同一類：perpmath 有一個對應 Bybit 經紀商計畫的 `broker_id` 設定，預設是空的；本站則從 Bybit 的連結賺錢，寫在[揭露頁](/zh-hant/disclosure/)。這些都不會讓一個機器人變差。你跑的程式碼是靠誰付的手續費養的，知道一下比較好。

## API 金鑰放在誰那裡：他們的伺服器，還是你的電腦？

用雲端機器人，金鑰和搭配它的 secret 存在那家公司手上；用自架的機器人，它們留在你管得到的機器上。價目表過一陣子就會換，這個差別不會，它是整份比較裡最耐放的一塊。

Bybit 自己的 [API 金鑰建立教學](https://www.bybit.com/en/learn/bybit-guide/how-to-create-a-bybit-api-key)（2023-06-14 發布，2026-11-22 查閱）示範的剛好就是 3Commas。你建立一把金鑰，選第三方應用程式那個選項，從清單裡挑 3Commas，設定下單、倉位資訊這類權限，再把金鑰和 secret 貼進 3Commas。Bybit 的 API 會替這種金鑰做記號：[金鑰資訊端點](https://bybit-exchange.github.io/docs/v5/user/apikey-info)（2026-11-22 查閱）對綁了第三方應用程式的金鑰回 `type` 2，個人金鑰回 1。

3Commas 在它的[安全說明頁](https://3commas.io/security)（2026-11-22 查閱）說，金鑰放在一套它叫 Sign Center 的保管系統裡，每一筆交易請求都在它的伺服器上簽章；它的系統沒有轉帳和提領的能力；你也可以把金鑰限制成只接受 3Commas 官方的 IP 位址。這些我沒有辦法稽核，也沒有理由懷疑。我要講的事比較窄：secret 離開了你的手，從那一刻起，你靠的是那家公司的保管。

同一個 Bybit 端點也列出一把金鑰能做什麼。`ContractTrade` 底下有 `Order` 和 `Position`，`Wallet` 底下有 `AccountTransfer` 和 `Withdraw`，另外還有別的。只有前面那一組權限的金鑰，沒辦法把錢搬出交易所。帳戶允許的單它還是每一張都能下，拿到它的人可以用交易把你的餘額賠光。放在公司的伺服器上是這樣，放在你的筆電上也是這樣。

| | 雲端機器人 | 自架機器人 |
| --- | --- | --- |
| secret 存在哪裡 | 服務商的伺服器 | 你的電腦或伺服器 |
| 誰負責保管 | 服務商 | 你 |
| IP 綁定 | 綁服務商的位址 | 綁你自己的位址 |
| 服務收掉的話 | 到交易所把金鑰刪掉 | 沒有影響 |
| 你的電腦關機時機器人還在跑嗎 | 會 | 放在伺服器上才會 |

Bybit 還替隨手建的金鑰設了期限。它的 [API 常見問題](https://bybit-exchange.github.io/docs/faq)（2026-11-22 查閱）說，建立時沒有綁 IP 位址的金鑰，90 天後過期。Freqtrade 的 Bybit 注意事項要的是可讀寫、含合約訂單與倉位的權限，並建議每一把金鑰都只限你自己的 IP。

## 自架的話，金鑰誰來把關？我們的機器人怎麼做

<!-- unique:firsthand-data -->
自架等於把保管的責任搬到你身上，我們就去看自己的機器人怎麼處理這件事。perpmath 下單之前會先問 Bybit 這把金鑰能做什麼，有些金鑰它直接拒絕。我們照 Bybit 文件寫的格式，手寫了六組金鑰描述交給那個函式，過程中沒有用到任何真的金鑰：

<!-- unique:firsthand-data -->
```text
trade only, bound to an IP             ACCEPTED
trade only, no IP bound                ACCEPTED  warning: key is not bound to an IP address; Bybit recommends binding one
trade plus withdrawal                  REFUSED   this API key can withdraw or transfer funds (Wallet:AccountTransfer, Wallet:Withdraw). Refusing to start: create a testnet key with trade permission only, no withdrawal or transfer.
trade plus transfer between accounts   REFUSED   this API key can withdraw or transfer funds (Wallet:AccountTransfer). Refusing to start: create a testnet key with trade permission only, no withdrawal or transfer.
read-only                              REFUSED   this API key is read-only and cannot place orders; create a testnet key with Contract trade (Order + Position) permission
spot trading only                      REFUSED   this API key has no ContractTrade 'Order' permission, so it cannot trade USDT perpetuals; enable Contract -> Orders and Positions on the testnet key
```

<!-- unique:field-note -->
六組裡拒絕了四組，時間是 2026-11-21（UTC），版本 0.2.2。這個結果請照它本來的樣子讀：它是[一個函式](https://github.com/sentinelbotsaas-hub/perpmath/blob/v0.2.2/src/perpmath/live/executor.py#L276-L311)拿到我們打進去的輸入之後，吐出來的輸出。Bybit 對一把真金鑰會回什麼，它從來沒見過。它依賴的簽章與權限規則，在[用 Python 串 Bybit API](/zh-hant/learn/bybit-api-python/) 那篇一步一步走過。

## 從空資料夾到乾跑：24 秒

安裝 perpmath 花了 22 秒，第一次乾跑在那之後 2 秒結束。我們在一台已經裝好 Python 3.12.10 的 Windows 桌機上，找一個空資料夾照 README 的步驟跑，把終端機紀錄留了下來。`$` 開頭的行是指令；這裡的輸出有刪節，完整的在本站 repo 的 `research/3commas-alternative/`。

<!-- unique:firsthand-data -->
```text
start 2026-11-21T19:46:14Z
$ git clone https://github.com/sentinelbotsaas-hub/perpmath.git
$ python -m venv .venv
$ pip install -e .
$ pip list
numpy==2.5.5
perpmath==0.2.2
installed 2026-11-21T19:46:36Z
$ perpmath live ma_cross --symbol BTCUSDT --interval 15m --config configs/live/ma_cross.json --dry-run --once
2026-11-21T19:46:38Z perpmath live ma_cross BTCUSDT 15m | DRY RUN (no signed requests, no orders) | state .perpmath-live\ma_cross-BTCUSDT-15m-a690e4-dryrun.json
2026-11-21T19:46:38Z limits: order 100 USDT, max position 200 USDT, max daily loss 20 USDT, max 5 consecutive API errors, max clock skew 5000 ms
2026-11-21T19:46:38Z clock offset to Bybit: 1014 ms (request timestamps and bar timing use Bybit's clock)
2026-11-21T19:46:38Z bar 2026-11-21T19:30:00Z close 59188.9: no entry
end 2026-11-21T19:46:39Z
```

<!-- unique:firsthand-data -->
相依套件只有一個，NumPy。不用帳戶，不用金鑰，不用資料庫。那次乾跑讀了測試網的公開 K 線，在 19:45 UTC 收盤的那一根上跑均線策略，決定什麼都不做。接著我們試著叫它做不該做的事：

<!-- unique:firsthand-data -->
```text
$ perpmath live ma_cross ... --config configs/live/ma_cross.json   (no --dry-run, no key in the environment)
error: set BYBIT_TESTNET_API_KEY and BYBIT_TESTNET_API_SECRET (testnet keys, trade permission only), or use --dry-run, which needs no key
exit=1
$ perpmath live ma_cross ... --dry-run --once --mainnet
error: perpmath 0.2 only connects to the Bybit testnet. Live (mainnet) trading is planned for 0.3 and will not be enabled before the position guard exists.
exit=1
```

設定檔裡寫 `"network": "mainnet"`，拿到的是同一個答案。下面這一列，我們沒辦法替它粉飾。perpmath 只連 Bybit 測試網，別的地方都不連。它沒有圖形介面。它隨附六個範例策略，在[公開的回測](/zh-hant/backtests/)裡全部賠錢，其他策略要你自己用 Python 寫。它的下單程式碼只對一個照 Bybit 文件做的假交易所測過，沒有用真的測試網金鑰下過任何一張單，真實帳戶更不用說。表裡其他幾列沒有、而它有的，是本站一步步算給你看的數字：[機器人專區](/zh-hant/bot/)和[用 Python 寫交易機器人](/zh-hant/learn/build-a-trading-bot-python/)把同一份程式碼一行一行走過。

## 哪一個適合你？四個問題，不排名

從你下個月需要機器人做什麼開始想，不要從價格開始想。

**現在就要下真單嗎？** 那 perpmath 出局，沒買授權的 Jesse 也是。Freqtrade、Hummingbot、OctoBot 各自都說能真錢交易，3Commas 則是每月收費替你做。要用在 Bybit 的話，先去看 OctoBot 那句註記。

**你願意寫 Python 嗎？** Freqtrade、Jesse、Hummingbot 和 perpmath 都預期你會寫。3Commas 和 OctoBot 的內建模式是用設定的，不用寫程式。網格或 DCA 的現成組合，在那邊是填一張表單。在我們這裡，是一份你得自己讀的模擬：[網格機器人](/zh-hant/learn/grid-trading-bot/)我們用引擎回測過，[DCA 機器人](/zh-hant/learn/dca-bot/)用一支腳本模擬過，兩份結果都不是在替這種做法打廣告。

**你能讓一台機器一直開著、一直更新嗎？** 自架的機器人在電腦休眠時就停了，上面的金鑰也歸你看管。如果這聽起來像是你會跳過不做的雜事，選代管服務才是對自己老實。

**策略到底測過沒有？** 免費的機器人，會免費替你跑一個賠錢的策略。不管挑哪個工具，先把成本算進去[回測](/zh-hant/learn/how-to-backtest-a-trading-strategy/)，再看它不帶錢跑一陣子：[模擬交易](/zh-hant/learn/paper-trading-crypto/)和 [Bybit 測試網](/zh-hant/learn/bybit-testnet/)抓得到的錯不一樣。在任何機器人替你決定之前，先用[倉位大小計算機](/zh-hant/tools/position-size-calculator/)算好第一筆真倉位的大小。

## 常見問題

### 3Commas 有免費版嗎？

2026-11-22 的定價頁上沒有。上面是三個付費方案，月費 $20 起；有試用，長度沒寫；每個方案都含一個模擬帳戶。

### 免費的交易機器人真的免費嗎？

程式碼是。Jesse 的真錢交易要 $899 以上，伺服器要錢，每一張單照樣要付交易所的手續費。最大的成本通常是策略：我們自己那六個，回測全部是賠的。

### perpmath 可以取代 3Commas 嗎？

不行。它只在 Bybit 測試網下單，除了命令列沒有別的介面，也沒有現成的 DCA 或網格機器人可以直接打開。請把它當成一個學習的途徑：在你把帳戶交給任何機器人（付費或免費）之前，先弄懂機器人怎麼記帳、怎麼處理訂單。

### 開源的交易機器人比 3Commas 安全嗎？

不會自動比較安全。開源代表你讀得到程式碼，金鑰可以留在自己的機器上。它也代表那台機器、它的更新、金鑰的權限，都是你的工作。一把只能交易、綁了你自己 IP 的金鑰，在兩種做法底下都能限制損害的範圍。剩下的是前面問過的那一題：那台機器，你顧得來嗎？
