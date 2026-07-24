// Конфигурация приложения
const CONFIG = {
    // PeerJS сервер (бесплатный облачный)
    PEER_SERVER: {
        host: '0.peerjs.com',
        port: 443,
        secure: true
    },
    
    // Ограничение на размер файла в байтах (5 МБ)
    MAX_FILE_SIZE: 5 * 1024 * 1024,
    
    // Префикс для PeerJS ID
    PEER_PREFIX: 'lanchat-',
    
    // Ключи для localStorage
    STORAGE_KEYS: {
        USERS: 'lanchat_users',
        CURRENT_USER: 'lanchat_current',
        CONTACTS: 'lanchat_contacts',
        MESSAGES: 'lanchat_messages'
    }
};
