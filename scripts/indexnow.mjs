// After a deploy: tell IndexNow (Bing, Yandex and others) about every URL in
// the live sitemap. No secret: the IndexNow key is public by design and is
// hosted at https://perpmath.com/<key>.txt.
//
//   node scripts/indexnow.mjs
//
// Exits non-zero when the sitemap cannot be read or IndexNow refuses the list.
const SITE = 'https://perpmath.com/';
const KEY = 'e06dbd64feeb189cfcce3a65ce7995c6';

const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const urls = [];
for (const sitemap of locs(await get(SITE + 'sitemap-index.xml'))) urls.push(...locs(await get(sitemap)));
if (urls.length === 0) throw new Error('the live sitemap lists no URL');

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'perpmath.com', key: KEY, keyLocation: `${SITE}${KEY}.txt`, urlList: urls }),
});
console.log(`indexnow: ${urls.length} URLs, HTTP ${response.status}`);
if (response.status !== 200 && response.status !== 202) process.exit(1);
