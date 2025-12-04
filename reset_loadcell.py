#!/usr/bin/env python3
import serial
import time

PORT = '/dev/cu.usbmodem1201'
BAUDRATE = 9600

def reset_sensor():
    try:
        print("センサーのリセットを試みています...\n")

        # 方法1: DTR/RTSピンをトグルしてハードウェアリセット
        print("方法1: DTR/RTSピンをトグル")
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)
        ser.setDTR(False)
        ser.setRTS(False)
        time.sleep(0.5)
        ser.setDTR(True)
        ser.setRTS(True)
        time.sleep(0.5)
        ser.setDTR(False)
        ser.setRTS(False)
        time.sleep(1)
        print("DTR/RTSリセット完了\n")
        ser.close()
        time.sleep(1)

        # 方法2: 一般的なリセットコマンドを送信
        print("方法2: リセットコマンドを送信")
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)

        reset_commands = [
            b'RESET\r\n',
            b'RESET\n',
            b'R\r\n',
            b'r\r\n',
            b'TARE\r\n',
            b'T\r\n',
            b't\r\n',
            b'INIT\r\n',
            b'I\r\n',
        ]

        for cmd in reset_commands:
            print(f"送信: {cmd.decode('utf-8', errors='ignore').strip()}")
            ser.write(cmd)
            time.sleep(0.3)

            # レスポンスを読む
            if ser.in_waiting > 0:
                response = ser.read(ser.in_waiting).decode('utf-8', errors='ignore')
                print(f"レスポンス: {response}")

        time.sleep(1)

        # 方法3: 接続を閉じて再度開く
        print("\n方法3: シリアル接続をリセット")
        ser.close()
        time.sleep(2)
        ser = serial.Serial(PORT, BAUDRATE, timeout=1)
        print("再接続完了\n")

        # リセット後のメッセージを確認
        print("リセット後のメッセージを確認中...")
        for i in range(10):
            if ser.in_waiting > 0:
                data = ser.readline().decode('utf-8', errors='ignore').strip()
                if data:
                    print(f"受信: {data}")
            time.sleep(0.5)

        ser.close()
        print("\nリセット処理完了")

    except serial.SerialException as e:
        print(f"エラー: {e}")
    except Exception as e:
        print(f"予期しないエラー: {e}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()

if __name__ == "__main__":
    reset_sensor()
