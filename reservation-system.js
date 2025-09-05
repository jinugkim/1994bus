// 버스 좌석 예약 시스템
class BusReservationSystem {
    constructor() {
        this.reservations = new Map(); // seatNumber -> reservation data
        this.currentSeat = null;
        this.isReservationMode = false;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // 모달 관련 이벤트
        const modal = document.getElementById('reservationModal');
        const closeBtn = document.getElementById('modalClose');
        const cancelBtn = document.getElementById('cancelBtn');
        const confirmBtn = document.getElementById('confirmBtn');
        const cancelCancelBtn = document.getElementById('cancelCancelBtn');
        const confirmCancelBtn = document.getElementById('confirmCancelBtn');
        const reservationForm = document.getElementById('reservationForm');

        // 시스템 컨트롤 버튼
        const loadReservationsBtn = document.getElementById('loadReservationsBtn');
        const clearAllBtn = document.getElementById('clearAllBtn');
        const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');

        // 모달 닫기
        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        cancelCancelBtn.addEventListener('click', () => this.closeModal());

        // 모달 외부 클릭시 닫기
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // 예약 폼 제출
        reservationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleReservation();
        });

        // 예약 취소 확인
        confirmCancelBtn.addEventListener('click', () => {
            this.handleCancellation();
        });

        // 시스템 컨트롤
        loadReservationsBtn.addEventListener('click', () => this.loadReservations());
        clearAllBtn.addEventListener('click', () => this.clearAllReservations());
        toggleAdvancedBtn.addEventListener('click', () => this.toggleAdvancedMode());

        // 좌석 클릭 이벤트 (기존 좌석에 추가)
        this.addSeatClickListeners();
    }

    addSeatClickListeners() {
        const seats = document.querySelectorAll('.seat[data-seat]');
        seats.forEach(seat => {
            seat.addEventListener('click', (e) => {
                const seatNumber = parseInt(seat.getAttribute('data-seat'));
                this.openSeatModal(seatNumber);
            });
            
            // 좌석에 클릭 가능 표시
            seat.classList.add('clickable');
        });
    }

    openSeatModal(seatNumber) {
        this.currentSeat = seatNumber;
        const modal = document.getElementById('reservationModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalSeatNumber = document.getElementById('modalSeatNumber');
        const modalSeatStatus = document.getElementById('modalSeatStatus');
        const reservationForm = document.getElementById('reservationForm');
        const cancelForm = document.getElementById('cancelForm');

        // 좌석 정보 설정
        modalSeatNumber.textContent = `${seatNumber}번`;

        const reservation = this.reservations.get(seatNumber);
        
        if (reservation) {
            // 예약된 좌석 - 취소 모드
            modalTitle.textContent = '예약 취소';
            modalSeatStatus.textContent = `예약됨 (${reservation.name})`;
            modalSeatStatus.style.color = '#e74c3c';
            
            reservationForm.style.display = 'none';
            cancelForm.style.display = 'block';
            
            // 취소 폼 초기화
            document.getElementById('cancelName').value = '';
            document.getElementById('cancelPhone').value = '';
        } else {
            // 빈 좌석 - 예약 모드
            modalTitle.textContent = '좌석 예약';
            modalSeatStatus.textContent = '빈 좌석';
            modalSeatStatus.style.color = '#27ae60';
            
            reservationForm.style.display = 'block';
            cancelForm.style.display = 'none';
            
            // 예약 폼 초기화
            document.getElementById('passengerName').value = '';
            document.getElementById('passengerPhone').value = '';
            document.getElementById('passengerLocation').value = '';
            document.getElementById('paymentStatus').value = 'pending';
        }

        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('reservationModal');
        modal.style.display = 'none';
        this.currentSeat = null;
    }

    async handleReservation() {
        if (!this.currentSeat) return;

        const name = document.getElementById('passengerName').value.trim();
        const phone = document.getElementById('passengerPhone').value.trim();
        const location = document.getElementById('passengerLocation').value;
        const paymentStatus = document.getElementById('paymentStatus').value;

        // 입력 검증
        if (!name || !phone || !location) {
            alert('모든 필수 항목을 입력해주세요.');
            return;
        }

        if (!this.validatePhone(phone)) {
            alert('올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678)');
            return;
        }

        // 예약 데이터 생성
        const reservation = {
            seatNumber: this.currentSeat,
            name: name,
            phone: phone,
            location: location,
            paymentStatus: paymentStatus,
            timestamp: new Date().toISOString()
        };

        try {
            // 구글 시트에 저장
            const saved = await sheetsAPI.saveReservation(reservation);
            
            if (saved) {
                // 로컬 데이터 업데이트
                this.reservations.set(this.currentSeat, reservation);
                
                // UI 업데이트
                this.updateSeatDisplay(this.currentSeat, reservation);
                this.updateStatistics();
                this.updatePassengerList();
                
                alert(`${this.currentSeat}번 좌석이 예약되었습니다.`);
                this.closeModal();
            }
        } catch (error) {
            console.error('예약 처리 실패:', error);
            alert('예약 처리 중 오류가 발생했습니다.');
        }
    }

    async handleCancellation() {
        if (!this.currentSeat) return;

        const name = document.getElementById('cancelName').value.trim();
        const phone = document.getElementById('cancelPhone').value.trim();

        if (!name || !phone) {
            alert('이름과 전화번호를 입력해주세요.');
            return;
        }

        const reservation = this.reservations.get(this.currentSeat);
        
        if (!reservation) {
            alert('해당 좌석에 예약이 없습니다.');
            return;
        }

        // 정보 확인
        if (reservation.name !== name || reservation.phone !== phone) {
            alert('입력한 정보가 예약 정보와 일치하지 않습니다.');
            return;
        }

        if (!confirm(`${this.currentSeat}번 좌석 예약을 취소하시겠습니까?`)) {
            return;
        }

        try {
            // 구글 시트에서 삭제
            const removed = await sheetsAPI.removeReservation(this.currentSeat);
            
            if (removed) {
                // 로컬 데이터 삭제
                this.reservations.delete(this.currentSeat);
                
                // UI 업데이트
                this.clearSeatDisplay(this.currentSeat);
                this.updateStatistics();
                this.updatePassengerList();
                
                alert(`${this.currentSeat}번 좌석 예약이 취소되었습니다.`);
                this.closeModal();
            }
        } catch (error) {
            console.error('예약 취소 실패:', error);
            alert('예약 취소 중 오류가 발생했습니다.');
        }
    }

    async loadReservations() {
        try {
            sheetsAPI.showStatus('예약 데이터를 불러오는 중...', 'offline');
            
            const reservations = await sheetsAPI.getReservations();
            
            if (reservations === null) {
                return; // API 오류는 이미 처리됨
            }

            // 기존 예약 데이터 클리어
            this.reservations.clear();
            this.clearAllSeatDisplays();

            // 새 예약 데이터 적용
            reservations.forEach(reservation => {
                this.reservations.set(reservation.seatNumber, reservation);
                this.updateSeatDisplay(reservation.seatNumber, reservation);
            });

            this.updateStatistics();
            this.updatePassengerList();

            sheetsAPI.showStatus(`${reservations.length}개의 예약을 불러왔습니다`, 'online');
            
        } catch (error) {
            console.error('예약 불러오기 실패:', error);
            sheetsAPI.showStatus('예약 불러오기 실패', 'offline');
        }
    }

    async clearAllReservations() {
        if (!confirm('모든 예약을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        try {
            const cleared = await sheetsAPI.clearAllReservations();
            
            if (cleared) {
                this.reservations.clear();
                this.clearAllSeatDisplays();
                this.updateStatistics();
                this.updatePassengerList();
                
                alert('모든 예약이 삭제되었습니다.');
            }
        } catch (error) {
            console.error('예약 삭제 실패:', error);
            alert('예약 삭제 중 오류가 발생했습니다.');
        }
    }

    updateSeatDisplay(seatNumber, reservation) {
        const seatElement = document.querySelector(`[data-seat="${seatNumber}"]`);
        if (!seatElement) return;

        // 기존 스타일 제거
        seatElement.classList.remove('occupied', 'paid', 'pending');
        seatElement.style.backgroundColor = '';
        seatElement.style.borderColor = '';
        seatElement.style.opacity = '';

        // 새 스타일 적용
        seatElement.classList.add('occupied', reservation.paymentStatus);
        
        // 탑승지별 색상 적용 (기존 로직 활용)
        if (window.busSeatManager && window.busSeatManager.locationColors) {
            const locationColor = window.busSeatManager.locationColors[reservation.location];
            if (locationColor) {
                seatElement.style.backgroundColor = locationColor;
                seatElement.style.borderColor = this.darkenColor(locationColor, 20);
                seatElement.style.opacity = reservation.paymentStatus === 'pending' ? '0.7' : '1';
            }
        }

        // 승객 이름 표시
        seatElement.setAttribute('data-passenger-name', reservation.name);
        seatElement.title = `${reservation.name}\n${reservation.paymentStatus === 'paid' ? '입금완료' : '입금예정'}\n${reservation.location}\n${reservation.phone}`;
    }

    clearSeatDisplay(seatNumber) {
        const seatElement = document.querySelector(`[data-seat="${seatNumber}"]`);
        if (!seatElement) return;

        seatElement.classList.remove('occupied', 'paid', 'pending');
        seatElement.removeAttribute('data-passenger-name');
        seatElement.removeAttribute('title');
        seatElement.style.backgroundColor = '';
        seatElement.style.borderColor = '';
        seatElement.style.opacity = '';
    }

    clearAllSeatDisplays() {
        const seats = document.querySelectorAll('.seat[data-seat]');
        seats.forEach(seat => {
            const seatNumber = parseInt(seat.getAttribute('data-seat'));
            this.clearSeatDisplay(seatNumber);
        });
    }

    updateStatistics() {
        // 기존 통계 업데이트 로직 활용
        if (window.busSeatManager) {
            // 예약 데이터를 승객 형태로 변환
            const passengers = Array.from(this.reservations.values()).map(reservation => ({
                orderNumber: reservation.seatNumber,
                name: reservation.name,
                paymentStatus: reservation.paymentStatus,
                location: reservation.location,
                seatNumber: reservation.seatNumber
            }));

            window.busSeatManager.passengers = passengers;
            window.busSeatManager.assignLocationColors();
            window.busSeatManager.displayLocationStats();
        }
    }

    updatePassengerList() {
        // 기존 승객 목록 업데이트 로직 활용
        if (window.busSeatManager) {
            window.busSeatManager.displayPassengerList();
        }
    }

    validatePhone(phone) {
        // 전화번호 형식 검증
        const phoneRegex = /^01[0-9]-\d{3,4}-\d{4}$/;
        return phoneRegex.test(phone);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    toggleAdvancedMode() {
        const inputSection = document.querySelector('.input-section');
        const toggleBtn = document.getElementById('toggleAdvancedBtn');
        
        if (inputSection.style.display === 'none') {
            inputSection.style.display = 'block';
            toggleBtn.textContent = '⚙️ 고급 모드 숨기기';
            toggleBtn.classList.add('active');
        } else {
            inputSection.style.display = 'none';
            toggleBtn.textContent = '⚙️ 고급 모드';
            toggleBtn.classList.remove('active');
        }
    }

    // 통계 정보 제공
    getStatistics() {
        const totalReservations = this.reservations.size;
        const paidReservations = Array.from(this.reservations.values())
            .filter(r => r.paymentStatus === 'paid').length;
        const pendingReservations = totalReservations - paidReservations;
        const emptySeats = 28 - totalReservations;

        return {
            total: totalReservations,
            paid: paidReservations,
            pending: pendingReservations,
            empty: emptySeats
        };
    }
}

// 전역 인스턴스 생성
const reservationSystem = new BusReservationSystem();
