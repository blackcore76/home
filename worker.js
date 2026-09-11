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
      const url = newsApiUrl(tab, 5);
      const r = await fetch(url, { headers: NEWS_HDR });
      var body = await r.text();
      return new Response(JSON.stringify({ status: r.status, url: url, snippet: body.slice(0, 3000) }), { headers: CORS });
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

// 2026: 네이버가 금융뉴스를 finance.naver.com(EUC-KR HTML) → stock.naver.com(JSON API)로 이전.
// 옛 news_list.naver / mainnews.naver 는 전부 302 리다이렉트되어 스크래핑 불가.
// 새 same-origin API: https://stock.naver.com/api/domestic/news/list?category=..&page=..&pageSize=..&date=YYYYMMDD
//   - 국내 3탭은 domestic/news/list, 해외뉴스는 foreign/news/worldNews (응답 형태가 다름)
var NEWS_HDR = {
  'Referer': 'https://stock.naver.com/',
  'User-Agent': NV_HDR['User-Agent'],
  'Accept': 'application/json, */*;q=0.9',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
};

// 프런트 탭 키 → 네이버 category (focus 탭은 네이버에서 폐지 → 해외뉴스로 교체)
var NEWS_CAT = {
  realtime: 'flashnews',
  main:     'mainnews',
  popular:  'ranknews',
};

function newsApiUrl(tab, count) {
  if (tab === 'focus') {
    return 'https://stock.naver.com/api/foreign/news/worldNews?page=1&pageSize=' + count;
  }
  var cat = NEWS_CAT[tab] || 'mainnews';
  return 'https://stock.naver.com/api/domestic/news/list?category=' + cat +
         '&page=1&pageSize=' + count + '&date=' + kstYmd();
}

async function naverNews(tab, count) {
  count = count > 0 ? count : 25;
  var res = await fetch(newsApiUrl(tab, count), { headers: NEWS_HDR });
  if (!res.ok) throw new Error('news ' + res.status);
  var data = await res.json();
  var today = kstYmd();
  var items;

  if (tab === 'focus') {
    // 해외뉴스: 최상위가 배열, 필드는 oid/aid/tit/ohnm/dt, 상세는 /news/worldnews/{aid}
    var arr = Array.isArray(data) ? data : (data.articles || []);
    items = arr.map(function(a) {
      return {
        url: 'https://stock.naver.com/news/worldnews/' + a.aid,
        title: decodeEntities(String(a.tit || '').trim()),
        time: fmtNewsTime(a.dt, today),
        source: a.ohnm || '',
      };
    });
  } else {
    // 국내뉴스: {articles:[{officeId, articleId, title, officeHname, datetime}]}
    var list = data.articles || [];
    items = list.map(function(a) {
      return {
        url: 'https://n.news.naver.com/article/' + a.officeId + '/' + a.articleId,
        title: decodeEntities(String(a.title || '').trim()),
        time: fmtNewsTime(a.datetime, today),
        source: a.officeHname || '',
      };
    });
  }

  var seen = {}, out = [];
  for (var i = 0; i < items.length && out.length < count; i++) {
    var it = items[i];
    if (!it.title || it.title.length < 6 || seen[it.url]) continue;
    seen[it.url] = true;
    out.push(it);
  }
  return { tab: tab, items: out };
}

// Worker는 UTC로 도므로 KST(UTC+9) 기준 YYYYMMDD 생성
function kstYmd() {
  var d = new Date(Date.now() + 9 * 3600 * 1000);
  var p = function(n) { return (n < 10 ? '0' : '') + n; };
  return '' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
}

// "2026-09-11 15:30:18"(국내) 또는 "20260911152705"(해외) → 오늘이면 HH:MM, 아니면 MM.DD
function fmtNewsTime(s, todayYmd) {
  s = String(s || '');
  var Y, Mo, D, h, mi;
  var m = s.match(/(\d{4})-(\d{2})-(\d{2})\D+(\d{2}):(\d{2})/);
  if (m) { Y = m[1]; Mo = m[2]; D = m[3]; h = m[4]; mi = m[5]; }
  else if (/^\d{14}$/.test(s)) { Y = s.slice(0,4); Mo = s.slice(4,6); D = s.slice(6,8); h = s.slice(8,10); mi = s.slice(10,12); }
  else return '';
  return (Y + Mo + D) === todayYmd ? (h + ':' + mi) : (Mo + '.' + D);
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
