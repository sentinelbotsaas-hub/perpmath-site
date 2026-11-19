# perpmath 設計系統

寫給做頁面的人：首頁、工具、市場、研究與教學四個區塊，都只靠這份文件和 `src/components/ui/` 開工。這裡沒寫到的共用樣式就是沒有，需要的話請告訴地基負責人，不要在頁面裡自己發明一套。

方向是「Quantitative Minimalism」：深色為預設、一個強調色只當訊號用、數字用等寬字、全站唯一的記憶點是照比例畫的風險尺。規格在 `sentinel-bot/docs/plan-edu-site/redesign/SPEC.md`，規格和站長規則衝突時的裁決在同資料夾的 `BRIEF.md`。

## 一分鐘版本

```astro
---
import Base from '../../layouts/Base.astro';
import PageContainer from '../../components/ui/PageContainer.astro';
import PageHeader from '../../components/ui/PageHeader.astro';
import SectionHeader from '../../components/ui/SectionHeader.astro';
---

<Base locale={locale} path="/tools/" title={t.title} description={t.description} jsonLd={jsonLd}>
  <PageContainer lead>
    <PageHeader locale={locale} title={t.head} lede={t.lede} breadcrumb={trail} />
  </PageContainer>

  <PageContainer>
    <SectionHeader title={t.section.head} desc={t.section.sub} />
    <div class="cards cols-4">...</div>
  </PageContainer>
</Base>
```

五條不能破的規則：

1. **顏色和字型只走 token**。頁面的 `<style>` 裡不准出現色碼、`rgb()`、`font-family: "..."`，一律 `var(--color-*)`、`var(--font-*)`。
2. **不寫 CSS `transition`**。hover、focus 直接切換；會動的東西用下面「動畫」一節的 keyframes。
3. **每頁剛好一個 `<h1>`**，由 `PageHeader` 產生，不要再加第二個。
4. **卡片裡不放卡片**，區塊裡不放區塊（`.section` 不巢狀）。
5. **新字串走 `src/i18n/*.ts`**，不寫死在元件或頁面裡。

## Token

全部宣告在 `src/styles/tokens.css`。深色寫在 `:root`，淺色寫了兩份（`:root[data-theme="light"]` 與 `@media (prefers-color-scheme: light)` 裡的 `:root[data-theme="system"]`），改其中一份要同步改另一份。

### 顏色

| Token | 深色 | 淺色 | 用途 |
| --- | --- | --- | --- |
| `--color-bg` | `#09090b` | `#fafafa` | 頁面底色 |
| `--color-surface` | `#111114` | `#ffffff` | 卡片、輸入框、公式區塊、`.section.band` |
| `--color-surface-elevated` | `#18181b` | `#f4f4f5` | 下拉選單、tooltip、卡片 hover、選取中的小方塊 |
| `--color-border` | `#27272a` | `#e4e4e7` | 分隔線、卡片邊框（裝飾用） |
| `--color-border-hover` | `#3f3f46` | `#d4d4d8` | 卡片 hover 邊框、表頭底線 |
| `--color-border-control` | `#6b6b76` | `#85858f` | 輸入框、分段控制、次要按鈕的邊框 |
| `--color-text` | `#f4f4f5` | `#18181b` | 主要文字、標題、主要按鈕底色 |
| `--color-text-secondary` | `#a1a1aa` | `#52525b` | 內文次要文字、說明 |
| `--color-text-muted` | `#8b8b94` | `#6b6b74` | 註記、日期、座標軸標籤 |
| `--color-accent` | `#818cf8` | `#4f46e5` | 連結（文章內文）、focus 外框、目前所在的選單、滑桿、目前價 |
| `--color-accent-ink` | `#09090b` | `#ffffff` | 放在強調色底上的文字 |
| `--color-positive` | `#34d399` | `#047857` | 正值 |
| `--color-negative` | `#f87171` | `#c81e1e` | 負值、爆倉價、錯誤 |
| `--color-warning` | `#fbbf24` | `#b45309` | 風險警語、資料過期 |
| `--color-chart-blue` | `#60a5fa` | `#2563eb` | 圖表第二條線 |
| `--color-hover` | 文字色 7% | 同左 | 列、選單項目、ghost 按鈕的 hover 底 |
| `--color-accent-soft`、`--color-positive-soft`、`--color-negative-soft`、`--color-warning-soft` | 各色 14 到 16% | 同左 | 文字後面的淡色底 |
| `--color-scrim`、`--shadow-pop` | | | 遮罩、浮層陰影（只給選單與 tooltip） |

**對比度調整**（規格原值不到 WCAG AA 的地方，全部用實際數字算過）：

