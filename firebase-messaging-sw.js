// Firebase Messaging Service Worker
// GitHub Pages: /home/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCIQKMbhnQY2sIdDthFrm-dznnVMs5pb30",
  authDomain: "my-bp-tracker-3d595.firebaseapp.com",
  projectId: "my-bp-tracker-3d595",
  storageBucket: "my-bp-tracker-3d595.firebasestorage.app",
  messagingSenderId: "1016360206319",
  appId: "1:1016360206319:web:5f5df2e2c45b30694a401a"
});

const messaging = firebase.messaging();

// 백그라운드 메시지 수신
// data-only 페이로드만 사용한다: notification 필드가 있으면 브라우저가 자동으로
// 한 번 표시하고 여기서 showNotification을 또 호출해 알림이 중복 표시되는
// 문제가 있었음 (Cloud Function 쪽도 data-only로 맞춰서 발송함).
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.data || {};
  if (!title) return;
  self.registration.showNotification(title, {
    body,
    icon: '/home/icon-192.png',
    badge: '/home/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'market-alert',
    renotify: true,
  });
});
