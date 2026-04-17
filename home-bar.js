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
  `;

  var FILE_LABELS = {
    'market-aibriefing.html': '🤖 AI 마켓브리핑',
    'market-dashboard.html':  '📊 마켓 대시보드',
    'dashboard.html':         '🪟 4분할 차트보기',
    'daily-pick.html':        '📈 일일 주식 픽',
    'stocklens.html':         '💼 StockLens',
    'daily-feed.html':        '📝 데일리 피드',
    'blood-pressure.html':    '❤️ 혈압 기록부',
    'lotto.html':             '🎰 로또 픽커',
    'bookmarks.html':         '🌐 즐겨찾기',
  };

  var filename = location.pathname.split('/').pop() || 'index.html';
  var pageLabel = FILE_LABELS[filename] || document.title || filename;

  if (filename === 'index.html' || filename === '') return;

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
        '<a href="' + INDEX_URL + '" class="bc-home-btn">⌂ HOME</a>' +
      '</div>';

    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