| Token | 規格值 | 問題 | 改成 | 改後最低對比 |
| --- | --- | --- | --- | --- |
| 深色 `text-muted` | `#71717a` | 在 bg／surface／elevated 上是 4.12／3.90／3.67，內文要 4.5 | `#8b8b94` | 5.25 |
| 淺色 `text-muted` | `#71717a` | 在 elevated 上 4.40 | `#6b6b74` | 4.80 |
| 淺色 `negative` | `#dc2626` | 在 elevated 上 4.39 | `#c81e1e` | 5.22 |
| 控制項邊框（新增） | `#27272a`／`#e4e4e7` | 對底色只有 1.2 到 1.3，控制項邊界要 3:1 | `#6b6b76`／`#85858f` | 3.32 |
| 淺色 `chart-blue`（規格沒給） | | | `#2563eb` | 4.70 |

強調色放在主要按鈕上的話，深色模式白字只有 2.98，所以主要按鈕不用強調色：它是「文字色底、背景色字」，深淺模式都是 16:1 以上。**強調色不當面積用**，只出現在連結、focus、選取狀態、目前價這些小地方。

顏色不能是唯一的訊號：正負值要有正負號或箭頭圖示，多空要有文字，錯誤要有訊息。

### 字型

| Token | 內容 | 用在 |
| --- | --- | --- |
| `--font-body` | Geist，中文走系統字（繁中 PingFang TC／Microsoft JhengHei，簡中換 SC／YaHei） | 內文 |
| `--font-display` | Geist，中文走 Noto Sans TC／SC 的標題子集，缺字再退回系統字 | h1 到 h4、主選單、按鈕、手風琴標題、頁尾欄位名 |
| `--font-mono` | Geist Mono | 數字、公式、程式碼、wordmark |

數字一律加 `class="num"`（等寬字加 tabular figures）。**`.num` 只包數字**，不要把整句中文包進去。標籤、表頭、說明永遠用內文字，不用等寬字。

字重只有三個：`--weight-regular`（400）、`--weight-medium`（500）、`--weight-strong`（600）。中文標題子集只有 600 這一個字重，所以標題不要設 700 或 800。

### 字級

| Token | 大小 | class | 用在 |
| --- | --- | --- | --- |
| `--text-hero` | 36 到 60px | `.h-hero` | 只有首頁 hero |
| `--text-page` | 30 到 40px | `.h-page` | 每頁的 h1 |
| `--text-section` | 26 到 32px | `.h-section` | 區塊標題 h2 |
| `--text-xl` | 22px | | 文章內 h3、舊版列表標題 |
| `--text-card` | 18px | `.h-card`、`.lede` | 卡片標題、導言 |
| `--text-md` | 16px | | 內文 |
| `--text-sm` | 14px | | 說明、表格、標籤 |
| `--text-xs` | 13px | `.fine` 是 14px | 註記、日期、麵包屑 |
| `--text-2xs` | 12px | | 只給圖表座標軸標籤 |
| `--text-result` | 36 到 56px | `.result-value` | 計算結果的大數字 |

行高用 `--leading-body`、`--leading-tight`、`--leading-display`、`--leading-figure`，中文頁面會自動放寬。中文標題不加負字距（`--tracking-display` 在中文頁是 0）。

### 間距、版面、圓角

4px 為底：`--space-1`（4）、`-2`（8）、`-3`（12）、`-4`（16）、`-5`（20）、`-6`（24）、`-8`（32）、`-10`（40）、`-12`（48）、`-16`（64）、`-24`（96）、`-28`（112）。

| Token | 值 | 說明 |
| --- | --- | --- |
| `--container` | 1280px | 頁面最大寬，含左右留白 |
| `--measure` | 760px | 閱讀寬度 |
| `--gutter` | 32px，760px 以下 20px | 左右留白 |
| `--section-y` | 手機 56px 到 1440 寬 100px | 區塊上下間距 |
| `--header-h` | 64px | 頁首高度，sticky 元素的 `top` 要用它 |
| `--control-h` | 48px | 輸入框、按鈕 |
| `--control-h-sm` | 36px | 頁首控制項、小按鈕 |
| `--tap` | 44px | 可點擊物的最小邊長 |
| `--card-pad` | 24px，760px 以下 20px | 卡片內距 |
| `--radius-card`／`--radius-control`／`--radius-sm`／`--radius-pill` | 12／8／6／999px | 卡片／輸入框與按鈕／小方塊／膠囊 |
| `--hairline`／`--line` | 1／2px | 細線／focus 外框與圖表線 |

