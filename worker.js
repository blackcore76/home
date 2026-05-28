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
  realtime: 'https://finance.naver.com/news/news_list.naver?mode=LSS3D&section=101&category=3',
  popular:  'https://finance.naver.com/news/news_list.naver?mode=RANK',
  focus:    'https://finance.naver.com/news/news_list.naver?mode=LSS2D&section=101&category=311',
};

async function naverNews(tab, count) {
  var url = NEWS_URLS[tab] || NEWS_URLS.main;
  const res = await fetch(url, { headers: Object.assign({}, NV_HDR, { 'Accept': 'text/html,*/*' }) });
  if (!res.ok) throw new Error('news ' + res.status);

  // news_list.naver pages are EUC-KR; mainnews.naver is UTF-8
  var html;
  if (tab === 'main') {
    html = await res.text();
  } else {
    const buf = await res.arrayBuffer();
    html = new TextDecoder('euc-kr').decode(buf);
  }

  var items = tab === 'main' ? parseNaverMainNews(html, count) : parseNaverNewsList(html, count);
  return { tab: tab, items: items };
}

function parseNaverMainNews(html, max) {
  var items = [];
  var linkRe = /<dt[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  var dateRe = /<span[^>]*class="[^"]*wdate[^"]*"[^>]*>([^<]+)<\/span>/gi;
  var dates = [];
  var m;
  while ((m = dateRe.exec(html)) !== null) dates.push(m[1].trim());
  var i = 0;
  while ((m = linkRe.exec(html)) !== null && items.length < max) {
    var href = m[1].trim();
    var title = m[2].replace(/<[^>]+>/g, '').trim()
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#039;/g, "'").replace(/&quot;/g, '"');
    if (!title || href.indexOf('javascript') === 0 || href === '#') continue;
    items.push({
      url: href.indexOf('http') === 0 ? href : 'https://finance.naver.com' + href,
      title: title,
      time: dates[i++] || '',
    });
  }
  return items;
}

function parseNaverNewsList(html, max) {
  var items = [];
  var seen = {};
  var dateRe = /<span[^>]*class="[^"]*wdate[^"]*"[^>]*>([^<]+)<\/span>/gi;
  var linkRe = /<a[^>]+href="([^"]*(?:news_read\.naver|\/news\/article)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  var dates = [];
  var m;
  while ((m = dateRe.exec(html)) !== null) dates.push(m[1].trim());
  var i = 0;
  while ((m = linkRe.exec(html)) !== null && items.length < max) {
    var href = m[1].trim();
    var title = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&#039;/g, "'").replace(/&quot;/g, '"');
    if (!title || title.length < 6 || seen[href]) continue;
    seen[href] = true;
    items.push({
      url: href.indexOf('http') === 0 ? href : 'https://finance.naver.com' + href,
      title: title,
      time: dates[i++] || '',
    });
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
