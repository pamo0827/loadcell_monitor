import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase Console (https://console.firebase.google.com/) から取得した設定
const firebaseConfig = {
  apiKey: "AIzaSyCia3QM4bJYRuBDw_14xNXv566ZflTPeFc",
  authDomain: "potion-bar.firebaseapp.com",
  databaseURL: "https://potion-bar-default-rtdb.firebaseio.com",
  projectId: "potion-bar",
  storageBucket: "potion-bar.firebasestorage.app",
  messagingSenderId: "47181775078",
  appId: "1:47181775078:web:01da0745bd995ffcf5bb27"
};

// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);

// Realtime Databaseのインスタンスを取得
const database = getDatabase(app);

export { database };
