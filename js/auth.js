// Авторизация
const Auth = {
    currentUser: null,
    
    init() {
        // Проверяем, есть ли сохранённый пользователь
        const saved = Storage.getCurrentUser();
        if (saved) {
            this.currentUser = saved;
            this.showChat();
            return;
        }
        
        this.showAuth();
        this.bindEvents();
    },
    
    bindEvents() {
        // Переключение вкладок
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                const formType = e.target.dataset.tab;
                document.getElementById('login-form').classList.toggle('hidden', formType !== 'login');
                document.getElementById('register-form').classList.toggle('hidden', formType !== 'register');
            });
        });
        
        // Форма входа
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        // Форма регистрации
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });
    },
    
    login() {
        const username = document.getElementById('login-user').value.trim().toLowerCase();
        const password = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');
        
        if (!username || !password) {
            errorEl.textContent = 'Заполните все поля';
            errorEl.classList.remove('hidden');
            return;
        }
        
        const users = Storage.getUsers();
        
        if (!users[username]) {
            errorEl.textContent = 'Пользователь не найден';
            errorEl.classList.remove('hidden');
            return;
        }
        
        // Простой хеш (в реальном проекте нужен crypto.subtle)
        const hash = this.simpleHash(password);
        
        if (users[username] !== hash) {
            errorEl.textContent = 'Неверный пароль';
            errorEl.classList.remove('hidden');
            return;
        }
        
        errorEl.classList.add('hidden');
        this.currentUser = username;
        Storage.saveCurrentUser(username);
        this.showChat();
    },
    
    register() {
        const username = document.getElementById('reg-user').value.trim().toLowerCase();
        const password = document.getElementById('reg-pass').value;
        const password2 = document.getElementById('reg-pass2').value;
        const errorEl = document.getElementById('reg-error');
        
        if (!username || !password) {
            errorEl.textContent = 'Заполните все поля';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (username.length < 3) {
            errorEl.textContent = 'Логин должен быть не менее 3 символов';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (password.length < 4) {
            errorEl.textContent = 'Пароль должен быть не менее 4 символов';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (password !== password2) {
            errorEl.textContent = 'Пароли не совпадают';
            errorEl.classList.remove('hidden');
            return;
        }
        
        if (!/^[a-z0-9_]+$/.test(username)) {
            errorEl.textContent = 'Логин: только латиница, цифры и _';
            errorEl.classList.remove('hidden');
            return;
        }
        
        const users = Storage.getUsers();
        
        if (users[username]) {
            errorEl.textContent = 'Пользователь уже существует';
            errorEl.classList.remove('hidden');
            return;
        }
        
        users[username] = this.simpleHash(password);
        Storage.saveUsers(users);
        
        errorEl.classList.add('hidden');
        this.currentUser = username;
        Storage.saveCurrentUser(username);
        this.showChat();
    },
    
    logout() {
        this.currentUser = null;
        Storage.clearCurrentUser();
        PeerManager.disconnect();
        Chat.reset();
        this.showAuth();
    },
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'h_' + Math.abs(hash).toString(36);
    },
    
    showAuth() {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('chat-screen').classList.add('hidden');
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('reg-error').classList.add('hidden');
    },
    
    showChat() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('current-user').textContent = '👤 ' + this.currentUser;
        
        Chat.init(this.currentUser);
    }
};
