#include <HX711_ADC.h>
#include <Adafruit_NeoPixel.h>

// ピン設定
const int HX711_dout = 53;
const int HX711_sck = 51;
const int LED_PIN = A0;
const int BUZZER_PIN = 12; // 追加: ブザー用ピン
const int NUMPIXELS = 16;

HX711_ADC LoadCell(HX711_dout, HX711_sck);
Adafruit_NeoPixel pixels(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

// 状態管理
enum SystemState { IDLE, TARE_WAIT, POURING, STEP_COMPLETED, RECIPE_FINISHED };
SystemState currentState = IDLE;

// レシピ構造体
struct Ingredient {
  String name;
  float targetWeight; // g (ml)
  uint32_t color;     // LEDの色 (RGB)
};

struct Recipe {
  String name;
  int stepCount;
  Ingredient steps[5]; // 最大5ステップと仮定
  bool isSpecialCinderella; // シンデレラ特別演出モード
};

// レシピデータ定義 (recipe.mdより)
// 色定義: 0xRRGGBB
const uint32_t COL_ORANGE = 0xFF4500; // オレンジレッド
const uint32_t COL_PINE   = 0xFFFF00; // 黄色
const uint32_t COL_LEMON  = 0xCCFF00; // レモン色
const uint32_t COL_GINGER = 0xCD853F; // 茶色っぽいゴールド
const uint32_t COL_SODA   = 0xE0FFFF; // 薄い水色

Recipe recipes[3] = {
  {
    "Cinderella (Standard)", 3,
    {
      {"Orange Juice", 40.0, COL_ORANGE},
      {"Pineapple Juice", 40.0, COL_PINE},
      {"Lemon Juice", 10.0, COL_LEMON}
    },
    true // シンデレラ特別演出モード有効
  },
  {
    "Sunrise Style", 3,
    {
      {"Orange Juice", 80.0, COL_ORANGE},
      {"Pineapple Juice", 15.0, COL_PINE},
      {"Ginger Syrup", 8.0, COL_GINGER}
    },
    false // 通常モード
  },
  {
    "Tropical Punch", 5,
    {
      {"Orange Juice", 40.0, COL_ORANGE},
      {"Pineapple Juice", 40.0, COL_PINE},
      {"Lemon Juice", 10.0, COL_LEMON},
      {"Ginger Syrup", 5.0, COL_GINGER},
      {"Ginger Ale", 90.0, COL_SODA}
    },
    false // 通常モード
  }
};

int currentRecipeIndex = -1;
int currentStepIndex = 0;
float startWeight = 0; // 各ステップ開始時の重量
float cumulativeWeight = 0; // シンデレラ特別演出用の累積重量

void setup() {
  Serial.begin(9600);
  pinMode(BUZZER_PIN, OUTPUT);
  
  pixels.begin();
  pixels.clear();
  pixels.show();

  Serial.println("=== Smart Cocktail Maker Initializing ===");
  LoadCell.begin();
  LoadCell.start(2000, true);
  LoadCell.setCalFactor(-434.0);
  
  Serial.println("Ready.");
  printMenu();
}

void printMenu() {
  Serial.println("\n--- Select Menu ---");
  Serial.println("1: Cinderella");
  Serial.println("2: Sunrise Style");
  Serial.println("3: Tropical Punch");
  Serial.println("Type number to start.");
}

// 音響エフェクト関数群

// ヘルパー: 指定周波数と長さで再生
void playTone(int freq, int duration) {
  tone(BUZZER_PIN, freq, duration);
  delay(duration);
  noTone(BUZZER_PIN);
}

// 1. 微量注入時: 魔法の雫音 (ポチャン + キラッ)
void playMagicDroplet() {
  // 急速なアルペジオで「ピロリ」感を出す
  tone(BUZZER_PIN, 1200, 30); delay(35);
  tone(BUZZER_PIN, 2000, 30); delay(35);
  noTone(BUZZER_PIN);
}

// 2. ステップ完了時: 調合・融合音 (シュワワワ〜ン)
void playMixComplete() {
  // 周波数をスイープさせて「吸い込まれる/混ざる」ような音
  for (int i = 400; i <= 2000; i += 80) {
    tone(BUZZER_PIN, i, 15);
    delay(10); // スイープ速度
  }
  // 最後にキラリン
  tone(BUZZER_PIN, 2500, 200);
  delay(200);
  noTone(BUZZER_PIN);
}

// 3. レシピ完成時: 魔法の大成功ファンファーレ
void playPotionSuccess() {
  // タラララ・タラララ・ターン！
  int melody[] = {1000, 1200, 1500, 2000, 0, 1000, 1200, 1500, 2400};
  int noteDurations[] = {100, 100, 100, 300, 100, 100, 100, 100, 600};

  for (int i = 0; i < 9; i++) {
    if (melody[i] == 0) {
      delay(noteDurations[i]);
    } else {
      tone(BUZZER_PIN, melody[i], noteDurations[i]);
      delay(noteDurations[i] * 1.3);
    }
  }
  noTone(BUZZER_PIN);
}

// ユーティリティ: HSVからRGBへの変換 (滑らかな色変化のため)
uint32_t wheel(byte WheelPos) {
  WheelPos = 255 - WheelPos;
  if (WheelPos < 85) {
    return pixels.Color(255 - WheelPos * 3, 0, WheelPos * 3);
  }
  if (WheelPos < 170) {
    WheelPos -= 85;
    return pixels.Color(0, WheelPos * 3, 255 - WheelPos * 3);
  }
  WheelPos -= 170;
  return pixels.Color(WheelPos * 3, 255 - WheelPos * 3, 0);
}

// 暖色系グラデーション生成関数
// heat: 0.0 (冷たい/暗い) 〜 1.0 (熱い/明るい)
// t: 時間変数 (アニメーション用)
uint32_t getWarmColor(float heat, int pixelIndex, unsigned long t) {
  // 暖色パレット: 赤 -> オレンジ -> 黄 -> 白
  // 赤(0, 255, 0) ※GRB順注意 -> 緑(255, 255, 0) ※GRB
  // Adafruit_NeoPixelは RGB ではなく GRB の順でデータを受け取ることがあるが
  // Color(r, g, b) メソッドは RGB で指定する。
  
  // ベースの色相を計算 (赤〜黄色〜白)
  // heat 0.0 -> 赤 (255, 0, 0)
  // heat 0.5 -> オレンジ (255, 100, 0)
  // heat 0.8 -> 黄 (255, 200, 0)
  // heat 1.0 -> 白 (255, 255, 255)

  int r = 255;
  int g = (int)(heat * 200); // 緑成分を足すと黄色になる
  int b = (heat > 0.8) ? (int)((heat - 0.8) * 5 * 255) : 0; // 最後の方で青を足して白にする

  // ゆらぎを加える (正弦波)
  float wave = sin((t / 300.0) + (pixelIndex * 0.5)); // -1 ~ 1
  
  // 明るさのゆらぎ
  int brightness = 150 + (int)(wave * 100); // 50 ~ 250
  
  // 色ごとの微調整
  r = (r * brightness) / 255;
  g = (g * brightness) / 255;
  b = (b * brightness) / 255;

  return pixels.Color(r, g, b);
}


// シンデレラ専用の演出関数
void updateCinderellaVisuals(float totalWeight) {
  pixels.clear();

  unsigned long t = millis();

  if (totalWeight < 40.0) {
    // 0-40ml: 黄色に徐々に光らせる
    float brightness = (totalWeight / 40.0); // 0.0 -> 1.0
    int numLeds = (int)(brightness * NUMPIXELS);

    for (int i = 0; i < NUMPIXELS; i++) {
      if (i < numLeds) {
        // 黄色 (R=255, G=255, B=0)
        int r = 255;
        int g = 255;
        int b = 0;
        pixels.setPixelColor(i, pixels.Color(r, g, b));
      }
    }
  }
  else if (totalWeight >= 40.0 && totalWeight < 50.0) {
    // 40ml: オレンジ色
    for (int i = 0; i < NUMPIXELS; i++) {
      pixels.setPixelColor(i, pixels.Color(255, 140, 0)); // オレンジ
    }
  }
  else if (totalWeight >= 50.0 && totalWeight < 80.0) {
    // 50-80ml: 赤く光らせて、徐々に光を弱める
    float fadeProgress = (totalWeight - 50.0) / 30.0; // 0.0 -> 1.0
    int brightness = 255 - (int)(fadeProgress * 200); // 255 -> 55
    brightness = constrain(brightness, 55, 255);

    for (int i = 0; i < NUMPIXELS; i++) {
      pixels.setPixelColor(i, pixels.Color(brightness, 0, 0)); // 赤
    }
  }
  else if (totalWeight >= 80.0) {
    // 80ml: 黄色にMAX輝度で光らせる
    for (int i = 0; i < NUMPIXELS; i++) {
      pixels.setPixelColor(i, pixels.Color(255, 255, 0)); // 黄色MAX
    }
  }

  pixels.show();
}

void updateVisualsAndSound(float currentVal, float targetVal, uint32_t color) {
  float progress = currentVal / targetVal;
  if (progress < 0) progress = 0;
  // 上限キャップなし（溢れる表現のため）

  // アニメーション用の時間
  unsigned long t = millis();

  pixels.clear();

  // 全てのLEDに対して計算
  for(int i=0; i<NUMPIXELS; i++) {
    // 進行度に応じて「熱量」を変える
    // ターゲットに近づくほど heat が高くなる
    float heat = progress;

    // オーバーフローしたら少し色が狂う演出
    if (progress > 1.1) {
       heat = 1.0 + sin(t/100.0) * 0.2; // 点滅
    }

    // 通常モード: マグマのような暖色
    // ピクセルごとに少し位相をずらして「うねり」を作る
    float localHeat = constrain(heat + sin(t/1000.0 + i*0.3)*0.1, 0.0, 1.0);
    uint32_t c = getWarmColor(localHeat, i, t);

    pixels.setPixelColor(i, c);
  }

  pixels.show();
}

void loop() {
  LoadCell.update();
  float weight = LoadCell.getData();

  // シリアルコマンド入力処理
  if (Serial.available() > 0) {
    char inByte = Serial.read();
    if (currentState == IDLE || currentState == RECIPE_FINISHED) {
      if (inByte >= '1' && inByte <= '3') {
        currentRecipeIndex = inByte - '1';
        currentStepIndex = 0;
        cumulativeWeight = 0; // 累積重量をリセット
        currentState = TARE_WAIT;
        Serial.print("Selected: ");
        Serial.println(recipes[currentRecipeIndex].name);
        Serial.println("Please wait for auto-tare...");
      }
    } else if (inByte == 'c') {
      // 強制キャンセル
      currentState = IDLE;
      pixels.clear(); pixels.show();
      printMenu();
    }
  }

  switch (currentState) {
    case TARE_WAIT: {
      static unsigned long tareStartTime = 0;
      if (tareStartTime == 0) tareStartTime = millis();

      LoadCell.tareNoDelay();
      
      // デバッグ: 待機中の値を表示 (ノイズ確認用)
      if (millis() % 500 == 0) {
         Serial.println("Taring...");
      }

      // 4秒経過しても終わらなければ強制スタート
      if (LoadCell.getTareStatus() || (millis() - tareStartTime > 4000)) {
        if (!LoadCell.getTareStatus()) {
           Serial.println("Tare timeout (unstable?) - Forcing start.");
           // 強制的に現在の値を0点とするためのライブラリハック、
           // または単に今の値をオフセットとして記録する手もあるが、
           // ここでは単に次へ進む。本来は setTareOffset を呼ぶべきだが
           // ライブラリの仕様上、update()内で処理されるため、
           // とりあえず "Tare Complete" とみなす。
        } else {
           Serial.println("Tare Complete.");
        }
        
        tareStartTime = 0; // リセット
        startWeight = 0; 
        currentState = POURING;
        
        // メニュー表示
        Serial.println("Step " + String(currentStepIndex + 1) + ": Pour " + 
                       recipes[currentRecipeIndex].steps[currentStepIndex].name + 
                       " (" + String(recipes[currentRecipeIndex].steps[currentStepIndex].targetWeight) + "g)");
      }
      break;
    }

    case POURING: {
      Ingredient currentIng = recipes[currentRecipeIndex].steps[currentStepIndex];
      float currentAdded = weight; // tareされているので現在の重量＝追加分

      // シンデレラ特別演出モードの場合
      bool isSpecialMode = recipes[currentRecipeIndex].isSpecialCinderella;

      if (isSpecialMode) {
        // シンデレラモード: 累積重量で演出
        updateCinderellaVisuals(cumulativeWeight + currentAdded);
      } else {
        // 通常モード: 光の更新
        updateVisualsAndSound(currentAdded, currentIng.targetWeight, currentIng.color);
      }

      // --- リアルタイム重量表示 (追加) ---
      static unsigned long lastSerialPrintTime = 0;
      if (millis() - lastSerialPrintTime > 200) { // 200msごとに表示
        Serial.print("Pouring: ");
        Serial.print(currentIng.name);
        Serial.print(" | Current: ");
        Serial.print(currentAdded, 1);
        Serial.print(" / ");
        Serial.print(currentIng.targetWeight, 1);
        Serial.print(" g | Cumulative: ");
        Serial.print(cumulativeWeight + currentAdded, 1);
        Serial.println(" g");
        lastSerialPrintTime = millis();
      }
      // ------------------------------------

      // 20ml以上超過で爆発音
      static bool playedExplosionSound = false;
      if (currentAdded > (currentIng.targetWeight + 20.0) && !playedExplosionSound) {
        Serial.println("SOUND:EXPLOSION"); // PCで「爆発2.mp3」を3回再生
        playedExplosionSound = true;
      }

      // 最後のステップ（レモンジュース）の特別処理
      bool isLastStepInCinderella = isSpecialMode && (currentStepIndex == recipes[currentRecipeIndex].stepCount - 1);

      if (isLastStepInCinderella) {
        // 累積90mlで完了（きらきら音がレモンジュース完了の合図）
        static bool completed90ml = false;
        if ((cumulativeWeight + currentAdded) >= 90.0 && !completed90ml) {
          Serial.println("SOUND:SPARKLE"); // PCで「きらきら輝く6.mp3」を再生
          Serial.println("Target reached!");

          // 累積重量を更新
          cumulativeWeight += currentAdded;

          // フラグをリセット
          completed90ml = false;
          playedExplosionSound = false;

          currentState = STEP_COMPLETED;
        }
      } else {
        // 通常のステップの完了判定
        float tolerance = 3.0; // 許容誤差: 3g

        if (currentAdded >= (currentIng.targetWeight - tolerance) &&
            currentAdded <= (currentIng.targetWeight + tolerance * 2)) { // 少し多めも許容

          Serial.println("Target reached!");
          Serial.println("SOUND:STEP_COMPLETE"); // PCで「地震魔法1.mp3」を再生

          // 累積重量を更新（シンデレラモード用）
          if (isSpecialMode) {
            cumulativeWeight += currentAdded;
          }

          // フラグをリセット
          playedExplosionSound = false;

          currentState = STEP_COMPLETED;
        }
      }
      break;
    }

    case STEP_COMPLETED:
      currentStepIndex++;
      if (currentStepIndex >= recipes[currentRecipeIndex].stepCount) {
        currentState = RECIPE_FINISHED;
      } else {
        // 次のステップのために風袋引き
        Serial.println("Step OK. Preparing next step...");
        delay(1000); // 少し待つ
        currentState = TARE_WAIT;
      }
      break;

    case RECIPE_FINISHED:
      Serial.print("Recipe Completed! Total weight: ");
      Serial.print(cumulativeWeight, 1);
      Serial.println(" ml");

      // 累積重量を送信（得点計算用）
      Serial.print("RECIPE_COMPLETE:");
      Serial.println(cumulativeWeight, 1);

      pixels.clear();
      pixels.show();

      currentState = IDLE;
      printMenu();
      break;
      
    case IDLE:
    default:
      break;
  }
}