多欄區塊的欄距統一用 `--space-10`；卡片格線的間距是 `--space-4`（`.cards` 已設好）。

### 舊 token 名稱

改版前的名稱還在，都是指到新 token 的別名，所以舊頁面不會壞：`--color-paper`、`--color-paper-2`、`--color-ink`、`--color-muted`、`--color-rule`、`--font-outlier`、`--space-2xs` 到 `--space-3xl`、`--section-gap`、`--text-lg`、`--text-display`、`--text-figure`、`--radius`。**重寫頁面時請換成新名稱**，四個區塊都換完後地基會把別名刪掉。

`--color-ink` 和 `--color-paper` 在 `.verdict` 與 `.bar` 裡被重新指向別的顏色（為了讓舊頁面的 sticky 表格欄和每日報告的刻度看得見），所以不要在新程式碼裡用這兩個名稱。

## 字型怎麼載入

檔案都在 `public/fonts/`，已 commit，build 不會下載任何東西：

| 檔案 | 大小 | 內容 |
| --- | --- | --- |
| `geist-sans-latin-var.woff2` | 32 KB | Geist，variable 100 到 900，拉丁子集 |
| `geist-mono-latin-var.woff2` | 34 KB | Geist Mono，同上 |
| `noto-sans-tc-head.woff2` | 約 58 KB | Noto Sans TC，只有 600 字重，只含繁中頁標題用字 |
| `noto-sans-sc-head.woff2` | 約 51 KB | Noto Sans SC，同上，簡中頁用 |
| `Geist-OFL.txt`、`NotoSans-OFL.txt` | | 授權（SIL OFL 1.1） |

`src/layouts/fonts.ts` 產生 `@font-face`（`font-display: swap`）與 preload，`Base.astro` 印在每頁 `<head>`。英文頁不載 Noto；繁中頁只載 TC，簡中頁只載 SC。網址後面的 `?v=` 是檔案雜湊，重做子集後快取會自動失效。

不會位移的原因：拉丁字有量過字寬的 fallback 字型（`Geist Fallback` 等，用 `size-adjust` 對齊 Arial／Consolas）；中文字每個都是全形，換字型不改變寬度；行高都是寫死的倍數。實測首頁、計算機、數據頁在 1440 與 390 寬的載入 CLS 都是 0。

### 何時要重跑中文子集

標題（h1 到 h4）、主選單、按鈕、手風琴標題、頁尾欄位名裡的**中文字有增減**時：新文章、新頁面、改按鈕文字都算。

```bash
npm run build        # 結尾會印出缺哪些字（只提醒，不會讓 build 失敗）
npm run fonts:cjk    # 重做兩個子集（需要 Python 3 與 fonttools、brotli）
npm run build        # 再 build 一次，確認訊息變成「cover every heading」
```

然後 commit `public/fonts/*.woff2` 與 `src/layouts/cjk-head-chars.json`。`npm run fonts:check` 是同一個檢查的嚴格版（缺字時結束碼 1），可以放進 CI。

缺字不會壞版：那個字會用系統字畫，只是筆畫粗細和旁邊的字略有不同。來源字型第一次會從 Google Fonts 的 GitHub 下載到 `.tmp/fonts/`（已 gitignore）。

## 版型

`Base.astro` 給你 `<head>`、跳到內容連結、sticky 頁首、`<main>`、相關教學區塊、頁尾。`<main>` 裡沒有任何包裝，頁面就是一疊全寬的區塊。props 和改版前一樣（`locale`、`path`、`title`、`description`、`bareTitle`、`availableLocales`、`noindex`、`switcherPath`、`ogType`、`jsonLd`）；`surface` 還收，但沒有作用了。SEO 相關的輸出一個字都沒改。

### PageContainer

```astro
<PageContainer lead>...</PageContainer>           <!-- 頁首下面第一個區塊，上方留白較少 -->
<PageContainer>...</PageContainer>                <!-- 一般區塊 -->
<PageContainer snug>...</PageContainer>           <!-- 上下 48px -->
<PageContainer flush>...</PageContainer>          <!-- 上方不留白，接續上一個區塊 -->
<PageContainer band id="result">...</PageContainer> <!-- 浮起的底色，上下有線 -->
<PageContainer narrow>...</PageContainer>         <!-- 760px 閱讀欄 -->
```

props：`as`（`section`｜`div`｜`article`｜`aside`）、`lead`、`snug`、`flush`、`band`、`narrow`、`id`、`class`、`wrapClass`、`aria-label`、`aria-labelledby`。它輸出 `<section class="section"><div class="wrap">`，要自己寫這兩層也可以。

