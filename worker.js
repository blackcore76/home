const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const NV_HDR = {
  'Referer': 'https://finance.naver.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*;q=0.9',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
};

const TTL = { quote: 120, candles: 600, index: 60, news: 300 };

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(req, event) {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (url.pathname === '/' && url.searchParams.has('url')) {
    return corsProxy(url.searchParams.get('url'));
  }

  const path = url.pathname;
  const qs = url.searchParams;
  const cache = caches.default;
  const cacheKey = new Request(req.url);

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let data, ttl;
  try {
    if (path === '/naver/candles') {
      const code = qs.get('code');
      if (!code) return errRes('code required');
      data = await naverCandles(code, parseInt(qs.get('days') || '70'));
      ttl = TTL.candles;
    } else if (path === '/naver/quote') {
      const code = qs.get('code');
      if (!code) return errRes('code required');
      data = await naverQuote(code);
      ttl = TTL.quote;
    } else if (path === '/naver/index') {
      data = await naverIndex();
      ttl = TTL.index;
    } else if (path === '/naver/news') {
      data = await naverNews(qs.get('tab') || 'main', parseInt(qs.get('count') || '25'));
      ttl = TTL.news;
    } else if (path === '/naver/debug') {
      const tab = qs.get('tab') || 'main';
      const url = NEWS_URLS[tab] || NEWS_URLS.main;
      const r = await fetch(url, { headers: Object.assign({}, NV_HDR, { 'Accept': 'text/html,*/*' }) });
      var html = await r.text();
      var idx = html.indexOf('news_read.naver');
      if (idx < 0) idx = html.indexOf('article_id=');
      var snippet = idx >= 0 ? html.slice(Math.max(0, idx - 200), idx + 2000) : html.slice(0, 3000);
      return new Response(JSON.stringify({ status: r.status, url: url, firstLinkAt: idx, snippet: snippet }), { headers: CORS });
    } else {
      return errRes('unknown route', 404);
    }
  } catch (e) {
    return errRes(e.message, 502);
  }

  const res = new Response(JSON.stringify(data), {
    headers: Object.assign({}, CORS, { 'Cache-Control': 'public, max-age=' + ttl }),
  });
  event.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function corsProxy(target) {
  try {
    const r = await fetch(target, { headers: { 'User-Agent': NV_HDR['User-Agent'] } });
    const body = await r.arrayBuffer();
    return new Response(body, {
      status: r.status,
      headers: Object.assign({}, CORS, {
        'Content-Type': r.headers.get('Content-Type') || 'application/json',
      }),
    });
  } catch (e) {
    return errRes(e.message);
  }
}

async function naverCandles(code, days) {
  const need = Math.ceil(days * 1.7);

  try {
    const res = await fetch(
      'https://m.stock.naver.com/api/stock/' + code + '/candle/day?count=' + need,
      { headers: NV_HDR }
    );
    if (res.ok) {
      const json = await res.json();
      const list = json.candleList || json.candles || (Array.isArray(json) ? json : null);
      if (list && list.length >= 20) {
        return list
          .map(function(r) {
            return {
              t: Math.floor(new Date(r.localTradedAt || r.date).getTime() / 1000),
              o: nv(r.openPrice),
              h: nv(r.highPrice),
              l: nv(r.lowPrice),
              c: nv(r.closePrice),
              v: nv(r.accumulatedTradingVolume || r.volume || 0),
            };
          })
          .filter(function(c) { return c.c > 0; })
          .sort(function(a, b) { return a.t - b.t; })
          .slice(-days);
      }
    }
  } catch (e1) {}

  const endD = new Date();
  const startD = new Date();
  startD.setDate(startD.getDate() - need);

  const res = await fetch(
    'https://api.finance.naver.com/siseJson.naver?symbol=' + code +
    '&requestType=1&startTime=' + fmtD(startD) + '&endTime=' + fmtD(endD) + '&timeframe=day',
    { headers: NV_HDR }
  );
  if (!res.ok) {
    const body = await res.text().catch(function() { return ''; });
    throw new Error('siseJson ' + res.status + ' | ' + body.slice(0, 200));
  }

  const text = await res.text();
  const clean = (text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).trim();

  // siseJson returns single-quoted array-of-arrays: [['날짜','시가',...],[date,o,h,l,c,v],...]
  // JSON.parse doesn't accept single quotes — replace them
  var json;
  try {
    json = JSON.parse(clean);
  } catch (e) {
    json = JSON.parse(clean.replace(/'/g, '"'));
  }

  var list;
  if (Array.isArray(json) && Array.isArray(json[0])) {
    // array-of-arrays format: first row = headers, rest = data
    list = json.slice(1)
      .filter(function(r) { return r[0]; })
      .map(function(r) {
        var ds = String(r[0]).replace(/\./g, '-');
        return {
          t: Math.floor(new Date(ds + 'T00:00:00+09:00').getTime() / 1000),
          o: nv(r[1]), h: nv(r[2]), l: nv(r[3]), c: nv(r[4]), v: nv(r[5]),
        };
      });
  } else {
    // array-of-objects format (Korean keys)
    var raw = Array.isArray(json) ? json : (json.result && json.result.itemList ? json.result.itemList : []);
    list = raw.map(function(r) {
      var ds = (r['날짜'] || r.date || '').replace(/\./g, '-');
      return {
        t: Math.floor(new Date(ds + 'T00:00:00+09:00').getTime() / 1000),
        o: nv(r['시가'] || r.openPrice),
        h: nv(r['고가'] || r.highPrice),
        l: nv(r['저가'] || r.lowPrice),
        c: nv(r['종가'] || r.closePrice),
        v: nv(r['거래량'] || r.volume || 0),
      };
    });
  }

  if (list.length < 20) throw new Error('insufficient data');

  return list
    .filter(function(c) { return c.c > 0; })
    .sort(function(a, b) { return a.t - b.t; })
    .slice(-days);
}

async function naverQuote(code) {
  const res = await fetch(
    'https://m.stock.naver.com/api/stock/' + code + '/basic',
    { headers: NV_HDR }
  );
  if (!res.ok) throw new Error('quote ' + res.status);
  const d = await res.json();
  return {
    code: code,
    name: d.stockName || code,
    price: nv(d.closePrice),
    change: nv(d.compareToPreviousClosePrice),
    changePct: nv(d.fluctuationsRatio),
    volume: nv(d.accumulatedTradingVolume),
    high52w: nv(d.highPrice),
    low52w: nv(d.lowPrice),
    marketCap: nv(d.marketValue),
  };
}

async function naverIndex() {
  const results = await Promise.all([
    fetch('https://m.stock.naver.com/api/index/KOSPI/basic', { headers: NV_HDR }).then(function(r) { return r.json(); }),
    fetch('https://m.stock.naver.com/api/index/KOSDAQ/basic', { headers: NV_HDR }).then(function(r) { return r.json(); }),
  ]);
  var k = results[0];
  var kq = results[1];
  return {
    kospi: { value: nv(k.closePrice), change: nv(k.compareToPreviousClosePrice), changePct: nv(k.fluctuationsRatio) },
    kosdaq: { value: nv(kq.closePrice), change: nv(kq.compareToPreviousClosePrice), changePct: nv(kq.fluctuationsRatio) },
  };
}

var NEWS_URLS = {
  main:     'https://finance.naver.com/news/mainnews.naver',
  realtime: 'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section_id=101&section_id2=258&type=0',
  popular:  'https://finance.naver.com/news/news_list.naver?mode=RANK',
  focus:    'https://finance.naver.com/news/news_list.naver?mode=LSS3D&section_id=101&section_id2=258&section_id3=401',
};

async function naverNews(tab, count) {
  var url = NEWS_URLS[tab] || NEWS_URLS.main;
  const res = await fetch(url, { headers: Object.assign({}, NV_HDR, { 'Accept': 'text/html,*/*' }) });
  if (!res.ok) throw new Error('news ' + res.status);
  // Pages declare UTF-8 but actually serve EUC-KR
  var html = new TextDecoder('euc-kr').decode(await res.arrayBuffer());
  // Skip the shared ticker section at the top
  var tickerEnd = html.indexOf('</dl>', html.indexOf('sub_tit_ticker'));
  if (tickerEnd > 0) html = html.slice(tickerEnd + 5);
  var items = parseNaverNewsAny(html, count);
  return { tab: tab, items: items };
}

var HTML_ENTITIES = {
  amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ',
  middot:'·', bull:'•', hellip:'…', ndash:'–', mdash:'—',
  lsquo:'‘', rsquo:'’', ldquo:'“', rdquo:'”',
  uarr:'↑', darr:'↓', rarr:'→', larr:'←',
  utrif:'▴', dtrif:'▾', utri:'△', dtri:'▽',
  times:'×', divide:'÷', plusmn:'±', deg:'°',
  copy:'©', reg:'®', trade:'™',
};

function decodeEntities(s) {
  return s
    .replace(/&([a-zA-Z]+);/g, function(m, name) { return HTML_ENTITIES[name] || m; })
    .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&#x([0-9a-fA-F]+);/g, function(_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/ /g, ' ');
}

// Universal parser: works for all Naver Finance news pages
// Extracts full title from title= attribute (link text is always truncated on Naver)
function parseNaverNewsAny(html, max) {
  var items = [];
  var seen = {};

  var dates = [];
  var dateRe = /<span[^>]*class="[^"]*wdate[^"]*"[^>]*>([^<]+)<\/span>/gi;
  var m;
  while ((m = dateRe.exec(html)) !== null) dates.push(m[1].trim());

  var sources = [];
  var srcRe = /<(?:span|em)[^>]*class="[^"]*(?:source|press_name|press)[^"]*"[^>]*>([^<]+)<\/(?:span|em)>/gi;
  while ((m = srcRe.exec(html)) !== null) sources.push(m[1].trim());

  var di = 0;

  // Match opening <a> tag whose href contains news_read.naver or article_id=
  var tagRe = /<a\b([^>]*(?:news_read\.naver|article_id=)[^>]*)>/gi;
  while ((m = tagRe.exec(html)) !== null && items.length < max) {
    var attrs = m[1];
    var hrefM = /href="([^"]+)"/.exec(attrs);
    var titleM = /title="([^"]+)"/.exec(attrs);
    if (!hrefM || !titleM) continue;
    var href = hrefM[1].trim();
    var title = decodeEntities(titleM[1]);
    if (!title || title.length < 8 || seen[href] || seen[title]) continue;
    seen[href] = true;
    seen[title] = true;
    items.push({
      url: href.indexOf('http') === 0 ? href : 'https://finance.naver.com' + href,
      title: title,
      time: dates[di] || '',
      source: sources[di] || '',
    });
    di++;
  }
  return items;
}

