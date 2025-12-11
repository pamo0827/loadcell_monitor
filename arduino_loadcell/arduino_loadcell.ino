#include <HX711_ADC.h>
#include <Adafruit_NeoPixel.h>

// HX711のピン設定を複数試す
// よくある組み合わせ:
// DT=3, SCK=2
// DT=4, SCK=5
// DT=A1, SCK=A0
// DT=6, SCK=7

const int HX711_dout = 53; // DT（データ）ピン
const int HX711_sck = 51;  // SCK（クロック）ピン
const int LED_PIN = A0;    // LED制御ピン
const int NUMPIXELS = 16;  // LEDパネルのLED数

HX711_ADC LoadCell(HX711_dout, HX711_sck);
Adafruit_NeoPixel pixels(NUMPIXELS, LED_PIN, NEO_GRB + NEO_KHZ800);

// LED制御用の重量設定
const float MAX_WEIGHT = 200.0; // この重さでLEDが全点灯 (200g)

unsigned long lastPrintTime = 0;
const unsigned long printInterval = 100; // 更新頻度を少し上げる

void setup() {
  Serial.begin(9600);
  delay(100);

  // LED制御ピンを出力モードに設定 (NeoPixelライブラリが管理しますが念のため)
  // pinMode(LED_PIN, OUTPUT); 

  pixels.begin(); // NeoPixel初期化
  pixels.clear();
  pixels.show();

  Serial.println("=== HX711 Load Cell & LED Panel Gauge Test ===");
  Serial.print("DT pin: ");
  Serial.println(HX711_dout);
  Serial.print("SCK pin: ");
  Serial.println(HX711_sck);
  Serial.println("Initializing...");

  LoadCell.begin();

  unsigned long stabilizingtime = 2000;
  boolean _tare = true;

  LoadCell.start(stabilizingtime, _tare);

  if (LoadCell.getTareTimeoutFlag()) {
    Serial.println("ERROR: Failed to detect and initialize sensor!");
    // ... (エラーメッセージ省略) ...
  } else {
    LoadCell.setCalFactor(-434.0); // Calibrated value
    Serial.println("SUCCESS: Sensor initialized!");
    Serial.println("Ready to read weight data.");
    Serial.println("");
  }
}

void updateLEDs(float weight) {
  pixels.clear(); // 一旦リセット

  // 重さがマイナスの場合は0として扱う
  if (weight < 0) weight = 0;

  // 光らせる個数を計算 (0 〜 NUMPIXELS)
  int numLit = map(constrain((int)weight, 0, (int)MAX_WEIGHT), 0, (int)MAX_WEIGHT, 0, NUMPIXELS);

  for(int i=0; i<numLit; i++) {
    // 色を計算 (緑 -> 黄 -> 赤)
    // 0(緑) -> 16(赤) にグラデーションさせたい場合
    // 緑: (0, 150, 0), 黄: (150, 150, 0), 赤: (150, 0, 0)
    
    int r, g, b;
    // 簡易的な色変化: 重さに応じて色を変える
    if (i < NUMPIXELS / 3) {
      // 低負荷ゾーン: 緑
      r = 0; g = 50; b = 0;
    } else if (i < (NUMPIXELS * 2) / 3) {
       // 中負荷ゾーン: 黄色
       r = 50; g = 50; b = 0;
    } else {
       // 高負荷ゾーン: 赤
       r = 50; g = 0; b = 0;
    }

    pixels.setPixelColor(i, pixels.Color(r, g, b));
  }
  pixels.show();
}

void loop() {
  static boolean newDataReady = false;
  
  if (LoadCell.update()) newDataReady = true;

  if (newDataReady) {
    float weight = LoadCell.getData();
    
    // LED表示を更新 (毎回のデータ更新で反映してスムーズに見せる)
    updateLEDs(weight);

    // シリアル出力は間引きする
    if (millis() > lastPrintTime + printInterval) {
      Serial.print("Weight: ");
      Serial.print(weight, 1);
      Serial.println(" g");
      lastPrintTime = millis();
    }
    
    newDataReady = false;
  }

  // シリアルコマンド
  if (Serial.available() > 0) {
    char inByte = Serial.read();
    if (inByte == 't' || inByte == 'T') {
      LoadCell.tareNoDelay();
      Serial.println("CMD: Tare initiated...");
    } 
    // ... 他のコマンド ...
  }
}