舊的三個「surface」class（`.measure`、`.read`、`.verdict`）還能用，已經改成新配色的普通區塊，重寫頁面時換成 `.section`。

### PageHeader

```astro
<PageHeader locale={locale} title={t.title} lede={t.lede} breadcrumb={trail}>
  <DataFreshness slot="meta" locale={locale} date={date} source="Bybit" />
  <a slot="actions" class="btn" href="#calculator">{t.start}</a>
</PageHeader>
```

props：`locale`、`title`、`lede`、`breadcrumb`、`size`（`page`｜`hero`，hero 只給首頁）、`titleId`、`class`。slot：`meta`（日期、來源）、`actions`（按鈕）、預設 slot。

### Breadcrumb

```astro
const trail = [
  { name: c.breadcrumb.home, path: '/' },
  { name: c.nav.tools, path: '/tools/' },
  { name: t.title, path: PATH },
];
<Breadcrumb locale={locale} items={trail} />
```

和 `breadcrumbLd()` 用同一個陣列，畫面和 JSON-LD 才不會對不上。路徑不帶語系，最後一項是目前頁面（印成文字）。`PageHeader` 的 `breadcrumb` 會幫你渲染，通常不用直接用這個元件。

### SectionHeader

```astro
<SectionHeader title={t.tools.head} desc={t.tools.sub}
               href={localePath(locale, '/tools/')} linkLabel={t.tools.all} />
```

props：`title`、`desc`、`level`（2｜3）、`id`、`href` 加 `linkLabel`、`class`；slot `action` 放其他東西。連結文字裡不要放箭頭字元，元件會加圖示。

## 按鈕與連結

```astro
<Button href={url}>打開爆倉價計算機</Button>
<Button variant="secondary" href={url}>看公式</Button>
<Button variant="ghost" size="sm" icon="rotate-ccw" id="reset">重設</Button>
<Button variant="text" href={url}>看全部回測結果</Button>
```

| class | 樣子 | 用在 |
| --- | --- | --- |
| `.btn` | 文字色底，48px 高 | 一個區塊唯一的主要動作 |
| `.btn.secondary`（舊名 `.btn.quiet`） | 外框 | 旁邊的次要動作 |
| `.btn.ghost` | 沒有邊框 | 重設、複製這類工具動作 |
| `.btn.sm` | 36px 高 | 密集的地方 |
| `.lnk` | 帶底線的文字連結，44px 高 | 一排動作裡的文字連結 |
| `.acts` | 一排動作的容器 | 一個 `.btn` 加最多一個次要動作 |

`Button.astro` props：`variant`（`primary`｜`secondary`｜`ghost`｜`text`）、`size`（`md`｜`sm`）、`href`（有就輸出 `<a>`）、`type`、`icon`、`iconAfter`、`disabled`、`id`、`rel`、任何 `data-*` 與 `aria-*`。直接寫 class 也可以。

文字寫「按下去會發生什麼」（「複製結果」），不寫「送出」「點我」。`disabled` 與 `aria-disabled="true"` 都有樣式。

### Cta 與 AffiliateDisclosure

出站到 Bybit 的動作一律用 `Cta.astro`，它會自動接上揭露文字：

```astro
<Cta locale={locale} pageType="tool" position="result"
     primary={{ label: c.cta.testnet, exit: 'bybit-testnet' }}
     secondary={{ label: c.cta.liveAccount, exit: 'bybit' }} />
```

props 和以前一樣，多一個 `secondaryStyle`（`link` 預設｜`button`）。規則沒變：一頁最多兩個動作、聯盟連結永遠是 `/go/bybit/`、**放在計算結果之後**、不用促銷色或促銷語氣。自己組出站按鈕時才直接用 `<AffiliateDisclosure locale primary secondary />`。

## 卡片

```astro
<div class="cards cols-4">   <!-- cols-2、cols-3、cols-4；手機 1 欄，平板 2 欄 -->
  <ToolCard locale={locale} href={tool.href} icon="ruler" title={tool.name} desc={tool.question}>
    <!-- 選填：小圖或標明是範例的結果 -->
  </ToolCard>
</div>
```

| 元件 | props | 說明 |
| --- | --- | --- |
| `Card` | `href`、`as`、`rel`、`id`、`class` | 基底。有 `href` 整張卡是一個連結，裡面不能再放連結或按鈕 |
| `ToolCard` | `locale`、`href`（沒有就是「製作中」，不會是連結）、`icon`、`title`、`desc`、`level` | 預設 slot 放小圖；`foot` slot 放左下角文字 |
| `MetricCard` | `label`、`value`、`unit`、`note`、`tone`、`trend`、`valueId`、`noteId`、`bare` | `tone` 上色時要一起給 `trend`（箭頭）或讓正負號寫在值裡；`bare` 去掉外框，放在已經有框的面板裡 |
| `ArticleCard` | `href`、`title`、`desc`、`category`、`date`（ISO 日期）、`level` | 純文字卡，沒有圖片位置 |

