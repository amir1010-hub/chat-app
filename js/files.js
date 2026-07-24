// Обработка файлов
const FileHandler = {
    selectedFile: null,
    
    init() {
        const fileInput = document.getElementById('file-input');
        const filePreview = document.getElementById('file-preview');
        const filePreviewName = document.getElementById('file-preview-name');
        const filePreviewClear = document.getElementById('file-preview-clear');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (file.size > CONFIG.MAX_FILE_SIZE) {
                alert('Файл слишком большой! Максимальный размер: 5 МБ.');
                fileInput.value = '';
                return;
            }
            
            this.selectedFile = file;
            filePreviewName.textContent = `📎 ${file.name} (${this.formatSize(file.size)})`;
            filePreview.classList.remove('hidden');
        });
        
        filePreviewClear.addEventListener('click', () => {
            this.clearFile();
        });
    },
    
    clearFile() {
        this.selectedFile = null;
        document.getElementById('file-input').value = '';
        document.getElementById('file-preview').classList.add('hidden');
    },
    
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    },
    
    isImage(dataUrl) {
        return dataUrl.startsWith('data:image/');
    },
    
    getFileIcon(mimeType) {
        if (mimeType.startsWith('image/')) return '🖼️';
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
        return '📎';
    }
};
