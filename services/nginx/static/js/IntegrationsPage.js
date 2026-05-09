class IntegrationsPage {
    constructor() {
        // SpellCheck элементы
        this.spellcheckUrl = document.getElementById('spellcheckUrl');
        this.spellcheckTimeout = document.getElementById('spellcheckTimeout');
        this.spellcheckInstruction = document.getElementById('spellcheckInstruction');
        this.spellcheckSaveBtn = document.getElementById('saveSpellcheckBtn');

        // TaskPropose элементы (новые)
        this.taskproposeUrl = document.getElementById('taskproposeUrl');
        this.taskproposeTimeout = document.getElementById('taskproposeTimeout');
        this.taskproposeInstruction = document.getElementById('taskproposeInstruction');
        this.taskproposeSaveBtn = document.getElementById('saveTaskproposeBtn');

        this.init();
    }

    async init() {
        console.log('IntegrationsPage init');
        await Promise.all([
            this.loadConfig('spellcheck'),
            this.loadConfig('taskpropose')
        ]);
        this.attachEvents();
    }

    async loadConfig(type) {
        const endpoint = type === 'spellcheck'
            ? '/communicationservice/v1/spellcheck/configuration'
            : '/communicationservice/v1/task/propose/configuration';

        try {
            const response = await api.get(endpoint);
            const data = response.data;
            if (type === 'spellcheck') {
                this.spellcheckUrl.value = data.url || '';
                this.spellcheckTimeout.value = data.timeout || '';
                this.spellcheckInstruction.value = data.instruction || '';
            } else {
                this.taskproposeUrl.value = data.url || '';
                this.taskproposeTimeout.value = data.timeout || '';
                this.taskproposeInstruction.value = data.instruction || '';
            }
            console.log(`Загружена конфигурация ${type}`, data);
        } catch (error) {
            console.error(`Ошибка загрузки конфигурации ${type}`, error);
            // fallback – пустые поля
            if (type === 'spellcheck') {
                this.spellcheckUrl.value = '';
                this.spellcheckTimeout.value = '';
                this.spellcheckInstruction.value = '';
            } else {
                this.taskproposeUrl.value = '';
                this.taskproposeTimeout.value = '';
                this.taskproposeInstruction.value = '';
            }
        }
    }

    attachEvents() {
        this.spellcheckSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveConfig('spellcheck');
        });
        this.taskproposeSaveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.saveConfig('taskpropose');
        });
    }

    async saveConfig(type) {
        let url, timeout, instruction;
        if (type === 'spellcheck') {
            url = this.spellcheckUrl.value.trim();
            timeout = parseInt(this.spellcheckTimeout.value, 10);
            instruction = this.spellcheckInstruction.value.trim();
        } else {
            url = this.taskproposeUrl.value.trim();
            timeout = parseInt(this.taskproposeTimeout.value, 10);
            instruction = this.taskproposeInstruction.value.trim();
        }

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

        const endpoint = type === 'spellcheck'
            ? '/communicationservice/v1/spellcheck/configuration'
            : '/communicationservice/v1/task/propose/configuration';
        const payload = { url, timeout, instruction };

        try {
            console.log(`Отправка PATCH для ${type}`, payload);
            await api.patch(endpoint, payload);
            alert(`Конфигурация ${type === 'spellcheck' ? 'SpellCheck' : 'TaskPropose'} сохранена`);
        } catch (error) {
            console.error(`Ошибка сохранения ${type}`, error);
            alert('Не удалось сохранить: ' + (error.response?.data?.message || error.message));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new IntegrationsPage();
});