卡片內可用的零件：`.card-icon`、`.card-title`、`.card-desc`、`.card-meta`（分類與日期，用間距分開，不用「·」）、`.card-viz`、`.card-foot`、`.tag`（小膠囊標籤）。

未完成的工具用沒有 `href` 的 `ToolCard`，不要給日期，不要做成可點。

## 資料呈現

### DataTable

```astro
<DataTable locale={locale} label={t.table.label} caption={t.table.caption} stickyFirst>
  <thead><tr><th scope="col">槓桿</th><th scope="col">爆倉天數</th></tr></thead>
  <tbody><tr><th scope="row">10 倍</th><td class="num">3</td></tr></tbody>
</DataTable>
```

props：`locale`、`label`（必填，捲動區的名稱）、`caption`、`stickyFirst`、`dense`、`framed`（卡片外框，不要放進另一張卡片）、`hint`（小螢幕顯示「可以左右捲動」）、`id`、`class`。寬表格在自己的框裡橫向捲動，頁面不會被撐寬；捲動區可以用鍵盤聚焦。數字靠右、第一欄靠左是預設。舊的 `.tw` 包裝還能用。

### FormulaBlock

```astro
<FormulaBlock label={t.formula.longLabel} formula={t.formula.long}>
  <Fragment slot="terms"><p>...</p></Fragment>
</FormulaBlock>
```

props：`label`、`formula`（保留換行）或預設 slot、`id`、`class`。長公式會換行，不會橫向捲動。用真正的數學符號（× ÷ −）。直接寫 `<pre>` 也是同一個樣子。

### DataFreshness

```astro
<DataFreshness locale={locale} date={snapshotDate(BTCUSDT)} source="Bybit 公開 API" />
<DataFreshness locale={locale} time="2026-11-18T16:00:00Z" timeLabel="16:00 UTC" source="Bybit" stale />
```

props：`locale`、`date`（資料日期）、`time` 加 `timeLabel`（要自己寫出時區）、`source`、`sourceHref`、`stale`（顯示過期警告）、`id`、`class`。每個顯示市場或交易所資料的表格、圖表、數字旁邊都要有一個。日期來自資料檔，不准手寫。腳本更新用 `[data-fresh="date"]`、`[data-fresh="time"]`。

### ChartContainer

```astro
<ChartContainer locale={locale} title={t.chart.title} desc={t.chart.desc} ratio="16 / 7" minHeight={220}>
  <svg viewBox="0 0 800 350" role="img" aria-labelledby="...">...</svg>
  <DataFreshness slot="footer" locale={locale} date={date} source="Bybit" />
</ChartContainer>
```

props：`locale`、`title`、`desc`、`level`、`ratio`（寬／高，預設 `16 / 9`）、`minHeight`、`state`（`ready`｜`empty`｜`error`｜`loading`）、`live`、`emptyTitle`、`emptyBody`、`errorTitle`、`errorBody`、`framed`、`id`、`class`。

- 圖表是建置時從真實資料算出來的內嵌 SVG，不裝圖表庫。SVG 要有文字替代，旁邊要有同一組數字的表格或句子。
- 建置時沒資料就傳 `state="empty"`。
- 由腳本填的圖表傳 `live`，再用 `box.dataset.state = 'loading' | 'ready' | 'empty' | 'error'` 切換。
- 繪圖區的尺寸一開始就保留好，載入前後不位移。
- SVG 的顏色用 class：`.stroke-text`、`.stroke-muted`、`.stroke-grid`、`.stroke-accent`、`.stroke-blue`、`.stroke-positive`、`.stroke-negative`，以及對應的 `.fill-*`；或在自己的 `<style>` 裡用 token。

### Meter

```astro
<Meter value={0.382} label="樣本外勝率 38.2%" />
<Meter value={used} label={...} tone="negative" size="tall" id="margin-meter" />
```

一個比例照真實長度畫（整條是 100%）。props：`value`（0 到 1）、`label`（必填，文字替代）、`tone`、`size`（`thin`｜`tall`）、`id`、`class`。腳本更新：`el.style.setProperty('--value', '0.42')` 再改 `aria-label`。**價格距離不要用它，用風險尺。**

## 狀態與提示

