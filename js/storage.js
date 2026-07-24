// Работа с localStorage
const Storage = {
    // Сохранить всех пользователей
    saveUsers(users) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.USERS, JSON.stringify(users));
    },
    
    // Получить всех пользователей
    getUsers() {
        const data = localStorage.getItem(CONFIG.STORAGE_KEYS.USERS);
        return data ? JSON.parse(data) : {};
    },
    
    // Сохранить текущего пользователя
    saveCurrentUser(username) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_USER, username);
    },
    
    // Получить текущего пользователя
    getCurrentUser() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    },
    
    // Очистить текущего пользователя
    clearCurrentUser() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_USER);
    },
    
    // Сохранить контакты пользователя
    saveContacts(username, contacts) {
        const key = CONFIG.STORAGE_KEYS.CONTACTS + '_' + username;
        localStorage.setItem(key, JSON.stringify(contacts));
    },
    
    // Получить контакты пользователя
    getContacts(username) {
        const key = CONFIG.STORAGE_KEYS.CONTACTS + '_' + username;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    
    // Сохранить сообщения чата
    saveMessages(username, partner, messages) {
        const key = CONFIG.STORAGE_KEYS.MESSAGES + '_' + username + '_' + partner;
        localStorage.setItem(key, JSON.stringify(messages));
    },
    
    // Получить сообщения чата
    getMessages(username, partner) {
        const key = CONFIG.STORAGE_KEYS.MESSAGES + '_' + username + '_' + partner;
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    
    // Удалить сообщения чата
    clearMessages(username, partner) {
        const key = CONFIG.STORAGE_KEYS.MESSAGES + '_' + username + '_' + partner;
        localStorage.removeItem(key);
    }
};
