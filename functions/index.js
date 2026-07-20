const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const { defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const REGION = 'asia-northeast3';

// 수동 테스트 트리거 보호용 (functions/.env 의 TEST_SECRET 값)
const TEST_SECRET = defineString('TEST_SECRET');

// market-dashboard.html의 알림 대상 종목과 동일 (dashboard는 CORS 프록시를 거치지만
// Cloud Functions는 서버라 Yahoo Finance를 직접 호출 가능)
const YF_SYMBOLS = {
  nasdaq: '^IXIC',
  sp500: '^GSPC',
  kospi: '^KS11',
  kosdaq: '^KQ11',
  gold: 'GC=F',
  usdkrw: 'KRW=X',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 같은 키·방향으로 재발송하기 전 최소 대기 시간 (임계값 경계에서 짧게 왔다갔다 하는 flapping 방지)
const MIN_RETRIGGER_MS = 15 * 60 * 1000;

async function fetchYahoo(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=5m`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== 'number') throw new Error('no price');
  return price;
}

async function fetchFng() {
  const res = await fetch('https://feargreedchart.com/api/?action=all', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const score = data?.score?.score;
  if (typeof score !== 'number') throw new Error('no score');
  return score;
}

async function fetchAllPrices() {
  const entries = Object.entries(YF_SYMBOLS);
  const prices = {};

  await Promise.all(entries.map(async ([key, sym]) => {
    try {
      prices[key] = await fetchYahoo(sym);
    } catch (e) {
      console.log(`marketAlertCheck: ${key}(${sym}) 시세 조회 실패 — ${e.message}`);
    }
  }));

  try {
    prices.fng = await fetchFng();
  } catch (e) {
    console.log(`marketAlertCheck: fng 조회 실패 — ${e.message}`);
  }

  return prices;
}

const ITEM_LABEL = {
  nasdaq: 'NASDAQ', sp500: 'S&P 500', kospi: 'KOSPI', kosdaq: 'KOSDAQ',
  gold: '금 현물', usdkrw: '환율', fng: '공포·탐욕지수',
};
function fmtValue(key, v) {
  if (key === 'gold') return `$${v.toFixed(2)}`;
  if (key === 'usdkrw') return `₩${v.toFixed(2)}`;
  if (key === 'kospi' || key === 'kosdaq') return v.toFixed(2);
  return Math.round(v).toLocaleString('en-US');
}

// 조건과 현재가를 비교해서 "막 임계값을 넘은 순간"만 골라낸다 (엣지 트리거).
// 조건이 계속 유지되는 동안엔 재발송하지 않고, 반대 방향으로 되돌아가면 다시 무장(arm)된다.
function computeTriggers(conditions, prices, prevState) {
  const triggers = [];
  const nextState = {};
  const now = Date.now();

  for (const key of Object.keys(ITEM_LABEL)) {
    const cond = conditions[key];
    const cur = prices[key];
    const prev = prevState[key] || {};
    const state = { upper: prev.upper || null, lower: prev.lower || null };

    if (cond && cur != null) {
      if (cond.upperEnabled && cond.upper != null && cur >= cond.upper) {
        const already = state.upper && state.upper.threshold === cond.upper;
        const tooSoon = state.upper && (now - state.upper.at) < MIN_RETRIGGER_MS;
        if (!already && !tooSoon) {
          triggers.push({ key, dir: 'upper', cur, threshold: cond.upper });
        }
        state.upper = { threshold: cond.upper, at: (already || tooSoon) ? state.upper.at : now };
      } else {
        state.upper = null;
      }

      if (cond.lowerEnabled && cond.lower != null && cur <= cond.lower) {
        const already = state.lower && state.lower.threshold === cond.lower;
        const tooSoon = state.lower && (now - state.lower.at) < MIN_RETRIGGER_MS;
        if (!already && !tooSoon) {
          triggers.push({ key, dir: 'lower', cur, threshold: cond.lower });
        }
        state.lower = { threshold: cond.lower, at: (already || tooSoon) ? state.lower.at : now };
      } else {
        state.lower = null;
      }
    }

    nextState[key] = state;
  }

  return { triggers, nextState };
}

async function runMarketAlertCheck({ dryRun = false } = {}) {
  const db = getFirestore();
  const alertsRef = db.collection('market-alerts');

  const [condSnap, tokensSnap, stateSnap, prices] = await Promise.all([
    alertsRef.doc('conditions').get(),
    alertsRef.doc('fcm-tokens').get(),
    alertsRef.doc('alert-state').get(),
    fetchAllPrices(),
  ]);

  const conditions = condSnap.exists ? condSnap.data() : {};
  const tokens = tokensSnap.exists ? (tokensSnap.data().tokens || []) : [];
  const prevState = stateSnap.exists ? stateSnap.data() : {};

  console.log(`marketAlertCheck: FCM 토큰 ${tokens.length}개 로드`);

  const { triggers, nextState } = computeTriggers(conditions, prices, prevState);

  if (!dryRun) {
    await alertsRef.doc('alert-state').set(nextState);
  }

  if (!triggers.length) {
    console.log('marketAlertCheck: 체크 완료 — 알림 0건 발송');
    return { sent: 0, tokens: tokens.length, triggers: [] };
  }

  console.log(`marketAlertCheck: 총 ${triggers.length}건 × ${tokens.length}기기 발송 예정${dryRun ? ' (dry-run, 실제 발송 안 함)' : ''}`);

  const title = triggers.length === 1
    ? `📈 ${ITEM_LABEL[triggers[0].key]} 알림`
    : `📈 시세 알림 ${triggers.length}건`;
  const body = triggers
    .map(t => `${ITEM_LABEL[t.key]} ${t.dir === 'upper' ? '▲' : '▼'} ${fmtValue(t.key, t.cur)} (기준 ${fmtValue(t.key, t.threshold)})`)
    .join('\n');

  let successCount = 0;
  let failureCount = 0;

  if (!dryRun && tokens.length) {
    // data-only 메시지로 보낸다: notification 필드를 넣으면 브라우저가 자체적으로
    // 한 번 자동 표시하고 onBackgroundMessage에서 또 한 번 표시해 알림이 중복되는
    // 문제가 있어서, 표시는 전적으로 서비스워커의 onBackgroundMessage가 직접
    // showNotification을 호출하도록 한다.
    const resp = await getMessaging().sendEachForMulticast({
      tokens,
      data: { title, body },
      webpush: { headers: { Urgency: 'high' } },
    });
    successCount = resp.successCount;
    failureCount = resp.failureCount;

    const deadTokens = [];
    resp.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token' || code === 'messaging/invalid-argument')) {
        deadTokens.push(tokens[i]);
      }
    });
    if (deadTokens.length) {
      const remaining = tokens.filter(t => !deadTokens.includes(t));
      await alertsRef.doc('fcm-tokens').set({ tokens: remaining, updatedAt: new Date().toISOString() });
      console.log(`marketAlertCheck: 무효 토큰 ${deadTokens.length}개 정리 (${tokens.length} → ${remaining.length})`);
    }
  }

  console.log(`marketAlertCheck: 체크 완료 — 알림 ${triggers.length}건 발송 (성공 ${successCount}/실패 ${failureCount})`);
  return { sent: triggers.length, tokens: tokens.length, successCount, failureCount, triggers };
}

exports.marketAlertCheck = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Seoul', region: REGION },
  async () => {
    await runMarketAlertCheck();
  }
);

// 수동 테스트용 — ?key=TEST_SECRET&dryRun=1 로 실제 발송 없이 트리거 판정만 확인 가능
exports.testMarketAlertCheck = onRequest({ region: REGION }, async (req, res) => {
  if (req.query.key !== TEST_SECRET.value()) {
    res.status(403).send('forbidden');
    return;
  }
  const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
  const result = await runMarketAlertCheck({ dryRun });
  res.json({ ok: true, dryRun, ...result });
});