| 元件 | 用法 | 重點 |
| --- | --- | --- |
| `Disclaimer` | `<Disclaimer locale={locale} />`（風險警語）、`kind="estimate"`（結果是估計值）、`kind="warning"｜"info"` 加 `title` 與 slot | 圖示和標題說明這是什麼，不靠顏色。不准寫「安全槓桿」 |
| `EmptyState` | `<EmptyState title body icon>` 加一個動作 slot | 說清楚少了什麼、下一步是什麼 |
| `ErrorState` | `<ErrorState title body hidden id>` 加重試按鈕 slot | 預設 `role="alert"`；建置時就在頁面上的錯誤訊息傳 `announce={false}`。不准用舊資料或假資料頂替 |
| `Skeleton` | `<Skeleton width="8ch" height="1.2em" />`、`lines={3}`、`fill` | 只給真的在頁面載入後才來的內容；建置時就有的內容直接渲染 |
| `Tooltip` | `<Tooltip locale={locale} term="MMR" tip={t.terms.mmr} />`，`icon` 只顯示問號，`align="start｜center｜end"` | 觸發點是真的 `<button>`，hover 與鍵盤 focus 都會開，Esc 關閉。必要資訊（假設、單位、錯誤）不准只放在 tooltip 裡 |
| `Accordion` | `<Accordion summary={q} level={3} name="faq">...</Accordion>`，`open` 預設展開 | 原生 `<details>`，沒有 JS 也能開。公式、假設、風險警語不准藏在裡面 |
| `Icon` | `<Icon name="calculator" size={18} />`，有意義時加 `label` | Lucide 的路徑內嵌，50 個。站上不用 emoji；缺圖示就到 `Icon.astro` 補一個 |

目前的圖示名稱：`activity`、`arrow-down`、`arrow-left-right`、`arrow-right`、`arrow-up`、`arrow-up-right`、`book-open`、`calculator`、`calendar`、`chart-candlestick`、`chart-column`、`chart-line`、`check`、`chevron-down`、`chevron-left`、`chevron-right`、`chevron-up`、`circle-alert`、`circle-help`、`clock`、`code`、`copy`、`database`、`external-link`、`file-text`、`flask-conical`、`gauge`、`globe`、`hourglass`、`info`、`layers`、`link`、`list`、`menu`、`minus`、`monitor`、`moon`、`percent`、`plus`、`refresh-cw`、`rotate-ccw`、`ruler`、`scale`、`sigma`、`sun`、`target`、`trending-down`、`trending-up`、`triangle-alert`、`x`。

## 表單控制項（樣式）

`Field.astro` 與 `Segmented.astro` 屬於工具負責人，地基只提供 class。現有的兩個元件不用改就已經是新樣子。

```html
<form class="fields">                       <!-- 預設 2 欄，420px 以下 1 欄；.cols-1、.cols-4 可選 -->
  <div class="field">
    <label class="field-label" for="entry">進場價</label>
    <span class="field-box">
      <input id="entry" type="text" inputmode="decimal" value="68000" aria-describedby="entry-hint entry-error" />
      <span aria-hidden="true">USDT</span>   <!-- 單位 -->
    </span>
    <span class="field-hint" id="entry-hint">...</span>
    <span class="field-error" id="entry-error" role="alert" hidden></span>
  </div>
</form>
```

- **錯誤**：在 input 上設 `aria-invalid="true"`，外框會變粗變紅；同時在 `.field-error` 寫出「怎麼修」，不能只變色。
- **停用**：input 加 `disabled`。
- **NumericInput** 就是 `.field-box` 裡放 `<input type="text" inputmode="decimal">`，數字會用等寬字。單獨的輸入框或下拉用 `class="input"`。
- **SegmentedControl**：`.seg` 裡放 `<label><input type="radio"><span>文字</span></label>`，幾個選項都可以。選中的是反色實心塊加粗字。
- **Slider**：`<div class="slider-row">` 裡放 `<label class="field-label">`、`<input class="slider" type="range">`、一個 `.field-box`。滑桿用瀏覽器原生外觀，顏色跟強調色。舊名 `.ctl` 還能用。滑桿要設 `aria-valuetext`。
- **進階參數**用 `Accordion` 收合。

### 結果

```html
<div aria-live="polite" aria-atomic="true">
  <p class="result-label">爆倉價</p>
  <p class="result-value" id="out-price">64,824.4</p>
</div>
```

`.result-value`（舊名 `.figure`）是 36 到 56px 的等寬數字。`aria-live` 只包「主要結果」那一小塊，不要包整個面板，否則每次按鍵螢幕閱讀器都會念一大串。值改變時可以加 `.is-updated`（一次 200ms 的淡入，動畫結束後移除 class）。

## 風險尺（RiskRuler）

