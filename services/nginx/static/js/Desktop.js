class Desktop {
    constructor(contactId) {
        this.contactId = contactId;
        this.API_ROUTES = {
            sms: "/v1/send/sms",
        };
        this.sendChannel = "sms";

        this.chatTextArea = document.querySelector('.chat_input_field');
        this.chatSendButton = document.querySelector('.chat_send_button');

        this.tokenIdempotency = self.crypto.randomUUID();

        this.init();
    }

    autoResize(item) {
        const target = item.target || item;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
        target.scrollTop = target.scrollHeight;
    }

    setTextItemValue(item, value) {
        item.value = value;
        this.autoResize(item);
    }

    init() {
        this.autoResize(this.chatTextArea);

        this.chatTextArea.addEventListener('input', (e) => this.autoResize(e.target));
        this.chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyI') {
                e.preventDefault();
                this.chatTextArea.focus();
                this.chatTextArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        this.chatSendButton.addEventListener('click', () => this.sendChatMessage());
    }

    async sendChatMessage() {
        this.chatSendButton.disabled = true;
        this.chatTextArea.disabled = true;

        const messageText = this.chatTextArea.value;
        if (!messageText.trim()) {
            this.chatSendButton.disabled = false;
            this.chatTextArea.disabled = false;
            return;
        }

        try {
            const payload = {
                contactId: this.contactId,
                text: messageText,
            };

            const response = await postWithIdempotency("/communicationservice" + this.API_ROUTES[this.sendChannel], payload, this.tokenIdempotency);
            console.log("Response data:", response);
            this.setTextItemValue(this.chatTextArea, "");
        } catch (e) {
            console.log("Something went wrong", e);
            if (e.response) {
                console.log("Server error:", e.response.status);
                console.log("Details:", e.response.data);
                this.showAlert("Что-то пошло не так. Попробуйте позже");
            } else if (e.request) {
                console.log("Connection error");
                this.showAlert("Связь прервалась. Не удалось подтвердить отправку. Проверьте историю чуть позже, затем попробуйте еще раз");
            } else {
                console.log("Error of message forming");
                this.showAlert("Что-то пошло не так. Попробуйте позже, если ошибка не уйдет, обратитесь в техническую поддержку");
            }
        }

        this.tokenIdempotency = self.crypto.randomUUID();
        this.chatTextArea.disabled = false;
        this.chatSendButton.disabled = false;
        this.chatTextArea.focus();
    }

    showAlert(message) {
        alert(message);
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId');
    if (!contactId) {
        console.warn('Не передан contactId. Выберите контакт на странице контактов.');
        // Можно показать сообщение пользователю
        alert('Выберите контакт, чтобы начать общение');
        window.location.href = '/contacts.html';
        return;
    }
    new Desktop(contactId);
});
