#!/usr/bin/env python3
import serial
import time
import subprocess

# ロードセルのシリアルポート設定
PORT = '/dev/cu.usbmodem101'
BAUDRATE = 9600

# 50g単位で報告
WEIGHT_THRESHOLD = 50

def speak_with_say(text):
    """macOSのsayコマンドを使って音声を再生"""
    try:
        # 日本語音声で読み上げ（Kyokoは日本語音声）
        subprocess.run(["say", "-v", "Kyoko", text], check=True)
        print(f"🔊 音声: {text}")
        return True
    except Exception as e:
        print(f"音声再生エラー: {e}")
        return False

def monitor_weight():
    """重量を監視して50g単位で報告"""
    try:
        # シリアルポートを開く
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)
        print(f"ロードセルに接続しました: {PORT} @ {BAUDRATE} baud")
        print(f"50g単位で重量を報告します (Ctrl+Cで終了)")
        print()

        # 初期化待ち
        time.sleep(3)
        ser.reset_input_buffer()

        last_reported_weight = 0  # 最後に報告した重量
        stable_weight = 0  # 安定した重量
        stable_count = 0  # 安定カウント
        STABLE_THRESHOLD = 5  # 5回連続で同じ50g単位なら安定とみなす

        while True:
            if ser.in_waiting > 0:
                # データを読み取る
                data = ser.readline().decode('utf-8', errors='ignore').strip()

                # 重量データを抽出
                if "Weight:" in data and "g" in data:
                    try:
                        # "Weight: 123.456 g" から数値を抽出
                        weight_str = data.split("Weight:")[1].split("g")[0].strip()
                        current_weight = float(weight_str)

                        # 50g単位に丸める
                        rounded_weight = round(current_weight / WEIGHT_THRESHOLD) * WEIGHT_THRESHOLD

                        # 安定性チェック
                        if abs(rounded_weight - stable_weight) < 10:  # 10g以内の誤差は同じとみなす
                            stable_count += 1
                        else:
                            stable_weight = rounded_weight
                            stable_count = 1

                        # 安定していて、かつ前回報告から50g以上変化した場合
                        if stable_count >= STABLE_THRESHOLD:
                            weight_diff = abs(rounded_weight - last_reported_weight)

                            if weight_diff >= WEIGHT_THRESHOLD:
                                print(f"\n[報告] 重量: {rounded_weight:.0f}g")

                                # sayコマンドで報告
                                if rounded_weight == 0:
                                    message = "重さは0グラムです"
                                elif rounded_weight < 0:
                                    message = f"マイナス{abs(int(rounded_weight))}グラムです"
                                else:
                                    message = f"{int(rounded_weight)}グラムです"

                                speak_with_say(message)

                                last_reported_weight = rounded_weight
                                stable_count = 0  # リセット

                        # 現在の値を表示（デバッグ用）
                        print(f"現在: {current_weight:6.1f}g | 50g単位: {rounded_weight:6.0f}g | 安定度: {stable_count}/{STABLE_THRESHOLD}  ", end='\r')

                    except (ValueError, IndexError) as e:
                        pass  # データの解析に失敗した場合はスキップ

            time.sleep(0.1)

    except serial.SerialException as e:
        print(f"\nシリアルポートエラー: {e}")
        print("別のボーレートを試してください。")
    except KeyboardInterrupt:
        print("\n\n終了しました")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("シリアルポートを閉じました")

if __name__ == "__main__":
    print("=" * 60)
    print("  ロードセル音声モニター with macOS Say")
    print("=" * 60)
    print()
    print("使い方:")
    print("  1. ロードセルに物を載せると、50g単位で重量を報告します")
    print("  2. 安定した重量になると、音声で読み上げます")
    print("  3. Ctrl+Cで終了")
    print()

    monitor_weight()
