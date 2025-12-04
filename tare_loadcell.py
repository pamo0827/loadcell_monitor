#!/usr/bin/env python3
import serial
import time

PORT = '/dev/cu.usbmodem101'
BAUDRATE = 9600

print("ロードセルをゼロ点調整します...")
print("ロードセルに何も載せていない状態にしてください")
print()

time.sleep(2)

try:
    ser = serial.Serial(PORT, BAUDRATE, timeout=1)
    time.sleep(2)  # Arduino起動待ち

    # 初期データを読み飛ばす
    ser.reset_input_buffer()

    print("TAREコマンドを送信しています...")
    ser.write(b't')

    print("ゼロ点調整中...\n")
    time.sleep(3)

    # 応答を読む
    for _ in range(30):
        if ser.in_waiting > 0:
            data = ser.readline().decode('utf-8', errors='ignore').strip()
            if data:
                print(data)
        time.sleep(0.2)

    print("\n完了！")
    ser.close()

except Exception as e:
    print(f"エラー: {e}")
