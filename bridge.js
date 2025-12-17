import admin from 'firebase-admin';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase Admin SDK初期化
const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ エラー: serviceAccountKey.json が見つかりません');
  console.error('Firebase Consoleからサービスアカウントキーをダウンロードして、');
  console.error('プロジェクトのルートディレクトリに配置してください。');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://potion-bar-default-rtdb.firebaseio.com'
});

const db = admin.database();
const statusRef = db.ref('cocktail/status');

// シリアルポート設定
let port = null;
let parser = null;
let isArduinoReady = false;

// Arduinoのシリアルポートを自動検出
async function findArduinoPort() {
  const ports = await SerialPort.list();

  // Arduino Megaを探す（製造元やシリアル番号で判定）
  const arduinoPort = ports.find(p =>
    p.manufacturer?.includes('Arduino') ||
    p.manufacturer?.includes('wch.cn') ||
    p.vendorId === '2341' || // Arduino公式のVendor ID
    p.vendorId === '1a86'    // CH340チップのVendor ID
  );

  if (arduinoPort) {
    console.log(`✅ Arduinoを検出: ${arduinoPort.path}`);
    return arduinoPort.path;
  }

  // 見つからない場合は全ポートを表示
  console.log('⚠️  Arduinoが自動検出できませんでした。利用可能なポート:');
  ports.forEach(p => {
    console.log(`  - ${p.path} (${p.manufacturer || 'Unknown'})`);
  });

  // macOSの場合、通常/dev/cu.usbmodem*または/dev/cu.usbserial*
  const defaultPort = ports.find(p => p.path.includes('usbmodem') || p.path.includes('usbserial'));
  if (defaultPort) {
    console.log(`📍 デフォルトポートを使用: ${defaultPort.path}`);
    return defaultPort.path;
  }

  throw new Error('Arduinoのシリアルポートが見つかりません');
}

// Arduinoとの接続を確立
async function connectToArduino() {
  try {
    const portPath = await findArduinoPort();

    port = new SerialPort({
      path: portPath,
      baudRate: 9600
    });

    parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('open', () => {
      console.log('🔌 Arduinoと接続しました');
      // Arduino起動後、準備完了まで少し待つ
      setTimeout(() => {
        isArduinoReady = true;
        console.log('✨ Arduino準備完了');
      }, 2000);
    });

    // Arduinoからのメッセージを表示と状態更新
    parser.on('data', (data) => {
      console.log(`📟 Arduino: ${data}`);

      // "Ready."メッセージを受信したら準備完了
      if (data.includes('Ready')) {
        isArduinoReady = true;
        console.log('✅ Arduino初期化完了');
      }

      // 風袋引き完了を検知
      if (data.includes('Tare Complete')) {
        console.log('⚖️ 風袋引き完了');
        db.ref('cocktail/status').update({
          isTaring: false,
          currentStep: 1
        });
      }

      // ステップ完了を検知
      if (data.includes('Step OK')) {
        console.log('✅ ステップ完了');
        // 現在のステップ番号を取得して更新
        db.ref('cocktail/status').once('value', (snapshot) => {
          const currentData = snapshot.val();
          const nextStep = (currentData?.currentStep || 1) + 1;
          db.ref('cocktail/status').update({
            currentStep: nextStep
          });
        });
      }

      // レシピ完了と得点計算
      if (data.startsWith('RECIPE_COMPLETE:')) {
        const totalWeight = parseFloat(data.split(':')[1]);
        console.log(`🎉 レシピ完了！合計: ${totalWeight}ml`);

        // 得点計算: 90mlが満点(100点)、1mlずれるごとに5点引く
        const perfectWeight = 90.0;
        const difference = Math.abs(totalWeight - perfectWeight);
        const score = Math.max(0, 100 - Math.round(difference * 5));

        console.log(`📊 得点: ${score}点 (誤差: ${difference.toFixed(1)}ml)`);

        // Firebaseに結果を書き込む
        db.ref('cocktail/status').update({
          isBlending: false,
          isTaring: false,
          currentStep: 0,
          totalWeight: totalWeight,
          score: score,
          completed: true,
          timestamp: Date.now()
        });
      }

      // 音声再生コマンドを検知
      if (data.includes('SOUND:STEP_COMPLETE')) {
        console.log('🎉 ステップ完了！アプリで地震魔法音を再生');
        db.ref('cocktail/sound').set({
          type: 'STEP_COMPLETE',
          repeat: 1,
          timestamp: Date.now()
        });
      }

      if (data.includes('SOUND:SPARKLE')) {
        console.log('✨ 90ml達成！アプリできらきら音を再生');
        db.ref('cocktail/sound').set({
          type: 'SPARKLE',
          repeat: 1,
          timestamp: Date.now()
        });
      }

      if (data.includes('SOUND:EXPLOSION')) {
        console.log('💥 超過警告！アプリで爆発音を再生');
        db.ref('cocktail/sound').set({
          type: 'EXPLOSION',
          repeat: 3,
          timestamp: Date.now()
        });
      }
    });

    port.on('error', (err) => {
      console.error('❌ シリアルポートエラー:', err.message);
    });

  } catch (error) {
    console.error('❌ Arduino接続エラー:', error.message);
    process.exit(1);
  }
}

// Arduinoにコマンドを送信
function sendCommandToArduino(command) {
  if (!isArduinoReady) {
    console.log('⏳ Arduinoの準備中... コマンドを保留します');
    setTimeout(() => sendCommandToArduino(command), 1000);
    return;
  }

  if (port && port.isOpen) {
    port.write(command + '\n', (err) => {
      if (err) {
        console.error('❌ コマンド送信エラー:', err.message);
      } else {
        console.log(`📤 コマンド送信: ${command}`);
      }
    });
  } else {
    console.error('❌ シリアルポートが開いていません');
  }
}

// Firebaseの変更を監視
let lastBlendingState = false;

statusRef.on('value', (snapshot) => {
  const data = snapshot.val();

  if (!data) {
    console.log('📊 Firebase: データなし');
    return;
  }

  console.log('📊 Firebase更新:', data);

  // 調合開始の検出
  if (data.isBlending && !lastBlendingState) {
    console.log('🍹 調合開始！シンデレラレシピを起動します');
    sendCommandToArduino('1'); // レシピ番号1（シンデレラ）を送信
  }

  lastBlendingState = data.isBlending;
});

// メイン処理
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🍹 Cocktail Maker Bridge 起動中...');
  console.log('═══════════════════════════════════════════');
  console.log('');

  await connectToArduino();

  console.log('');
  console.log('🔥 Firebaseをリッスン中...');
  console.log('📱 モバイルアプリから「調合開始」をタップしてください');
  console.log('');
  console.log('終了するには Ctrl+C を押してください');
  console.log('───────────────────────────────────────────');
}

// Ctrl+Cでの終了処理
process.on('SIGINT', () => {
  console.log('\n\n🛑 ブリッジを終了します...');

  if (port && port.isOpen) {
    port.close((err) => {
      if (err) console.error('エラー:', err);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

main().catch(console.error);