全站唯一的記憶點。一條從 0 開始的線性價格軸，進場價和爆倉價是軸上的兩個記號，中間那段色帶的長度就是價格要走的真實比例。**不放大、不截斷**：100 倍槓桿時兩個記號幾乎貼在一起，那正是重點。

```astro
<RiskRuler locale={locale} id="calc-ruler" side="long"
           entry={68000} liquidation={64824.4} decimals={1} />
```

| prop | 說明 |
| --- | --- |
| `locale` | 必填 |
| `entry`、`liquidation` | 進場價、爆倉價。任一個不是大於 0 的有限數字就顯示空狀態 |
| `side` | `long`｜`short` |
| `current` | 目前價，選填 |
| `unit` | 預設 `USDT` |
| `decimals` | 價格的小數位，預設 0 |
| `size` | `m`｜`l`（首頁 hero 用 `l`） |
| `reserveCurrent` | 之後腳本可能補上目前價時設 `true`，先保留那一列，補上時才不會位移 |
| `caption` | `visible`（預設，尺下方印出整句說明）｜`sr`（只給螢幕閱讀器，頁面別處已經印過同一句時用） |
| `id`、`class` | |

多空不靠顏色分辨：有「做多／做空」文字、圖示翻轉、爆倉記號在進場記號的左邊或右邊、一個從進場側指向爆倉記號的楔形。三個記號的形狀也不同（圓點是進場價、菱形是爆倉價、空心圓是目前價），標籤前面有同樣的形狀。圖形對螢幕閱讀器隱藏，`<figcaption>` 用一句話講同一件事。

### 用腳本即時更新

```ts
import { updateRiskRuler } from '../components/ui/risk-ruler';

const ruler = document.querySelector<HTMLElement>('#calc-ruler')!;
updateRiskRuler(ruler, { entry, liquidation, side, current });
// 不會爆倉、輸入無效時：傳無效的數字，第三個參數是要顯示的訊息
updateRiskRuler(ruler, { entry, liquidation: NaN, side }, t.ui.cannotLiquidate);
```

- `risk-ruler.ts` 可以放心 import 進瀏覽器腳本（只依賴 `src/lib/fmt.ts`，不會把 OpenCC 字典包進去）。字串由元件放在 `data-rr-strings`，不用自己傳。
- 回傳值是 layout 物件，裡面有 `distance`（比例）、`gap`（價差）、`text.distance`、`text.summary`，可以直接拿來填別的地方，不用自己再算一次。
- **不要自己改 style**。所有記號都用 `transform` 定位，更新不會造成版面位移（實測拖動時 CLS 不變）。
- 爆倉價本身仍然由 `src/lib/calc/liquidation.ts` 算，風險尺只負責畫。
- 風險尺本身不是 live region。把 `aria-live` 放在結果數字上，不要兩邊都放。

掛點（需要讀值時用）：根元素有 `data-risk-ruler`、`data-state`（`ready`｜`empty`）、`data-side`、`data-entry`、`data-liq`；零件是 `[data-rr="side|distance|entry|liq|current|gap|ticks|summary|empty"]`，印出來的價格是 `[data-rr="entry-value|liq-value|current-value"]`。

它取代 `Scale.astro` 的「價格距離」用途。`Scale.astro` 先留著（舊頁面還在用），其他比例條（勝率等）改用 `Meter`。

## 頁首與頁尾

不用自己放，`Base.astro` 會放。

- **頁首**：sticky，64px。四組主選單（工具、市場、研究、教學），有子項目的是下拉面板，教學只有一個目的地所以是普通連結。語言切換保留原行為（留在同一頁，沒翻譯的文章回到該語言的上層頁）。主題切換有深色、淺色、跟隨系統三個選項。
- **手機**（860px 以下）：選單按鈕打開頁首下方的整頁面板，各組在面板裡展開；面板開著時後面的頁面不能捲、不能聚焦。
- **沒有 JavaScript**：四組都是連到總覽頁的普通連結，語言連結照常顯示；主題切換和選單按鈕隱藏。
- **選單項目在 `Nav.astro` 的 `groups`**，頁面存在才會出現（`pageExists`）。新增總覽頁或數據頁之後要加選單項目的話，告訴地基負責人。
- **頁尾**：品牌一句話、五欄連結、風險警語、聯盟揭露、語言連結。只連到存在的頁面。

頁面裡要做 sticky 的東西：`top: var(--header-h)`（或再加間距），`z-index: var(--z-sticky)`，才不會被頁首蓋住或蓋住頁首。頁內錨點已經用 `scroll-padding-top` 避開頁首。

## 動畫

