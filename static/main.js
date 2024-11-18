// websocket 접속
const socket = io.connect('http://0.0.0.0:5005', {transports:['websocket']});

// 역할 등록
socket.on('connect', () => {
    socket.emit('register_role', {role:'uploader'}); // A 클라이언트는 uploader
    console.log('Uploader(A)로 등록되었습니다.');
});

// 서버에서 처리 완료 신호를 받으면 다음 프레임 전송
socket.on('frame_processed', (data) => {
    console.log(`프레임 ${data.frame_index} 처리 완료`);
    if (video.currentTime < video.duration) {
        video.dispatchEvent(new Event('seeked')); // 다음 프레임 추출
    }
});

// main page text typing
let target = document.querySelector('#dynamic');

function randomString(){
    let stringArr = ["Let's Go Korail!", "Learn to BigData!",
        "Learn to AI!", "Learn to Object Detection!", 'Learn to Computer Vision!']
    let selectString = stringArr[Math.floor(Math.random() * stringArr.length)];
    let selectStringArr = selectString.split("");
    
    return selectStringArr
}

//타이핑 리셋
function resetTyping(){
    target.textContent = "";
    dynamic(randomString());
}

//한글자씩 텍스트 출력 함수
function dynamic(randomArr){

    if(randomArr.length > 0){
        target.textContent += randomArr.shift();
        setTimeout(function(){
            dynamic(randomArr);
        }    , 80);
    }else{
        setTimeout(resetTyping, 1000);
    }
}

dynamic(randomString());

//커서 깜빡임 효과
function blink(){
    target.classList.toggle('active');
}

setInterval(blink, 500);



// 파일 업로드 관련
let uploadedFile;

// 드롭박스 영역 요소 가져오기
const dropBox = document.getElementById('dropBox');
const title = dropBox.querySelector('h3');

dropBox.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropBox.classList.add('drag-over');
});

dropBox.addEventListener('dragleave', function () {
    dropBox.classList.remove('drag-over');
});

dropBox.addEventListener('drop', function (e) {
    e.preventDefault();
    dropBox.classList.remove('drag-over');

    const file = [...e.dataTransfer.files];
    if (file.length > 0) {
        uploadedFile = file[0];
        title.innerHTML = file.map(v => v.name).join('<br>');
    }
});



// kakao map api
// 엔터키로 새 창에서 지도 검색
function handleKeyPress(event) {
    if (event.key == 'Enter') {
        //openMapWindow();
        processVideo();
    };
};

// 새로운 창에서 지도 활성화
function openMapWindow() {
    const location = document.getElementById('locationInput').value;
    if (!location) {
        alert("역명을 입력하세요.")
        return;
    };
    // 새 창을 열고 지도 HTML을 추가
    const newWindow = window.open(`mapResult.html?location=${encodeURIComponent(location)}`, '_blank');
    // 새 창이 열리면 최대화 설정
    newWindow.onload = function() {
        newWindow.moveTo(0, 0);
        newWindow.resizeTo(screen.width, screen.height);
    };
    //processVideo();
};

// 동영상 로드 완료 시 초기화
/*
video.addEventListener('loadeddata', () => {
    video.currentTime = 0; // 동영상 시작 시간 설정
    console.log('동영상 로드 완료, 총 프레임 수:', totalFrames);
});
*/
// 프레임 추출 및 전송
function processVideo() {
    if (!uploadedFile) {
        alert("동영상을 업로드하세요.");
        return;
    }

    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    video.src = URL.createObjectURL(uploadedFile);
    video.muted = true;

    let frameIndex = 0;
    const totalFrames = Math.floor(video.duration * 24);

    while(video.currentTime < video.duration) {
        // 캔버스 크기 설정
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 현재 프레임을 캔버스로 렌더링
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Frame = canvas.toDataURL('image/jpeg');

        // 서버로 프레임 전송
        socket.emit('frame', {frame:base64Frame, frame_index:frameIndex});
        console.log(`프레임 ${frameIndex} 전송`);
        frameIndex++;

        // 다음 프레임으로 이동
        video.currentTime += 1 / 24; // FPS 기준으로 1/24초 이동
    }
    socket.emit('web2serverDone', {sentAll:1});
    console.log('모든 프레임 전송 완료');
}
