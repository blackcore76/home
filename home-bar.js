(function () {
  /* ── BlackCore 홈 네비게이션 바 ──
     어느 페이지에나 <script src="home-bar.js"></script> 한 줄로 삽입됩니다.
  ─────────────────────────────── */
  var INDEX_URL = 'index.html';   // 인덱스 경로 (GitHub Pages 루트 기준)

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
    #bc-home-bar .bc-right {
      margin-left: auto;
      color: #2a3a50;
      font-size: 10px;
      letter-spacing: 0.1em;
      flex-shrink: 0;
    }
    /* 바 높이만큼 body 상단 여백 추가 (기존 레이아웃 밀리지 않게) */
    body { padding-top: 36px !important; }
    /* sticky 헤더가 있는 앱은 top 값 보정 */
    .hd[style*="sticky"], header[style*="sticky"],
    .hd, header {
      top: 36px !important;
    }
  `;

  // 현재 파일명으로 페이지 이름 자동 감지
  var FILE_LABELS = {
    'market-dashboard.html': '📊 마켓 대시보드',
    'daily-pick.html':       '📈 일일 주식 픽',
    'stocklens.html':        '💼 StockLens',
    'blood-pressure.html':   '❤️ 혈압 기록부',
    'blood-glucose.html':    '🩸 혈당 기록부',
    'lotto.html':            '🎰 로또 픽커',
  };

  var filename = location.pathname.split('/').pop() || 'index.html';
  var pageLabel = FILE_LABELS[filename] || document.title || filename;

  // 인덱스 페이지면 바 삽입 안 함
  if (filename === 'index.html' || filename === '') return;

  function inject() {
    // 스타일 주입
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // 바 DOM 생성
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
      '<span class="bc-right">⌂ HOME</span>';

    document.body.insertBefore(bar, document.body.firstChild);
  }

  // DOM 준비 여부에 따라 즉시 또는 DOMContentLoaded 후 삽입
  if (document.body) {
    inject();
  } else {
    document.addEventListener('DOMContentLoaded', inject);
  }
})();
