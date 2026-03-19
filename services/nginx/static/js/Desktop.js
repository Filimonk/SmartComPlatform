class Desktop {
    constructor(chatId) {
        this.API_ROUTES = {
            sms: "/v1/send/sms",
        };
        this.sendChannel = "sms";
        
        this.chatTextArea = document.querySelector('.chat_input_field');
        this.chatSendButton = document.querySelector('.chat_send_button');
        
        this._chatId = chatId;
        
        this.tokenIdempotency;
        this.updateTokenIdempotency();

        this.init();
    }
    
    updateTokenIdempotency() {
        this.tokenIdempotency = self.crypto.randomUUID();
    }

    autoResize(item) {
        // Проверка, что item передан (для работы через addEventListener)
        // чтобы могли вызывать и с событием (addEventListner) и просто с объектом (например, chatTextArea)
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
        
        
        // ================== Bind hotkeys ================== //

        // Изменение высоты
        this.chatTextArea.addEventListener('input', (e) => this.autoResize(e.target));

        // Отправка по Ctrl+Enter (внутри поля)
        this.chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });

        // Глобальный хоткей для фокуса (например, Alt + I)
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyI') {
                e.preventDefault();
                this.chatTextArea.focus();

                // прокрутка к полю, если страница длинная
                this.chatTextArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        this.chatSendButton.addEventListener('click', () => {
            this.sendChatMessage();
        });
    }

    async sendChatMessage() {
        this.chatSendButton.disabled = true;
        this.chatTextArea.disabled = true;

        console.log("Send:", this.chatTextArea.value);

        try {
            const payload = {
                chatId: this._chatId,
                text: this.chatTextArea.value,
            };
            
            const response = await postWithIdempotency("/communicationservice" + this.API_ROUTES[this.sendChannel], payload, this.tokenIdempotency);
            
            console.log("Response data:", response);
            this.setTextItemValue(this.chatTextArea, "");
        } catch (e) {
            console.log("Something went wrong");
            
            if (e.response) {
                console.log("Server error:", e.response.status);
                console.log("Details:", e.response.data);
                
                this.showAlert("Что-то пошло не так. Попробуйте позже");
            } else if (e.request) {
                console.log("Conection error");
                
                this.showAlert("Связь прервалась. Не удалось подтвердить отправку. Проверьте историю чуть позже, затем попробуйте еще раз");
            } else {
                console.log("Error of message forming");
                
                this.showAlert("Что-то пошло не так. Попробуйте позже, если ошибка не уйдет, обратитесь в техническую поддержку");
            }
        }

        this.updateTokenIdempotency();
        this.chatTextArea.disabled = false;
        this.chatSendButton.disabled = false;
        this.chatTextArea.focus();
    }
    
    showAlert(message) {
        // надо будет потом поменять на модальное окошко с сообщением
        alert(message);
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new Desktop(515);
});

