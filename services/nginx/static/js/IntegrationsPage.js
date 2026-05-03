class IntegrationsPage {
    constructor() {
        this.urlInput = document.getElementById('spellcheckUrl');
        this.timeoutInput = document.getElementById('spellcheckTimeout');
        this.instructionInput = document.getElementById('spellcheckInstruction');
        this.saveBtn = document.getElementById('saveSpellcheckBtn');
        this.init();
    }

    async init() {
        console.log('IntegrationsPage init');
        await this.loadConfig();
        this.attachEvents();
    }

    async loadConfig() {
        try {
            const response = await api.get('/communicationservice/v1/spellcheck/configuration');
            // ожидаем: { url: "...", timeout: 30, instruction: "..." }
            this.urlInput.value = response.data.url || '';
            this.timeoutInput.value = response.data.timeout || '';
            this.instructionInput.value = response.data.instruction || '';
            console.log('Загружена конфигурация SpellCheck', response.data);
        } catch (error) {
            console.error('Ошибка загрузки конфигурации', error);
            // fallback
            this.urlInput.value = '';
            this.timeoutInput.value = '';
            this.instructionInput.value = '';
        }
    }

    attachEvents() {
        this.saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveConfig();
        });
    }

    async saveConfig() {
        const url = this.urlInput.value.trim();
        const timeout = parseInt(this.timeoutInput.value, 10);
        const instruction = this.instructionInput.value.trim();

        if (!url) {
            alert('Пожалуйста, заполните URL');
            return;
        }
        if (isNaN(timeout) || timeout <= 0) {
            alert('Таймаут должен быть положительным числом');
            return;
        }
        if (!instruction) {
            alert('Инструкция не может быть пустой');
            return;
        }

        try {
            const payload = { url, timeout, instruction };
            console.log('Отправка PATCH', payload);
            await api.patch('/communicationservice/v1/spellcheck/configuration', payload);
            alert('Конфигурация сохранена');
        } catch (error) {
            console.error('Ошибка сохранения', error);
            alert('Не удалось сохранить: ' + (error.response?.data?.message || error.message));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new IntegrationsPage();
});
