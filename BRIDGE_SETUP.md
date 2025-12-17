# 🌉 Firebase-Arduino ブリッジ セットアップガイド

このガイドでは、モバイルアプリからArduinoを制御するためのブリッジシステムのセットアップ方法を説明します。

## 📋 前提条件

- Node.js (v18以降)
- Arduino Mega 2560 がPCに接続されている
- Firebaseプロジェクト「potion-bar」が設定済み

## 🚀 セットアップ手順

### 1. サービスアカウントキーの取得

1. Firebase Console を開く（またはブラウザで既に開いています）
   ```
   https://console.firebase.google.com/project/potion-bar/settings/serviceaccounts/adminsdk
   ```

2. **「新しい秘密鍵の生成」** ボタンをクリック

3. ダウンロードされたJSONファイルを以下の場所に配置：
   ```bash
   /Users/yoshi/GitHub/loadcell_monitor/serviceAccountKey.json
   ```

### 2. 依存パッケージのインストール（完了済み✅）

```bash
cd /Users/yoshi/GitHub/loadcell_monitor
npm install
```

### 3. ArduinoをPCに接続

- Arduino Mega 2560 をUSBケーブルでPCに接続してください
- ロードセルとLEDパネルが正しく配線されていることを確認してください

## 🎮 使い方

### ブリッジの起動

ターミナルで以下のコマンドを実行：

```bash
cd /Users/yoshi/GitHub/loadcell_monitor
npm start
```

正常に起動すると以下のように表示されます：

```
═══════════════════════════════════════════
  🍹 Cocktail Maker Bridge 起動中...
═══════════════════════════════════════════

✅ Arduinoを検出: /dev/cu.usbmodem14201
🔌 Arduinoと接続しました
✨ Arduino準備完了

🔥 Firebaseをリッスン中...
📱 モバイルアプリから「調合開始」をタップしてください

終了するには Ctrl+C を押してください
───────────────────────────────────────────
```

### モバイルアプリから制御

1. **Expoアプリを起動**（学内WiFiでTunnelモードを使用）：
   ```bash
   cd cocktail-app
   npx expo start --tunnel
   ```

2. **ブリッジを起動**（別のターミナルで）：
   ```bash
   cd /Users/yoshi/GitHub/loadcell_monitor
   npm start
   ```

3. **モバイルアプリで「調合開始」をタップ**
   - アプリがFirebaseに `isBlending: true` を書き込み
   - ブリッジがこれを検出してArduinoに `1` を送信
   - Arduinoがシンデレラのレシピを開始

4. **調合が完了したら「調合完了」をタップ**

## 🔍 トラブルシューティング

### エラー: `serviceAccountKey.json が見つかりません`

→ サービスアカウントキーをダウンロードして、正しい場所に配置してください

### エラー: `Arduinoのシリアルポートが見つかりません`

→ Arduino が正しく接続されているか確認してください。また、Arduino IDEでシリアルモニタを閉じてください（ポートが占有されている可能性があります）

### Arduinoが反応しない

→ ブリッジのログで「Arduino準備完了」が表示されているか確認してください。表示されていない場合は、Arduinoを再接続してブリッジを再起動してください。

## 📡 システム構成

```
[モバイルアプリ]
     ↓ (WiFi)
[Firebase Realtime Database]
     ↓ (リアルタイムリスナー)
[Node.js Bridge (このPC)]
     ↓ (シリアル通信 USB)
[Arduino Mega 2560]
     ↓
[ロードセル + LEDパネル]
```

## ⚙️ 技術詳細

- **Firebase Admin SDK**: サーバー側からFirebaseにアクセス
- **SerialPort**: Node.jsからArduinoと通信
- **リアルタイムリスナー**: Firebaseの変更を即座に検知
- **自動ポート検出**: Arduinoのシリアルポートを自動で見つける

## 📝 ログの見方

- `📊 Firebase更新:` - Firebaseのデータが更新された
- `🍹 調合開始！` - 調合が開始された
- `📤 コマンド送信: 1` - Arduinoにレシピ番号1を送信
- `📟 Arduino:` - Arduinoからのメッセージ

---

セットアップでお困りの際は、このドキュメントを参照してください！
