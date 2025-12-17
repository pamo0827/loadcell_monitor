#include <HX711_ADC.h>
#include <Adafruit_NeoPixel.h>

// ピン設定
const int HX711_dout = 53;
const int HX711_sck = 51;
const int LED_PIN = A0;
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

Recipe recipes[1] = {
  {
    "Cinderella (Standard)", 3,
    {
      {"Orange Juice", 40.0, COL_ORANGE},
      {"Pineapple Juice", 40.0, COL_PINE},
      {"Lemon Juice", 10.0, COL_LEMON}
    },
    true // シンデレラ特別演出モード有効
  }
};

int currentRecipeIndex = 0; // Default to Cinderella
int currentStepIndex = 0;
float startWeight = 0; // 各ステップ開始時の重量
float cumulativeWeight = 0; // シンデレラ特別演出用の累積重量

void setup() {
  Serial.begin(9600);
  
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
  Serial.println("1: Start Cinderella Mode");
  Serial.println("Type '1' to start.");
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

void loop() {
  LoadCell.update();
  float weight = LoadCell.getData();

  // シリアルコマンド入力処理
  if (Serial.available() > 0) {
    char inByte = Serial.read();
    if (currentState == IDLE || currentState == RECIPE_FINISHED) {
      if (inByte == '1') {
        currentRecipeIndex = 0; // Always Cinderella
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

      // シンデレラモードのみなので常にupdateCinderellaVisuals
      updateCinderellaVisuals(cumulativeWeight + currentAdded);

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
      bool isLastStepInCinderella = (currentStepIndex == recipes[currentRecipeIndex].stepCount - 1);

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
        // 通常のステップの完了判定（地震魔法音）
        float tolerance = 3.0; // 許容誤差: 3g

        if (currentAdded >= (currentIng.targetWeight - tolerance) &&
            currentAdded <= (currentIng.targetWeight + tolerance * 2)) { // 少し多めも許容

          Serial.println("Target reached!");
          Serial.println("SOUND:STEP_COMPLETE"); // PCで「地震魔法1.mp3」を再生

          // 累積重量を更新
          cumulativeWeight += currentAdded;

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

