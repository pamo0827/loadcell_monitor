#!/usr/bin/env python3
import serial
import time

PORT = '/dev/cu.usbmodem101'
BAUDRATE = 9600

def calibrate():
    try:
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)
        time.sleep(2)  # Arduino起動待ち

        print("=" * 50)
        print("ロードセルキャリブレーションツール")
        print("=" * 50)
        print()

        # 初期データを読み飛ばす
        time.sleep(1)
        ser.reset_input_buffer()

        print("ステップ1: ゼロ点調整（TARE）")
        print("ロードセルに何も載せていない状態にしてください")
        input("準備ができたらEnterキーを押してください...")

        # TAREコマンドを送信
        ser.write(b't')
        print("ゼロ点調整中...")
        time.sleep(3)

        # 応答を読む
        for _ in range(20):
            if ser.in_waiting > 0:
                data = ser.readline().decode('utf-8', errors='ignore').strip()
                if data:
                    print(f"  {data}")
            time.sleep(0.1)

        print("\n" + "=" * 50)
        print("ゼロ点調整完了！")
        print("=" * 50)
        print("\n現在の重量データを監視中...")
        print("(Ctrl+Cで終了)\n")

        # リアルタイムで重量を表示
        while True:
            if ser.in_waiting > 0:
                data = ser.readline().decode('utf-8', errors='ignore').strip()
                if data and 'Weight:' in data:
                    print(data)
            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\n\n終了しました")
    except Exception as e:
        print(f"エラー: {e}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    calibrate()
