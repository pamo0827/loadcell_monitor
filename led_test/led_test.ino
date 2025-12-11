#include <Adafruit_NeoPixel.h>

#define PIN        A0   // LEDパネルのINに繋がっているピン
#define NUMPIXELS  16   // LEDの数 (4x4パネルなら16)
#define ONBOARD_LED 13  // Arduino本体のLED

// NeoPixelオブジェクトの作成
Adafruit_NeoPixel pixels(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(9600);
  pinMode(ONBOARD_LED, OUTPUT);
  
  pixels.begin(); // NeoPixelライブラリの初期化
  pixels.clear(); // すべてのピクセルをオフにする
  pixels.show();  // 状態を反映

  Serial.println("=== WS2812B LED Panel Test ===");
}

void loop() {
  pixels.clear(); // いったん全て消す

  // 1つずつ赤色で点灯させるテスト
  for(int i=0; i<NUMPIXELS; i++) {
    // pixels.Color() takes RGB values, from 0,0,0 up to 255,255,255
    pixels.setPixelColor(i, pixels.Color(150, 0, 0)); // 明るさを抑えた赤色 (150)

    pixels.show();   // LEDに色情報を送る（これを呼ばないと光らない）
    
    // 動作確認用: オンボードLEDをチカチカさせる
    digitalWrite(ONBOARD_LED, i % 2 == 0 ? HIGH : LOW);
    
    delay(100); // 少し待つ
  }
  
  // 全部光り終わったら少し待って、緑色で点灯
  delay(500);
  
  for(int i=0; i<NUMPIXELS; i++) {
    pixels.setPixelColor(i, pixels.Color(0, 150, 0)); // 緑色
    pixels.show();
    digitalWrite(ONBOARD_LED, i % 2 == 0 ? HIGH : LOW);
    delay(100);
  }
  
  delay(500);
}