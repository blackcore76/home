(function () {

  /* ── BlackCore 홈 네비게이션 바 ──
     어느 페이지에나 <script src="home-bar.js"></script> 한 줄로 삽입됩니다.
  ─────────────────────────────── */

  var INDEX_URL = 'index.html';

  var css = `
    #bc-home-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 99999;
      height: 36px;
      background: rgba(10, 13, 20, 0.88);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1px solid rgba(99, 155, 255, 0.13);
      display: flex;
      align-items: center;
      padding: 0 14px;
      gap: 10px;
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 11px;
      letter-spacing: 0.05em;
      user-select: none;
      -webkit-user-select: none;
    }
    #bc-home-bar a {
      color: #a8b8d0;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 7px;
      transition: color 0.2s;
      white-space: nowrap;
    }
    #bc-home-bar a:hover { color: #3d8bff; }
    #bc-home-bar .bc-logo-dot {
      width: 6px; height: 6px;
      background: #3d8bff;
      border-radius: 50%;
      box-shadow: 0 0 7px #3d8bff;
      flex-shrink: 0;
    }
    #bc-home-bar .bc-home-label { color: #3d8bff; font-weight: 700; }
    #bc-home-bar .bc-sep {
      color: rgba(99, 155, 255, 0.25);
      font-size: 13px;
    }
    #bc-home-bar .bc-cur {
      color: #4a607a;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* 우측 버튼 그룹 */
    #bc-home-bar .bc-right-group {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    /* ⏰ 시간대 표시 박스 (ET / KST) */
    #bc-home-bar .bc-time-box {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      letter-spacing: 0.05em;
      background: rgba(255, 159, 64, 0.06);
      border: 1px solid rgba(255, 159, 64, 0.28);
      border-radius: 5px;
      padding: 2px 8px;
      white-space: nowrap;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.2s;
    }
    #bc-home-bar .bc-time-box:hover {
      background: rgba(255, 159, 64, 0.12);
      border-color: rgba(255, 159, 64, 0.5);
    }
    #bc-home-bar .bc-time-label {
      color: #ff9f40;
      font-weight: 700;
    }
    #bc-home-bar .bc-time-sep {
      color: rgba(255, 159, 64, 0.4);
    }
    #bc-home-bar .bc-time-value {
      color: #ffb870;
    }
    /* HOME 링크 버튼 */
    #bc-home-bar .bc-home-btn {
      color: #4a607a !important;
      font-size: 10px;
      letter-spacing: 0.1em;
      background: transparent;
      border: 1px solid rgba(99,155,255,0.15);
      border-radius: 5px;
      padding: 2px 8px;
      cursor: pointer;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    }
    #bc-home-bar .bc-home-btn:hover {
      color: #3d8bff !important;
      border-color: rgba(61,139,255,0.4);
      background: rgba(61,139,255,0.08);
    }
    /* 로그아웃 버튼 — 홈바 안으로 통합 */
    #auth-logout-btn {
      position: static !important;
      background: rgba(255,255,255,0.06) !important;
      color: #6a8099 !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      padding: 2px 8px !important;
      border-radius: 5px !important;
      font-size: 10px !important;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.05em;
      transition: all 0.2s;
      white-space: nowrap;
    }
    #auth-logout-btn:hover {
      color: #ff6b6b !important;
      border-color: rgba(255,107,107,0.4) !important;
      background: rgba(255,107,107,0.08) !important;
    }
    /* 바 높이만큼 body 상단 여백 추가 */
    body { padding-top: 36px !important; }
    header {
      top: 36px !important;
    }
    /* 모바일 화면에서 시간 박스 숨김 (선택사항) */
    @media (max-width: 640px) {
      #bc-home-bar .bc-time-box { display: none; }
    }

    /* ── 사이드 독 네비게이션 (맥 독 스타일) ── */
    #bc-side-dock {
      position: fixed;
      left: 0;
      bottom: 20vh;
      z-index: 99997;
      display: flex;
      align-items: flex-end;
    }
    #bc-dock-handle {
      width: 14px;
      height: 100px;
      background: rgba(10, 13, 20, 0.82);
      border: 1px solid rgba(99, 155, 255, 0.18);
      border-left: none;
      border-radius: 0 8px 8px 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: background 0.2s, opacity 0.2s;
    }
    #bc-dock-handle:hover { background: rgba(61, 139, 255, 0.18); }
    #bc-dock-handle .bc-dock-grip {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    #bc-dock-handle .bc-dock-grip span {
      width: 3px; height: 3px;
      border-radius: 50%;
      background: #5d7ba3;
    }
    #bc-dock-panel {
      max-height: calc(80vh - 16px);
      overflow-y: auto;
      width: 0;
      opacity: 0;
      background: rgba(10, 13, 20, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(99, 155, 255, 0.16);
      border-left: none;
      border-radius: 0 10px 10px 0;
      box-shadow: 6px 0 24px rgba(0, 0, 0, 0.35);
      transition: width 0.28s ease, opacity 0.2s ease;
      pointer-events: none;
    }
    #bc-side-dock.open #bc-dock-panel {
      width: 190px;
      opacity: 1;
      pointer-events: auto;
    }
    #bc-side-dock.open #bc-dock-handle {
      opacity: 0;
      pointer-events: none;
    }
    #bc-dock-panel::-webkit-scrollbar { width: 5px; }
    #bc-dock-panel::-webkit-scrollbar-thumb {
      background: rgba(99, 155, 255, 0.25);
      border-radius: 3px;
    }
    .bc-dock-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      text-decoration: none;
      color: #a8b8d0;
      font-size: 11px;
      letter-spacing: 0.02em;
      white-space: nowrap;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: background 0.15s, color 0.15s;
    }
    .bc-dock-item:last-child { border-bottom: none; }
    .bc-dock-item:hover { background: rgba(61, 139, 255, 0.1); color: #3d8bff; }
    .bc-dock-item.active {
      color: #3d8bff;
      background: rgba(61, 139, 255, 0.08);
      font-weight: 700;
    }
    .bc-dock-item .bc-dock-num {
      font-size: 9px;
      color: #4a607a;
      width: 14px;
      flex-shrink: 0;
    }
    .bc-dock-item .bc-dock-icon { font-size: 14px; flex-shrink: 0; }
    @media (max-width: 640px) {
      #bc-side-dock { bottom: calc(8vh + env(safe-area-inset-bottom, 0px)); }
      #bc-dock-handle { height: 84px; }
      #bc-side-dock.open #bc-dock-panel { width: 172px; }
    }
  `;

  var NAV_ITEMS = [
    { href: 'market-scanner.html',    icon: '🔍', label: 'AI 마켓스캐너' },
    { href: 'market-aibriefing.html', icon: '🤖', label: 'AI 차트분석기' },
    { href: 'market-picker.html',     icon: '📈', label: '관심 주식픽' },
    { href: 'market-virtual.html',    icon: '🎯', label: '모의투자' },
    { href: 'market-dashboard.html',  icon: '📊', label: '마켓 대시보드' },
    { href: 'dashboard.html',         icon: '🪟', label: '4분할 차트보기' },
    { href: 'stocklens.html',         icon: '💼', label: 'StockLens' },
    { href: 'stocktoss.html',         icon: '📱', label: 'StockToss' },
    { href: 'daily-feed.html',        icon: '📝', label: '데일리 피드' },
    { href: 'lotto.html',             icon: '🎰', label: '로또 6/45' },
    { href: 'bookmarks.html',         icon: '🌐', label: '북마크' },
    { href: 'news.html',              icon: '📰', label: '금융뉴스' },
    { href: 'blood_fb_auth.html',     icon: '❤️', label: '혈압 기록부' },
    { href: 'cpap.html',              icon: '😴', label: '양압기 보고서' }
  ];

  var FILE_LABELS = {
    'market-scanner.html':    '🔍 AI 마켓 스캐너',
    'market-aibriefing.html': '🤖 AI 차트 분석',
    'market-dashboard.html':  '📊 마켓 대시보드',
    'market-picker.html':     '📈 관심 주식 픽',
    'stocklens.html':         '💼 StockLens',
    'stocktoss.html':         '📱 StockToss',
    'daily-feed.html':        '📝 데일리 피드',
    'blood_fb_auth.html':     '❤️ 혈압 기록부',
    'lotto.html':             '🎰 로또 6/45',
    'bookmarks.html':         '🌐 즐겨찾기',
    'cpap.html':              '😴 양압기 보고서',
  };

  var filename = location.pathname.split('/').pop() || 'index.html';
  var pageLabel = FILE_LABELS[filename] || document.title || filename;

  if (filename === 'index.html' || filename === '') return;

  // ⏰ 특정 시간대 시간 포맷팅 (예: "5월 7일 AM 09:00")
  function formatTime(timeZone) {
    var now = new Date();
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(now);
    var p = {};
    parts.forEach(function (part) { p[part.type] = part.value; });
    return p.month + '월 ' + p.day + '일 ' + p.dayPeriod + ' ' + p.hour + ':' + p.minute;
  }

  // 시간 갱신 함수
  function updateTimes() {
    var et = document.getElementById('bc-time-et');
    var kst = document.getElementById('bc-time-kst');
    if (et)  et.textContent  = formatTime('America/New_York');
    if (kst) kst.textContent = formatTime('Asia/Seoul');
  }

  function inject() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'bc-home-bar';
    bar.innerHTML =
      '<a href="' + INDEX_URL + '">' +
        '<div class="bc-logo-dot"></div>' +
        '<span class="bc-home-label">BlackCore</span>' +
        '<span style="color:#2a3a50;font-size:10px;">\'s Personal Web</span>' +
      '</a>' +
      '<span class="bc-sep">›</span>' +
      '<span class="bc-cur">' + pageLabel + '</span>' +
      '<div class="bc-right-group" id="bc-right-group">' +
        '<div class="bc-time-box" title="미국 동부시간">' +
          '<span class="bc-time-label">ET</span>' +
          '<span class="bc-time-sep">·</span>' +
          '<span class="bc-time-value" id="bc-time-et">--</span>' +
        '</div>' +
        '<div class="bc-time-box" title="한국 표준시">' +
          '<span class="bc-time-label">KST</span>' +
          '<span class="bc-time-sep">·</span>' +
          '<span class="bc-time-value" id="bc-time-kst">--</span>' +
        '</div>' +
        '<a href="' + INDEX_URL + '" class="bc-home-btn">⌂ HOME</a>' +
      '</div>';

    document.body.insertBefore(bar, document.body.firstChild);

    // 시간 즉시 표시 + 1초마다 갱신
    updateTimes();
    setInterval(updateTimes, 1000);

    buildDock();
  }

  // ── 사이드 독 네비게이션: 평소엔 숨김, 호버(PC)/터치(모바일)로 오버랩 ──
  function buildDock() {
    var dock = document.createElement('div');
    dock.id = 'bc-side-dock';

    var handle = document.createElement('div');
    handle.id = 'bc-dock-handle';
    handle.innerHTML = '<div class="bc-dock-grip"><span></span><span></span><span></span><span></span></div>';

    var panel = document.createElement('div');
    panel.id = 'bc-dock-panel';

    var itemsHtml = '';
    NAV_ITEMS.forEach(function (item, i) {
      var num = (i + 1 < 10 ? '0' : '') + (i + 1);
      var isActive = item.href === filename;
      itemsHtml +=
        '<a class="bc-dock-item' + (isActive ? ' active' : '') + '" href="' + item.href + '">' +
          '<span class="bc-dock-num">' + num + '</span>' +
          '<span class="bc-dock-icon">' + item.icon + '</span>' +
          '<span>' + item.label + '</span>' +
        '</a>';
    });
    panel.innerHTML = itemsHtml;

    dock.appendChild(handle);
    dock.appendChild(panel);
    document.body.appendChild(dock);

    var isTouch = window.matchMedia('(hover: none)').matches;

    if (isTouch) {
      handle.addEventListener('click', function (e) {
        e.stopPropagation();
        dock.classList.toggle('open');
      });
      document.addEventListener('click', function (e) {
        if (!dock.contains(e.target)) dock.classList.remove('open');
      });
    } else {
      dock.addEventListener('mouseenter', function () { dock.classList.add('open'); });
      dock.addEventListener('mouseleave', function () { dock.classList.remove('open'); });
    }
  }

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }

})();