function parseNaverNewsList(html, max) {
  var dates = [];
  var m;
  var dateRe = /<span[^>]*class="[^"]*wdate[^"]*"[^>]*>([^<]+)<\/span>/gi;
  while ((m = dateRe.exec(html)) !== null) dates.push(m[1].trim());

  var items = [];
  var seen = {};
  var di = 0;

  // 1차: <dt> 안의 <a> (news_list 표준 구조)
  var dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>/gi;
  while ((m = dtRe.exec(html)) !== null && items.length < max) {
    var inner = m[1];
    var aM = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(inner);
    if (!aM) continue;
    var href = aM[1].trim();
    var title = decodeEntities(aM[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    if (!title || title.length < 6 || href.indexOf('javascript') === 0 || seen[href]) continue;
    seen[href] = true;
    items.push({ url: href.indexOf('http') === 0 ? href : 'https://finance.naver.com' + href, title: title, time: dates[di++] || '' });
  }

  // 2차 폴백: href에 article_id 포함된 모든 <a>
  if (items.length === 0) {
    var linkRe = /<a[^>]+href="([^"]*article_id=[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((m = linkRe.exec(html)) !== null && items.length < max) {
      var href = m[1].trim();
      var title = decodeEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
      if (!title || title.length < 6 || seen[href]) continue;
      seen[href] = true;
      items.push({ url: href.indexOf('http') === 0 ? href : 'https://finance.naver.com' + href, title: title, time: dates[di++] || '' });
    }
  }

  return items;
}

function nv(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/,/g, '')) || 0;
}

function fmtD(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function errRes(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status: status || 500,
    headers: CORS,
  });
}
