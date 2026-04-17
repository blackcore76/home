// auth.js — Firebase Google 로그인 공통 모듈
(function () {
  const GOOGLE_PROVIDER = new firebase.auth.GoogleAuthProvider();
  
  // daily-feed2.html 체크 (오버레이 제외할 페이지 목록)
  const NO_OVERLAY_PAGES = ['daily-feed2.html', 'daily-feed.html'];
  const isNoOverlayPage = NO_OVERLAY_PAGES.some(page => window.location.pathname.includes(page));

  // 로그인 오버레이 생성
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:99999;
      background:rgba(0,0,0,0.92);
      display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      font-family:'JetBrains Mono', monospace;
    `;
    overlay.innerHTML = `
      <div style="color:#fff;font-size:1.1rem;margin-bottom:2rem;letter-spacing:0.05em;">
        🔐 BlackCore Dashboard
      </div>
      <button id="google-login-btn" style="
        background:#fff; color:#222; border:none;
        padding:0.8rem 2rem; border-radius:8px;
        font-size:1rem; cursor:pointer; font-weight:600;
        display:flex; align-items:center; gap:0.6rem;
      ">
        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
             width="20" height="20"/>
        Google 계정으로 로그인
      </button>
      <div id="auth-error" style="color:#ff6b6b;margin-top:1rem;font-size:0.85rem;"></div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('google-login-btn').onclick = () => {
      firebase.auth().signInWithPopup(GOOGLE_PROVIDER).catch(e => {
        document.getElementById('auth-error').textContent = '로그인 실패: ' + e.message;
      });
    };
  }

  // 로그아웃 버튼 생성
  function createLogoutBtn(user) {
    if (document.getElementById('auth-logout-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'auth-logout-btn';
    btn.title = user.email;
    btn.textContent = '로그아웃';
    btn.onclick = () => firebase.auth().signOut();

    const rightGroup = document.getElementById('bc-right-group');
    if (rightGroup) {
      rightGroup.insertBefore(btn, rightGroup.firstChild);
    } else {
      btn.style.cssText = `
        position:fixed; top:6px; right:12px; z-index:9999;
        background:rgba(255,255,255,0.08); color:#aaa;
        border:1px solid rgba(255,255,255,0.15);
        padding:4px 10px; border-radius:6px;
        font-size:0.75rem; cursor:pointer;
        font-family:'JetBrains Mono', monospace;
      `;
      document.body.appendChild(btn);
    }
  }

  // 인증 상태 감시
  firebase.auth().onAuthStateChanged(user => {
    const overlay = document.getElementById('auth-overlay');
    
    if (user) {
      // 로그인됨
      if (overlay) overlay.remove();
      createLogoutBtn(user);
      console.log('[Auth] 로그인 완료:', user.email);
    } else {
      // 로그아웃됨
      const logoutBtn = document.getElementById('auth-logout-btn');
      if (logoutBtn) logoutBtn.remove();
      
      // 제외 페이지에서는 오버레이를 띄우지 않음
      if (isNoOverlayPage) {
        console.log('[Auth] 제외 페이지 - 오버레이 생략');
        return;
      }
      
      // 나머지 페이지에서만 오버레이 생성
      if (!overlay) createOverlay();
    }
  });
})();
