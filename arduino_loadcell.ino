#include <HX711_ADC.h>

// HX711のピン設定を複数試す
// よくある組み合わせ:
// DT=3, SCK=2
// DT=4, SCK=5
// DT=A1, SCK=A0
// DT=6, SCK=7

const int HX711_dout = 53; // DT（データ）ピン
const int HX711_sck = 51;  // SCK（クロック）ピン

HX711_ADC LoadCell(HX711_dout, HX711_sck);

unsigned long lastPrintTime = 0;
const unsigned long printInterval = 500;

void setup() {
  Serial.begin(9600);
  delay(100);

  Serial.println("=== HX711 Load Cell Debug Test ===");
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
    Serial.println("Possible causes:");
    Serial.println("1. HX711 not connected to the pins above");
    Serial.println("2. Wiring issue (check DT and SCK connections)");
    Serial.println("3. Load cell not connected to HX711");
    Serial.println("4. Power supply issue");
    Serial.println("");
    Serial.println("Common pin configurations to try:");
    Serial.println("- DT=3, SCK=2 (current)");
    Serial.println("- DT=4, SCK=5");
    Serial.println("- DT=A1, SCK=A0");
    Serial.println("- DT=6, SCK=7");
  } else {
    LoadCell.setCalFactor(-434.0); // Calibrated: 5g weight = -2170 raw value, factor = -2170/5
    Serial.println("SUCCESS: Sensor initialized!");
    Serial.println("Ready to read weight data.");
    Serial.println("");
  }
}

void loop() {
  static boolean newDataReady = false;
  static unsigned long debugCounter = 0;

  if (LoadCell.update()) newDataReady = true;

  if (newDataReady && millis() > lastPrintTime + printInterval) {
    float weight = LoadCell.getData();
    long rawData = LoadCell.getData();  // 生データ

    // 詳細なデバッグ情報
    Serial.print("[");
    Serial.print(debugCounter++);
    Serial.print("] Weight: ");
    Serial.print(weight, 3);
    Serial.print(" g | Raw: ");
    Serial.print(rawData);

    // HX711が実際にデータを返しているかチェック
    if (rawData == 0) {
      Serial.print(" | WARNING: Raw data is 0 - sensor may not be responding");
    }

    Serial.println();

    newDataReady = false;
    lastPrintTime = millis();
  }

  // シリアルコマンド
  if (Serial.available() > 0) {
    char inByte = Serial.read();

    if (inByte == 't' || inByte == 'T') {
      LoadCell.tareNoDelay();
      Serial.println("CMD: Tare initiated...");
    } else if (inByte == 'r' || inByte == 'R') {
      LoadCell.start(2000, true);
      Serial.println("CMD: Sensor reset initiated...");
    } else if (inByte == 'd' || inByte == 'D') {
      // デバッグ情報表示
      Serial.println("=== Debug Info ===");
      Serial.print("DT pin: ");
      Serial.println(HX711_dout);
      Serial.print("SCK pin: ");
      Serial.println(HX711_sck);
      Serial.print("Tare timeout: ");
      Serial.println(LoadCell.getTareTimeoutFlag() ? "YES (ERROR)" : "NO (OK)");
      Serial.println("==================");
    }
  }

  if (LoadCell.getTareStatus() == true) {
    Serial.println("INFO: Tare complete!");
  }
}
