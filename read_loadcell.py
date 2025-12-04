#!/usr/bin/env python3
import serial
import time

# ロードセルのシリアルポート設定
PORT = '/dev/cu.usbmodem101'
BAUDRATE = 9600  # 一般的なボーレート、必要に応じて変更

# よくあるボーレート: 9600, 115200, 19200, 38400, 57600

def read_loadcell():
    try:
        # シリアルポートを開く
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)
        print(f"ロードセルに接続しました: {PORT} @ {BAUDRATE} baud")
        print("データを読み取り中... (Ctrl+Cで終了)\n")

        # データを連続的に読み取る
        while True:
            if ser.in_waiting > 0:
                # データを読み取る
                data = ser.readline().decode('utf-8', errors='ignore').strip()
                if data:
                    print(f"重量: {data}")
            time.sleep(0.1)

    except serial.SerialException as e:
        print(f"シリアルポートエラー: {e}")
        print("\n別のボーレートを試しています...")

        # 他の一般的なボーレートを試す
        for baud in [115200, 19200, 38400, 57600, 4800]:
            try:
                print(f"\n{baud} baudで接続を試みています...")
                ser = serial.Serial(PORT, baud, timeout=1)
                print(f"接続成功: {baud} baud")
                print("データを読み取り中... (Ctrl+Cで終了)\n")

                while True:
                    if ser.in_waiting > 0:
                        data = ser.readline().decode('utf-8', errors='ignore').strip()
                        if data:
                            print(f"重量: {data}")
                    time.sleep(0.1)

            except serial.SerialException:
                continue
            except KeyboardInterrupt:
                break

    except KeyboardInterrupt:
        print("\n\n終了しました")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("シリアルポートを閉じました")

if __name__ == "__main__":
    read_loadcell()
