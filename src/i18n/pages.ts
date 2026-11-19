// Strings for the small pages the skeleton owns: tools overview, learn,
// about, disclosure, not-available, 404 and the /go/ fallback.
// Nothing here may state a fact that is not true today: no user counts, no
// credentials, no bonus amounts.
import { defineStrings } from './strings';

export const pages = defineStrings({
  en: {
    tools: {
      title: 'Calculators for crypto perpetual futures',
      description:
        'Ten free calculators for perpetual futures traders: liquidation price, leverage, position size, drawdown and more. Each answers one question and draws the answer to scale.',
      head: 'Ten calculators, one question each.',
      sub: 'Free, no account. What you type never leaves your browser.',
    },
    learn: {
      title: 'Learn perpetual futures, with the numbers shown',
      description:
        'Plain-language lessons on crypto perpetual futures: liquidation, funding, leverage and risk. Each lesson shows the data and the arithmetic behind its claims.',
      head: 'Lessons that show their numbers.',
      sub: 'One idea per lesson, with the data and arithmetic behind it.',
      empty: 'No lessons are published yet. The calculators are ready.',
      toTools: 'See the calculators',
      published: 'Published {date}',
      updated: 'Updated {date}',
      summary: 'In short',
      toc: 'On this page',
      back: 'All lessons',
      ctaCalc: 'Open the liquidation calculator',
      ctaRun: 'Run it yourself',
      ctaResults: 'See every backtest result',
    },
    about: {
      title: 'About',
      description:
        'perpmath is a free set of calculators and lessons for crypto perpetual futures, made by an independent trader. How the numbers are made and what the site does not do.',
      head: 'Made by an independent trader.',
      lead: 'Free calculators and lessons for perpetual futures. No exchange runs this site.',
      sections: [
        { title: "What this is", body: ["A tools site for people who trade crypto perpetual futures. It does not manage anyone’s money."] },
        { title: "How the numbers are made", body: ["Every calculator runs in your browser and prints its formula. Exchange parameters come from Bybit’s public API, with the date they were fetched."] },
        { title: "What it does not do", body: ["No trade signals, no price targets, no promise of profit. Results are estimates; your exchange’s figure counts."] },
      ],
      paidTitle: 'How it is paid for',
      paidBody: 'Some links to Bybit are affiliate links.',
      // Shown while AFFILIATE_ACTIVE is false in site.config.mjs.
      paidBodyPlain: 'Nothing pays for it today. Links to Bybit are plain links.',
      paidLink: 'Read the disclosure',
      logTitle: 'Research log',
      logBody: 'The author keeps a research log on a separate site.',
      logLinkLabel: 'edgeautopsy.com',
    },
    disclosure: {
      title: 'How perpmath is paid for',
      description:
        'perpmath earns money from affiliate links to Bybit. Which links are affiliate links, what the commission does and does not change, and where we do not link at all.',
      head: 'Some Bybit links pay us a commission.',
      lead: 'Which links, what the commission changes, and where we do not link.',
      sections: [
        { title: "Affiliate links", body: ["Some links lead to Bybit through an affiliate link. If you open an account through one, we may earn a commission. You pay nothing extra."] },
        { title: "How they are marked", body: ["Every affiliate link has a line under it saying so. All of them leave this site through one address, /go/bybit/."] },
        { title: "Testnet links", body: ["Links to the Bybit testnet are not affiliate links. The testnet uses practice funds, not real money."] },
        { title: "What the commission does not change", body: ["Each calculator prints its formula and worked examples so you can check it. A commission does not change a number."] },
        { title: "Where we do not link", body: ["Visitors from some countries are not sent to Bybit, because Bybit does not serve them or local rules restrict promoting it."] },
      ],
    },
    // Shown while AFFILIATE_ACTIVE is false in site.config.mjs.
    disclosurePlain: {
      title: 'How perpmath is paid for',
      description:
        'perpmath earns nothing today. Its links to Bybit are plain links. What that means, what would change it, and where we do not link at all.',
      head: 'Today perpmath earns nothing.',
      lead: 'What that means, what would change it, and where we do not link.',
      sections: [
        { title: "Links to Bybit", body: ["Links to Bybit are plain links. Nobody pays perpmath for them. The site has no ads and sells nothing."] },
        { title: "What may change", body: ["We plan to apply to Bybit's affiliate programme. If accepted, links through /go/bybit/ become affiliate links, and this page and each link will say so first."] },
        { title: "Testnet links", body: ["Links to the Bybit testnet use practice funds, not real money."] },
        { title: "What a commission would not change", body: ["Each calculator prints its formula and worked examples so you can check it. A commission would not change a number."] },
        { title: "Where we do not link", body: ["Visitors from some countries are not sent to Bybit, because Bybit does not serve them or local rules restrict promoting it."] },
      ],
    },
    notAvailable: {
      title: 'Not available in your region',
      description:
        'We do not link to Bybit from your country or region. The calculators and lessons on perpmath work the same everywhere.',
      head: 'No link to Bybit from your region.',
      body: 'Bybit does not serve your region, or local rules restrict promoting it.',
      toTools: 'Go to the calculators',
      why: 'How this site is paid for',
    },
    notFound: {
      title: 'Page not found',
      description: 'This page does not exist on perpmath.',
      head: 'This page does not exist.',
      body: 'The address may be mistyped, or the page may have moved.',
      toHome: 'Go to the home page',
      toTools: 'See the calculators',
    },
    go: {
      title: 'Leaving perpmath',
      description: 'This address forwards to Bybit on the live site.',
      head: 'This address forwards to Bybit.',
      body: 'The forwarding rule is not active here, as in a local preview.',
      back: 'Back to perpmath',
    },
  },
  'zh-hant': {
    tools: {
      title: '加密貨幣永續合約計算機',
      description:
        '十個免費的永續合約計算機：爆倉價、槓桿、倉位大小、回撤等等。每個工具只回答一個問題，並把答案照真實比例畫出來，不用註冊就能用。',
      head: '十個計算機，各回答一個問題。',
      sub: '免費、不用註冊，你輸入的數字不會離開你的瀏覽器。',
    },
    learn: {
      title: '永續合約教學：把數字攤開來看',
      description:
        '用白話講解加密貨幣永續合約：爆倉、資金費率、槓桿與風險控管。每一篇都附上數據和計算過程，讓你可以自己驗算，不用只聽結論。',
      head: '每一篇都把數字攤開來。',
      sub: '每篇只講一個觀念，並附上背後的數據和計算過程。',
      empty: '目前還沒有上線的教學文章。計算機已經可以使用。',
      toTools: '看看計算機',
      published: '發布日期 {date}',
      updated: '更新日期 {date}',
      summary: '重點',
      toc: '本頁目錄',
      back: '所有教學',
      ctaCalc: '打開爆倉價計算機',
      ctaRun: '自己跑一次',
      ctaResults: '看所有回測結果',
    },
    about: {
      title: '關於本站',
      description:
        'perpmath 是一位獨立交易者做的免費工具站，提供加密貨幣永續合約的計算機與教學。這一頁說明數字怎麼來，以及本站不做哪些事。',
      head: '這個站是一位獨立交易者做的。',
      lead: '免費的永續合約計算機與教學，不是任何交易所經營的。',
      sections: [
        { title: "這是什麼", body: ["給交易加密貨幣永續合約的人用的工具站。本站不替任何人操作資金。"] },
        { title: "數字怎麼來", body: ["每個計算機都在你的瀏覽器裡計算，公式直接寫在頁面上。交易所參數取自 Bybit 的公開 API，並標出資料的日期。"] },
        { title: "本站不做的事", body: ["不提供進出場訊號，不寫目標價，也不保證獲利。計算結果是估計值，以你的交易所顯示的數字為準。"] },
      ],
      paidTitle: '本站的收入來源',
      paidBody: '部分前往 Bybit 的連結是聯盟連結。',
      paidBodyPlain: '目前沒有任何收入，前往 Bybit 的連結都是一般連結。',
      paidLink: '閱讀完整揭露',
      logTitle: '研究紀錄',
      logBody: '作者另外有一個網站，用來放研究紀錄。',
      logLinkLabel: 'edgeautopsy.com',
    },
    disclosure: {
      title: '本站的收入來源',
      description:
        'perpmath 的收入來自前往 Bybit 的聯盟連結。這一頁說明哪些連結是聯盟連結、佣金會影響什麼和不會影響什麼，以及哪些地區我們不放連結。',
      head: '部分前往 Bybit 的連結會讓我們收到佣金。',
      lead: '這一頁說明是哪些連結、佣金會影響什麼，以及哪些地區我們不放連結。',
      sections: [
        { title: "聯盟連結", body: ["本站部分連結會經由聯盟連結前往 Bybit。你經由這些連結開戶，我們可能會收到佣金，你不會多付任何費用。"] },
        { title: "怎麼標示", body: ["凡是放了聯盟連結的地方，下方都會有一行文字說明。所有聯盟連結都從同一個網址離開本站：/go/bybit/。"] },
        { title: "測試網連結", body: ["前往 Bybit 測試網的連結不是聯盟連結。測試網用的是練習資金，不是真錢。"] },
        { title: "佣金不會改變的事", body: ["每個計算機都列出公式和例題，你可以自己驗算。佣金不會改變任何一個數字。"] },
        { title: "我們不放連結的地區", body: ["部分國家和地區的訪客不會被導向 Bybit，原因可能是 Bybit 不在當地提供服務，或是當地法規限制推廣。"] },
      ],
    },
    disclosurePlain: {
      title: '本站的收入來源',
      description:
        'perpmath 目前沒有任何收入，前往 Bybit 的連結都是一般連結。這一頁說明現況、之後可能改變什麼，以及哪些地區我們不放連結。',
      head: 'perpmath 目前沒有任何收入。',
      lead: '這一頁說明現況、之後可能改變什麼，以及哪些地區我們不放連結。',
      sections: [
        { title: "前往 Bybit 的連結", body: ["目前前往 Bybit 的連結都是一般連結，沒有人為此付錢給 perpmath。本站沒有廣告，也不賣任何東西。"] },
        { title: "之後可能改變的事", body: ["我們打算申請 Bybit 的聯盟計畫。通過之後，經由 /go/bybit/ 的連結會變成聯盟連結，這一頁和每個連結旁邊都會先寫明。"] },
        { title: "測試網連結", body: ["前往 Bybit 測試網的連結用的是練習資金，不是真錢。"] },
        { title: "佣金不會改變的事", body: ["每個計算機都列出公式和例題，你可以自己驗算。就算之後有佣金，也不會改變任何一個數字。"] },
        { title: "我們不放連結的地區", body: ["部分國家和地區的訪客不會被導向 Bybit，原因可能是 Bybit 不在當地提供服務，或是當地法規限制推廣。"] },
      ],
    },
    notAvailable: {
      title: '你所在的地區不提供這個連結',
      description: '我們不會把你所在國家或地區的訪客導向 Bybit。perpmath 上的計算機和教學在任何地方都一樣可以使用。',
      head: '我們不會從你所在的地區連到 Bybit。',
      body: '原因可能是 Bybit 不在你的所在地提供服務，或是當地法規限制推廣。',
      toTools: '前往計算機',
      why: '本站的收入來源',
    },
    notFound: {
      title: '找不到這個頁面',
      description: 'perpmath 上沒有這個頁面。',
      head: '這個頁面不存在。',
      body: '可能是網址打錯了，或是頁面已經搬走。',
      toHome: '回到首頁',
      toTools: '看看計算機',
    },
    go: {
      title: '即將離開 perpmath',
      description: '在正式網站上，這個網址會轉往 Bybit。',
      head: '這個網址會轉往 Bybit。',
      body: '轉址規則在這個環境沒有啟用，例如本機預覽。',
      back: '回到 perpmath',
    },
  },
});
