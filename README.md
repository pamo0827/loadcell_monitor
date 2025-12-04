# Load Cell Monitor

HX711ロードセルセンサーを使用した重量測定システム

## 概要

Arduino MegaとHX711ロードセルアンプを使用して、重量をリアルタイムで測定・表示するプロジェクトです。PythonスクリプトでArduinoと通信し、重量データの読み取り、キャリブレーション、風袋引きが可能です。

## ハードウェア構成

- **Arduino Mega 2560**
- **HX711 Load Cell Amplifier**
- **Load Cell**（ロードセル）

### 配線

- HX711 DT pin → Arduino Mega pin 53
- HX711 SCK pin → Arduino Mega pin 51
- HX711 VCC → Arduino 5V
- HX711 GND → Arduino GND

## ファイル構成

### Arduino スケッチ

- **arduino_loadcell.ino** - メインのArduinoプログラム
  - HX711センサーの初期化と設定
  - リアルタイム重量測定
  - シリアル通信によるコマンド受信
  - キャリブレーション係数: -434.0 (5g基準)

### Python スクリプト

- **read_loadcell.py** - 重量データのリアルタイム読み取り
- **calibrate_loadcell.py** - ロードセルのキャリブレーション
- **tare_loadcell.py** - ゼロ点調整（風袋引き）
- **reset_loadcell.py** - センサーのリセット

## 使い方

### 1. Arduinoのセットアップ

```bash
# Arduino IDEまたはarduino-cliでスケッチをアップロード
arduino-cli compile --fqbn arduino:avr:mega arduino_loadcell.ino
arduino-cli upload -p /dev/cu.usbmodem101 --fqbn arduino:avr:mega arduino_loadcell.ino
```

### 2. Python環境のセットアップ

```bash
# 必要なライブラリのインストール
pip3 install pyserial
```

### 3. 重量の読み取り

```bash
# リアルタイムで重量を表示
python3 read_loadcell.py
```

### 4. ゼロ点調整

```bash
# ロードセルに何も載せていない状態で実行
python3 tare_loadcell.py
```

### 5. キャリブレーション

```bash
# 対話的にキャリブレーションを実行
python3 calibrate_loadcell.py
```

## シリアルコマンド

Arduinoは以下のシリアルコマンドを受け付けます：

- **t** または **T** - ゼロ点調整（Tare）
- **r** または **R** - センサーリセット
- **d** または **D** - デバッグ情報表示

## キャリブレーション方法

1. Arduinoを起動（自動的にゼロ点調整が実行されます）
2. 既知の重量（例：5g）のおもりを載せる
3. 表示される生データ（Raw値）を確認
4. キャリブレーション係数を計算：`係数 = 生データ / 実際の重量`
5. `arduino_loadcell.ino`の`setCalFactor()`の値を更新
6. 再度スケッチをアップロード

### 現在の設定

- **キャリブレーション係数**: -434.0
- **基準重量**: 5g
- **生データ**: -2170（5g載せた時）

## 依存関係

### Arduino

- [HX711_ADC Library](https://github.com/olkal/HX711_ADC)

### Python

- pyserial

## ライセンス

MIT License

## 作成者

Created with Claude Code
