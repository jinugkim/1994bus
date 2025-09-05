// Google Sheets API 설정
class SheetsAPI {
    constructor() {
        this.API_KEY = 'YOUR_API_KEY'; // 실제 API 키로 교체 필요
        this.CLIENT_ID = 'YOUR_CLIENT_ID'; // 실제 클라이언트 ID로 교체 필요
        this.DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
        
        this.SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // 실제 스프레드시트 ID로 교체 필요
        this.SHEET_NAME = 'BusReservations';
        
        this.isInitialized = false;
        this.isSignedIn = false;
    }

    async initialize() {
        try {
            await gapi.load('auth2', () => {
                gapi.auth2.init({
                    client_id: this.CLIENT_ID
                });
            });

            await gapi.load('client', async () => {
                await gapi.client.init({
                    apiKey: this.API_KEY,
                    clientId: this.CLIENT_ID,
                    discoveryDocs: [this.DISCOVERY_DOC],
                    scope: this.SCOPES
                });
                
                this.isInitialized = true;
                this.updateAuthStatus();
            });
        } catch (error) {
            console.error('Google Sheets API 초기화 실패:', error);
            this.showStatus('API 초기화 실패', 'offline');
        }
    }

    async signIn() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const authInstance = gapi.auth2.getAuthInstance();
            await authInstance.signIn();
            this.isSignedIn = true;
            this.updateAuthStatus();
            return true;
        } catch (error) {
            console.error('로그인 실패:', error);
            this.showStatus('로그인 실패', 'offline');
            return false;
        }
    }

    updateAuthStatus() {
        if (this.isInitialized && gapi.auth2.getAuthInstance().isSignedIn.get()) {
            this.isSignedIn = true;
            this.showStatus('구글 시트에 연결됨', 'online');
        } else {
            this.isSignedIn = false;
            this.showStatus('구글 시트에 연결되지 않음', 'offline');
        }
    }

    showStatus(message, status) {
        const statusDiv = document.getElementById('systemStatus');
        const indicator = statusDiv.querySelector('.status-indicator');
        const text = statusDiv.querySelector('.status-text');
        
        indicator.className = `status-indicator ${status}`;
        indicator.textContent = status === 'online' ? '🟢 온라인' : '⚫ 오프라인';
        text.textContent = message;
    }

    // 스프레드시트에서 예약 데이터 읽기
    async getReservations() {
        if (!this.isSignedIn) {
            const signedIn = await this.signIn();
            if (!signedIn) return null;
        }

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:F`,
            });

            const rows = response.result.values;
            if (!rows || rows.length === 0) {
                return [];
            }

            // 첫 번째 행은 헤더이므로 제외
            const reservations = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row[0]) { // 좌석번호가 있는 경우만
                    reservations.push({
                        seatNumber: parseInt(row[0]),
                        name: row[1] || '',
                        phone: row[2] || '',
                        location: row[3] || '',
                        paymentStatus: row[4] || 'pending',
                        timestamp: row[5] || ''
                    });
                }
            }

            return reservations;
        } catch (error) {
            console.error('예약 데이터 읽기 실패:', error);
            alert('예약 데이터를 불러오는데 실패했습니다.');
            return null;
        }
    }

    // 스프레드시트에 예약 데이터 저장
    async saveReservation(reservation) {
        if (!this.isSignedIn) {
            const signedIn = await this.signIn();
            if (!signedIn) return false;
        }

        try {
            // 먼저 해당 좌석의 기존 예약이 있는지 확인
            await this.removeReservation(reservation.seatNumber);

            // 새 예약 추가
            const values = [[
                reservation.seatNumber,
                reservation.name,
                reservation.phone,
                reservation.location,
                reservation.paymentStatus,
                new Date().toISOString()
            ]];

            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:F`,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            });

            return true;
        } catch (error) {
            console.error('예약 저장 실패:', error);
            alert('예약 저장에 실패했습니다.');
            return false;
        }
    }

    // 특정 좌석의 예약 삭제
    async removeReservation(seatNumber) {
        if (!this.isSignedIn) return false;

        try {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A:F`,
            });

            const rows = response.result.values;
            if (!rows) return true;

            // 해당 좌석번호의 행 찾기
            for (let i = 1; i < rows.length; i++) {
                if (parseInt(rows[i][0]) === seatNumber) {
                    // 행 삭제
                    await gapi.client.sheets.spreadsheets.batchUpdate({
                        spreadsheetId: this.SPREADSHEET_ID,
                        resource: {
                            requests: [{
                                deleteDimension: {
                                    range: {
                                        sheetId: 0, // 첫 번째 시트
                                        dimension: 'ROWS',
                                        startIndex: i,
                                        endIndex: i + 1
                                    }
                                }
                            }]
                        }
                    });
                    break;
                }
            }

            return true;
        } catch (error) {
            console.error('예약 삭제 실패:', error);
            return false;
        }
    }

    // 모든 예약 삭제
    async clearAllReservations() {
        if (!this.isSignedIn) return false;

        try {
            await gapi.client.sheets.spreadsheets.values.clear({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A2:F`,
            });

            return true;
        } catch (error) {
            console.error('모든 예약 삭제 실패:', error);
            return false;
        }
    }

    // 스프레드시트 초기화 (헤더 생성)
    async initializeSheet() {
        if (!this.isSignedIn) return false;

        try {
            const headers = [['좌석번호', '이름', '전화번호', '탑승지', '입금상태', '예약시간']];
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: this.SPREADSHEET_ID,
                range: `${this.SHEET_NAME}!A1:F1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: headers }
            });

            return true;
        } catch (error) {
            console.error('시트 초기화 실패:', error);
            return false;
        }
    }
}

// 전역 인스턴스 생성
const sheetsAPI = new SheetsAPI();
