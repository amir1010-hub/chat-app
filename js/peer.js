// WebRTC соединение через PeerJS
const PeerManager = {
    peer: null,
    connections: {},  // partner -> DataConnection
    currentPartner: null,
    onMessage: null,
    onStatusChange: null,
    
    init(username) {
        this.username = username;
        const peerId = CONFIG.PEER_PREFIX + username;
        
        this.peer = new Peer(peerId, CONFIG.PEER_SERVER);
        
        this.peer.on('open', (id) => {
            console.log('PeerJS подключён:', id);
        });
        
        // Входящее соединение
        this.peer.on('connection', (conn) => {
            this.setupConnection(conn);
        });
        
        this.peer.on('error', (err) => {
            console.error('PeerJS ошибка:', err);
        });
    },
    
    setupConnection(conn) {
        const partner = conn.peer.replace(CONFIG.PEER_PREFIX, '');
        
        conn.on('open', () => {
            console.log('Соединение установлено с:', partner);
            this.connections[partner] = conn;
            this.currentPartner = partner;
            
            if (this.onStatusChange) {
                this.onStatusChange(partner, 'online');
            }
        });
        
        conn.on('data', (data) => {
            if (this.onMessage) {
                this.onMessage(partner, data);
            }
        });
        
        conn.on('close', () => {
            console.log('Соединение закрыто:', partner);
            delete this.connections[partner];
            if (this.currentPartner === partner) {
                this.currentPartner = null;
            }
            if (this.onStatusChange) {
                this.onStatusChange(partner, 'offline');
            }
        });
        
        conn.on('error', (err) => {
            console.error('Ошибка соединения:', err);
        });
    },
    
    connectTo(partner) {
        if (this.connections[partner]) {
            // Уже подключены
            this.currentPartner = partner;
            if (this.onStatusChange) {
                this.onStatusChange(partner, 'online');
            }
            return;
        }
        
        const peerId = CONFIG.PEER_PREFIX + partner;
        const conn = this.peer.connect(peerId, {
            reliable: true
        });
        
        this.setupConnection(conn);
    },
    
    send(data) {
        if (!this.currentPartner) return false;
        
        const conn = this.connections[this.currentPartner];
        if (!conn || !conn.open) return false;
        
        try {
            conn.send(data);
            return true;
        } catch(e) {
            console.error('Ошибка отправки:', e);
            return false;
        }
    },
    
    disconnect() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.connections = {};
        this.currentPartner = null;
    }
};
