from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from queue import Queue, Full
from threading import Thread
import torch
import base64
from io import BytesIO
from PIL import Image
import os
import pathlib

# Windows 경로 문제 해결
temp = pathlib.PosixPath
pathlib.PosixPath = pathlib.WindowsPath

# Flask 및 SocketIO 초기화
app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", transports=["websocket"], ping_timeout=120, ping_interval=30)

# YOLOv5 모델 로드
model = torch.hub.load('ultralytics/yolov5', 'custom', path='./complete/best.pt', force_reload=True, skip_validation=True)

# 작업 큐 생성 및 출력 폴더 생성
frame_queue = Queue(maxsize=50)
output_folder = './complete/outputFrame_v1'
os.makedirs(output_folder, exist_ok=True)

# 좌표 리스트
lat_list = [35.8525, 35.8536, 35.8554, 35.8593, 35.8647, 35.8681, 35.8699, 35.8700, 35.8703, 35.8729, 35.8734, 35.8736, 35.8737, 35.8739, 35.8740, 35.8741]
lng_list = [127.1605, 127.1597, 127.1584, 127.1557, 127.1518, 127.1484, 127.1385, 127.1320, 127.1259, 127.0945, 127.0932, 127.0927, 127.0924, 127.0921, 127.0918, 127.0915]

# 클라이언트별 SID 관리
uploader_sid = None  # Uploader(A) 클라이언트 SID

# 프레임 처리 함수
def process_frames():
    idx = 0  # 좌표 리스트 인덱스
    while True:
        frame_data = frame_queue.get()
        if frame_data is None:  # 종료 신호
            break

        frame = frame_data['frame']
        frame_index = frame_data['frame_index']

        try:
            # base64 디코딩 및 이미지 로드
            image_data = base64.b64decode(frame.split(',')[1])
            image = Image.open(BytesIO(image_data))

            # YOLOv5 객체 탐지 수행
            model.conf = 0.8
            results = model(image)

            if len(results.xyxy[0]) > 0:  # 탐지된 객체가 있을 경우
                results.render()
                result_image = Image.fromarray(results.ims[0])
                output_path = os.path.join(output_folder, f"frame_{frame_index:04d}.jpg")
                result_image.save(output_path)

                lat, lng = lat_list[idx % len(lat_list)], lng_list[idx % len(lat_list)]
                idx += 1

                # Viewer Room으로 데이터 전송
                with open(output_path, 'rb') as img_file:
                    image_b64 = f"data:image/jpeg;base64,{base64.b64encode(img_file.read()).decode()}"
                    emit_data = {
                        "latitude": lat,
                        "longitude": lng,
                        "image": image_b64,
                        "frame_index": frame_index
                    }
                    print(f"Viewer Room에 데이터 전송: {emit_data}")
                    socketio.emit("map_data", emit_data, to="viewer")
            else:
                print(f"프레임 {frame_index}: 탐지된 객체 없음. 저장하지 않음.")

            # Uploader(A) 클라이언트에 처리 완료 신호 전송
            if uploader_sid:
                print(f"Uploader(A) 클라이언트 {uploader_sid}에 처리 완료 신호 전송")
                socketio.emit("frame_processed", {"frame_index": frame_index}, to=uploader_sid)
        except Exception as e:
            print(f"프레임 처리 중 오류: {e}")
        frame_queue.task_done()

# 워커 쓰레드 시작
worker_thread = Thread(target=process_frames, daemon=True)
worker_thread.start()

# 클라이언트 연결
@socketio.on("connect")
def handle_connect():
    print(f"클라이언트 {request.sid} 연결되었습니다.")

@socketio.on("disconnect")
def handle_disconnect():
    global uploader_sid
    sid = request.sid

    if sid == uploader_sid:
        uploader_sid = None
        print(f"Uploader(A) 클라이언트 {sid} 연결이 해제되었습니다.")
    else:
        print(f"Viewer 또는 알 수 없는 클라이언트 {sid} 연결이 해제되었습니다.")

# 역할 등록
@socketio.on('register_role')
def register_role(data):
    global uploader_sid
    role = data.get("role")
    sid = request.sid

    if role == "uploader":
        uploader_sid = sid
        join_room("uploader")
        print(f"Uploader(A) 클라이언트 {sid} 등록됨. Room 'uploader'에 추가")
    elif role == "viewer":
        join_room("viewer")
        print(f"Viewer 클라이언트 {sid} 등록됨. Room 'viewer'에 추가")
    else:
        print(f"알 수 없는 역할: {role}")

# 프레임 수신
@socketio.on("frame")
def handle_frame(data):
    frame = data["frame"]
    frame_index = data["frame_index"]

    try:
        frame_queue.put({"frame": frame, "frame_index": frame_index}, block=True)
        print(f"프레임 {frame_index} 큐에 추가")
    except Full:
        print("작업 큐가 가득 찼습니다. 프레임 추가를 건너뜁니다.")

# 서버 종료 시 워커 종료
@socketio.on("shutdown")
def handle_shutdown():
    frame_queue.put(None)  # 종료 신호

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000)
