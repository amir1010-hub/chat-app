// Интерфейс чата
const Chat = {
    username: null,
    currentPartner: null,
    
    init(username) {
        this.username = username;
        
        // Инициализируем PeerJS
        PeerManager.init(username);
        
        // Обработчик входящих сообщений
        PeerManager.onMessage = (partner, data) => {
            if (partner !== this.currentPartner) return;
            
            this.displayMessage({
                type: data.type,
                content: data.content,
                fileName: data.fileName,
                fileType: data.fileType,
                time: data.time,
                sent: false
            });
            
            // Сохраняем текст в историю
            if (data.type === 'text') {
                this.saveToHistory(partner, {
                    type: 'text',
                    content: data.content,
                    time: data.time,
                    sent: false
                });
            }
        };
        
        // Обработчик статуса
        PeerManager.onStatusChange = (partner, status) => {
            if (partner === this.currentPartner) {
                this.updateConnectionStatus(status);
            }
        };
        
        // Обработчики интерфейса
        FileHandler.init();
        this.bindUI();
        
        // Загружаем контакты
        this.loadContacts();
    },
    
    bindUI() {
        // Добавление контакта
        document.getElementById('add-contact-btn').addEventListener('click', () => {
            this.addContact();
        });
        document.getElementById('contact-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addContact();
        });
        
        // Отправка сообщения
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });
        document.getElementById('msg-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        // Выход
        document.getElementById('logout-btn').addEventListener('click', () => {
            Auth.logout();
        });
    },
    
    // КОНТАКТЫ
    loadContacts() {
        const contacts = Storage.getContacts(this.username);
        const list = document.getElementById('contacts-list');
        list.innerHTML = '';
        
        contacts.forEach(contact => {
            this.renderContact(contact);
        });
    },
    
    addContact() {
        const input = document.getElementById('contact-input');
        const contact = input.value.trim().toLowerCase();
        const errorEl = document.getElementById('contacts-error');
        
        if (!contact) return;
        
        if (contact === this.username) {
            errorEl.textContent = 'Нельзя добавить себя';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (!/^[a-z0-9_]+$/.test(contact)) {
            errorEl.textContent = 'Неверный формат логина';
            errorEl.classList.remove('hidden');
            return;
        }
        
        const contacts = Storage.getContacts(this.username);
        
        if (contacts.includes(contact)) {
            errorEl.textContent = 'Контакт уже добавлен';
            errorEl.classList.remove('hidden');
            return;
        }
        
        contacts.push(contact);
        Storage.saveContacts(this.username, contacts);
        
        this.renderContact(contact);
        input.value = '';
        errorEl.classList.add('hidden');
    },
    
    renderContact(contact) {
        const list = document.getElementById('contacts-list');
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.innerHTML = `
            <span>👤 ${contact}</span>
            <span class="delete-contact" data-contact="${contact}">✕</span>
        `;
        
        div.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-contact')) {
                this.deleteContact(contact);
                return;
            }
            this.openChat(contact);
        });
        
        list.appendChild(div);
    },
    
    deleteContact(contact) {
        const contacts = Storage.getContacts(this.username).filter(c => c !== contact);
        Storage.saveContacts(this.username, contacts);
        
        if (this.currentPartner === contact) {
            this.closeChat();
        }
        
        this.loadContacts();
    },
    
    // ЧАТ
    openChat(partner) {
        this.currentPartner = partner;
        
        // Показываем окно чата
        document.getElementById('chat-placeholder').classList.add('hidden');
        document.getElementById('chat-window').classList.remove('hidden');
        document.getElementById('chat-partner').textContent = '💬 ' + partner;
        
        // Подсвечиваем активный контакт
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
        const contactItems = document.querySelectorAll('.contact-item');
        contactItems.forEach(el => {
            if (el.textContent.includes(partner)) el.classList.add('active');
        });
        
        // Загружаем историю
        this.loadHistory(partner);
        
        // Подключаемся
        this.updateConnectionStatus('connecting');
        PeerManager.connectTo(partner);
        
        document.getElementById('msg-input').focus();
    },
    
    closeChat() {
        this.currentPartner = null;
        PeerManager.currentPartner = null;
        
        document.getElementById('chat-placeholder').classList.remove('hidden');
        document.getElementById('chat-window').classList.add('hidden');
        document.getElementById('messages').innerHTML = '';
        
        document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    },
    
    updateConnectionStatus(status) {
        const el = document.getElementById('connection-status');
        el.classList.remove('status-online', 'status-offline', 'status-connecting');
        
        switch(status) {
            case 'online':
                el.classList.add('status-online');
                el.textContent = '🟢';
                break;
            case 'connecting':
                el.classList.add('status-connecting');
                el.textContent = '🟡';
                break;
            default:
                el.classList.add('status-offline');
                el.textContent = '⚫';
        }
    },
    
    // ИСТОРИЯ
    loadHistory(partner) {
        const messages = Storage.getMessages(this.username, partner);
        const container = document.getElementById('messages');
        container.innerHTML = '';
        
        messages.forEach(msg => {
            this.displayMessage({
                type: msg.type,
                content: msg.content,
                fileName: msg.fileName,
                fileType: msg.fileType,
                time: msg.time,
                sent: msg.sent
            });
        });
    },
    
    saveToHistory(partner, msg) {
        const messages = Storage.getMessages(this.username, partner);
        messages.push(msg);
        
        // Ограничим историю 500 сообщениями
        if (messages.length > 500) {
            messages.splice(0, messages.length - 500);
        }
        
        Storage.saveMessages(this.username, partner, messages);
    },
    
    // ОТПРАВКА
    async sendMessage() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        const hasFile = FileHandler.selectedFile !== null;
        
        if (!text && !hasFile) return;
        if (!this.currentPartner) return;
        
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        if (hasFile) {
            // Отправляем файл
            const file = FileHandler.selectedFile;
            const base64 = await FileHandler.fileToBase64(file);
            
            const fileMsg = {
                type: 'file',
                content: base64,
                fileName: file.name,
                fileType: file.type,
                time: time
            };
            
            PeerManager.send(fileMsg);
            
            this.displayMessage({ ...fileMsg, sent: true });
            
            FileHandler.clearFile();
        }
        
        if (text) {
            // Отправляем текст
            const textMsg = {
                type: 'text',
                content: text,
                time: time
            };
            
            PeerManager.send(textMsg);
            
            this.displayMessage({ ...textMsg, sent: true });
            
            // Сохраняем в историю
            this.saveToHistory(this.currentPartner, {
                type: 'text',
                content: text,
                time: time,
                sent: true
            });
        }
        
        input.value = '';
        input.focus();
        
        // Прокрутка вниз
        const messages = document.getElementById('messages');
        messages.scrollTop = messages.scrollHeight;
    },
    
    // ОТОБРАЖЕНИЕ
    displayMessage(msg) {
        const container = document.getElementById('messages');
        const div = document.createElement('div');
        div.className = 'message ' + (msg.sent ? 'sent' : 'received');
        
        if (msg.type === 'text') {
            div.innerHTML = `
                <div class="msg-text">${this.escapeHtml(msg.content)}</div>
                <div class="msg-time">${msg.time}</div>
            `;
        } else if (msg.type === 'file') {
            const isImage = msg.fileType && msg.fileType.startsWith('image/');
            const icon = isImage ? '' : FileHandler.getFileIcon(msg.fileType || '');
            
            div.innerHTML = `
                <div class="msg-file" onclick="Chat.downloadFile('${msg.content.replace(/'/g, "\\'")}', '${msg.fileName}')">
                    ${isImage 
                        ? `<img src="${msg.content}" alt="${msg.fileName}" loading="lazy">`
                        : `<span class="file-icon">${icon}</span>`
                    }
                    <span class="file-name">${msg.fileName || 'Файл'}</span>
                </div>
                <div class="msg-time">${msg.time}</div>
            `;
            
            // Ограничение: не сохраняем файлы в историю
        }
        
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    downloadFile(base64, fileName) {
        const link = document.createElement('a');
        link.href = base64;
        link.download = fileName || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    reset() {
        this.currentPartner = null;
        this.username = null;
        document.getElementById('messages').innerHTML = '';
        document.getElementById('contacts-list').innerHTML = '';
        document.getElementById('chat-placeholder').classList.remove('hidden');
        document.getElementById('chat-window').classList.add('hidden');
        FileHandler.clearFile();
    }
};