- **全站沒有 CSS `transition`**。hover、focus、選取狀態直接切換。
- 會動的東西用 `@keyframes`，只動 `transform` 與 `opacity`，一定加 `animation-fill-mode: both`：

  ```css
  .my-panel[data-open] {
    animation: pm-rise-in var(--dur) var(--ease-out) both;
  }
  ```

- 現成的 keyframes（在 `components.css` 最後）：`pm-pop-in`（下拉面板）、`pm-sheet-in`（手機面板）、`pm-rise-in`（手風琴內容）、`pm-fade-in`（tooltip）、`pm-flash`（`.is-updated`，值更新）、`pm-pulse`（骨架）。時間用 `--dur-fast`（140ms）與 `--dur`（200ms），曲線用 `--ease-out`。
- 不要動 `width`、`height`、`top`、`left`、`margin`。要改變長度就用 `transform: scaleX()`，要移動就用 `translate`（風險尺和 Meter 都是這樣做的）。
- 不做捲動進場動畫，不做會擋住內容的載入動畫。
- `prefers-reduced-motion: reduce` 由 `base.css` 統一關掉所有動畫，不用自己處理；但動畫結束後的狀態必須就是正確的最終狀態，內容不能靠動畫才出現。
- 由腳本更新位置時也只改 `transform` 或 CSS 變數，CLS 必須是 0。

## 深色與淺色

- `<html data-theme="dark | light | system">`。預設 `dark`；讀者的選擇存在 `localStorage` 的 `perpmath-theme`，`<head>` 裡一小段內聯腳本在第一次繪製前套用，重新整理不會閃。localStorage 被擋時靜靜地維持預設。
- **不要寫 `@media (prefers-color-scheme: ...)`**。系統設定只在讀者選了「跟隨系統」時才生效，這件事 token 已經處理好；頁面只要用 token，兩種模式就都對。
- 不要假設「底是深的」：不寫 `color: white`、不用半透明黑白疊色。要淡色底用 `--color-*-soft` 或 `--color-hover`。
- SVG 圖表用 `currentColor` 或 token，不寫死色碼；線條壓在文字上要描邊時用 `stroke: var(--color-bg)`。
- 截圖檢查淺色時注意：`shots.mjs` 的 `light` 是模擬系統設定，而這個站預設是深色，所以拍出來還是深色。要拍淺色得先把 `localStorage['perpmath-theme']` 設成 `light`（見交付回報裡的做法）。
- 兩種模式都要看過：至少 1440 與 390 寬各一張。

## 無障礙檢查表

- 每個互動元素都有立即出現的 `:focus-visible` 外框（全域已設，不要 `outline: none`）。
- 可點擊物至少 44px 高（`.btn`、`.lnk`、`.field-box` 已經是）。
- 表單欄位有看得見的 `<label>`；錯誤訊息寫出怎麼修。
- 圖表、風險尺、Meter 都要有文字版。
- 財務結果不只靠顏色：正負號、箭頭、文字至少一樣。
- 表頭、標籤、分類不寫全大寫加字距；不用「·」串接資訊；連結文字不黏箭頭字元。
- 關掉 JavaScript 時，說明、公式、例題、預設值算出來的結果都還在。

## 檔案位置

```
src/styles/tokens.css       token、主題、Hallmark stamp（第一行）
src/styles/base.css         reset、字體、容器、區塊、prose、表格、舊 surface
src/styles/components.css   所有共用元件的樣式、動畫 keyframes
src/layouts/Base.astro      版型
src/layouts/fonts.ts        @font-face 與 preload
src/layouts/cjk-head-chars.json  中文標題子集裡有哪些字（腳本產生）
src/components/Nav.astro、Footer.astro、Cta.astro、RelatedArticles.astro
src/components/ui/          共用元件、risk-ruler.ts
src/scripts/nav.ts、theme.ts  頁首行為、主題切換
src/i18n/common.ts          共用字串（nav、theme、footer、cta、ui、ruler）
scripts/subset-cjk.mjs      中文標題字型子集
public/fonts/               字型檔與授權
```

頁面專屬的樣式寫在自己頁面或元件的 `<style>` 裡，只用 token。class 名稱避開這些已經被全域用掉的：`card`、`cards`、`btn`、`lnk`、`acts`、`tag`、`note`、`tip`、`meter`、`metric`、`formula`、`field*`、`seg`、`slider*`、`skeleton`、`state-box`、`chart-box*`、`table-scroll`、`data-table`、`accordion`、`breadcrumb`、`page-header`、`section-header`、`section`、`wrap`、`rr*`、`menu-*`、`site-*`、`footer-*`。
