const socket = io.connect('http://192.168.0.28:5000', {transports:['websocket']});

// 역할 등록
socket.on('connect', () => {
    console.log('Viewer(B)로 WebSocket 연결 성공');
    socket.emit('register_role', {role:'viewer'}); // B 클라이언트는 viewer
    

    // 이전 이벤트 리스너 제거 후 다시 등록 (중복 방지)
    socket.off('map_data');
    socket.on('map_data', (data) => {
        if (!data){
            console.error('서버에서 데이터를 받지 못했습니다.');
        } else {
            console.log('Viewer(B)에서 받은 데이터:', data);
            const {latitude, longitude, image, frame_index} = data;
            addMarkerWithImage(latitude, longitude, image, frame_index);
        }
    });
});

// 지도 객체 생성
let map;
window.onload = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const location = urlParams.get('location');
    
    const mapContainer = document.getElementById('map');
    const mapOption = {
        center: new kakao.maps.LatLng(37.5665, 126.9780), // 기본 중심 좌표 (전주역)
        levle: 4
    };

    // 지도 객체와 장소 검색 객체를 생성합니다.
    map = new kakao.maps.Map(mapContainer, mapOption);
    

    if (location) {
        const ps = new kakao.maps.services.Places();
        // 입력된 키워드로 장소를 검색합니다.
        ps.keywordSearch(location, function (data, status) {
            if (status === kakao.maps.services.Status.OK) {
                // 첫 번째 검색 결과만 지도에 표시
                const firstLocation = data[0]
                const coords = new kakao.maps.LatLng(firstLocation.y, firstLocation.x);

                // 지도의 중심을 첫 번째 검색 결과 위치로 설정
                map.setCenter(coords)
            } else {
                alert('해당 지역을 찾을 수 없습니다.');
            }
        });
    } else {
        alert("검색어를 입력하세요.");
    }
};

// 마커를 지도에 추가하는 함수
function addMarkerWithImage(lat, lng, image, id) {
    const markerPosition = new kakao.maps.LatLng(lat, lng);
    const marker = new kakao.maps.Marker({
        position: markerPosition,
        map: map
    });

    // 마커 클릭 이벤트
    kakao.maps.event.addListener(marker, 'click', () => {
        const newWindow = window.open('', '_blank');
        newWindow.document.write(`<img src="${image}" alt="Detected Objcet", style="width:100%; height:auto;">`);
    });
}




