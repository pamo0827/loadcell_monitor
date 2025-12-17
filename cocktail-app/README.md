# カクテルメーカー モバイルアプリ

シンデレラ調合システム用のReact Native（Expo）アプリです。

## 機能

- **調合開始**: カクテルの調合を開始します
- **調合完了**: カクテルの調合を完了します
- Firebase Realtime Databaseを使用してArduinoと通信

## セットアップ手順

### 1. Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. 新しいプロジェクトを作成
3. Realtime Databaseを有効化
4. プロジェクト設定から、Webアプリの構成情報を取得

### 2. Firebase設定ファイルの更新

`firebaseConfig.js` を開いて、Firebaseプロジェクトの設定情報を入力してください：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL", // 重要！
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. アプリの起動

```bash
# 依存関係をインストール（既にインストール済みの場合はスキップ）
npm install

# Expo Goアプリを起動
npm start
```

### 4. Expo Goアプリで実行

1. スマートフォンに [Expo Go](https://expo.dev/client) アプリをインストール
2. ターミナルに表示されたQRコードをスキャン
3. アプリが起動します

## 使い方

1. **調合開始**ボタンをタップして、シンデレラの調合を開始します
2. Arduino側でLEDが光り始め、調合プロセスが開始されます
3. 調合が完了したら、**調合完了**ボタンをタップします

## Firebase Realtime Database構造

```json
{
  "cocktail": {
    "status": {
      "isBlending": true,
      "timestamp": 1234567890
    }
  }
}
```

## トラブルシューティング

### Firebaseに接続できない

- `firebaseConfig.js` の設定が正しいか確認してください
- Firebase ConsoleでRealtime Databaseが有効になっているか確認してください
- Realtime Databaseのルールを確認してください（開発中は読み書き許可に設定）

### アプリが起動しない

```bash
# キャッシュをクリアして再起動
npm start -- --clear
```

## 今後の拡張案

- リアルタイムで重量を表示
- LEDの色をアプリから確認
- 複数のレシピを選択できるように
- 調合履歴の記録

---

開発: カクテルメーカープロジェクト
