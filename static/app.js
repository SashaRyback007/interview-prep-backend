const API_URL = "http://127.0.0.1:8000";
let currentQuestion = null;
let isFlipped = false;
let questionHistory = [];
let historyIndex = -1;
let currentQuestionId = null;
let currentQuestionData = null;

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");
    if (token) {
        showDashboard();
    }
});

async function handleLogin(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("loginUsername").value;
    const passwordInput = document.getElementById("loginPassword").value;
    const errorEl = document.getElementById("loginError");

    const formData = new URLSearchParams();
    formData.append("username", usernameInput);
    formData.append("password", passwordInput);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData
        });

        if (!res.ok) throw new Error("Invalid username or password");

        const data = await res.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("username", usernameInput);
        
        errorEl.classList.add("hidden");
        showDashboard();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove("hidden");
    }
}

function showDashboard() {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("dashboardSection").classList.remove("hidden");
    document.getElementById("userInfo").classList.remove("hidden");
    
    // Підтягуємо збережені username
    document.getElementById("usernameDisplay").textContent = localStorage.getItem("username") || "sasha";
    
    // Підтягуємо аватарку або ставимо стандартну, якщо завантаження збійне
    const userAvatarEl = document.getElementById("userAvatar");
    const defaultAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";
    const savedAvatar = localStorage.getItem("user_avatar");

    userAvatarEl.src = savedAvatar && savedAvatar.trim() !== "" ? savedAvatar : defaultAvatar;

    // Якщо завантаження URL не вдалося — підставляємо дефолтну аватарку
    userAvatarEl.onerror = function() {
        this.src = defaultAvatar;
    };

    loadStats();
    loadRandomQuestion();
}

async function loadStats() {
    const token = localStorage.getItem("access_token");
    try {
        const res = await fetch(`${API_URL}/stats`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.status === 401) return logout();
        
        const stats = await res.json();
        document.getElementById("statTotal").textContent = stats.total_questions;
        document.getElementById("statNew").textContent = stats.new_count;
        document.getElementById("statLearning").textContent = stats.learning_count;
        document.getElementById("statMastered").textContent = stats.mastered_count;
    } catch (err) {
        console.error("Error loading stats:", err);
    }
}

function flipCard() {
    const card = document.getElementById("flashcard");
    if (!card) return;
    isFlipped = !isFlipped;
    if (isFlipped) {
        card.classList.add("rotate-y-180");
    } else {
        card.classList.remove("rotate-y-180");
    }
}
// 2. Відображення даних питання в картці
function renderQuestion(data) {
    if (!data) return;

    currentQuestionId = data.id;
    currentQuestionData = data;

    // Заповнюємо дані
    const titleEl = document.getElementById("qTitle");
    const answerEl = document.getElementById("qAnswer");
    const categoryEl = document.getElementById("qCategory");
    const difficultyEl = document.getElementById("qDifficulty");

    if (titleEl) titleEl.textContent = data.title;
    
    // Форматування коду у відповіді (якщо є)
    let formattedAnswer = data.answer_text || data.answer || "";
    formattedAnswer = formattedAnswer.replace(/```(python|sql|javascript|js)?\n([\s\S]*?)```/g, function(match, lang, code) {
        const language = lang || 'python';
        return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
    });

    if (answerEl) answerEl.innerHTML = formattedAnswer;

    // Підсвічування коду через Prism.js
    if (window.Prism) {
        Prism.highlightAll();
    }

    if (categoryEl) categoryEl.textContent = `Category #${data.category_id}`;
    if (difficultyEl) difficultyEl.textContent = data.difficulty;

    // Оновлюємо лічильник та іконку зірочки
    if (typeof updateStarUI === "function") updateStarUI();

    // Скидаємо переворот картки на передню сторону
    const flashcard = document.getElementById("flashcard");
    if (flashcard) {
        flashcard.classList.remove("rotate-y-180");
    }
}

// 3. Завантаження наступного/випадкового питання (кнопка Next ➔)
async function loadRandomQuestion() {
    try {
        const categoryId = document.getElementById("filterCategory")?.value || 0;
        const difficulty = document.getElementById("filterDifficulty")?.value || "All";
        
        // Формуємо параметри запиту
        let params = new URLSearchParams();
        if (parseInt(categoryId) > 0) {
            params.append("category_id", categoryId);
        }
        if (difficulty && difficulty !== "All") {
            params.append("difficulty", difficulty);
        }

        const queryString = params.toString() ? `?${params.toString()}` : "";
        const response = await fetch(`/questions/random${queryString}`);

        if (!response.ok) {
            document.getElementById("qTitle").textContent = "No questions found for selected filters!";
            document.getElementById("qAnswer").textContent = "Try changing category or difficulty filters.";
            return;
        }

        const data = await response.json();

        // Додаємо в історію
        if (historyIndex < questionHistory.length - 1) {
            questionHistory = questionHistory.slice(0, historyIndex + 1);
        }
        questionHistory.push(data);
        historyIndex = questionHistory.length - 1;

        renderQuestion(data);

    } catch (error) {
        console.error("Error loading question:", error);
    }
}

// 4. Функція для кнопки ← Back
function loadPreviousQuestion() {
    if (historyIndex > 0) {
        historyIndex--;
        const previousQuestion = questionHistory[historyIndex];
        renderQuestion(previousQuestion);
    } else {
        alert("Це найперше питання у вашій сесії!");
    }
}

// Відображення питання на картці
async function displayQuestion(question) {
    const card = document.getElementById("flashcard");
    if (isFlipped && card) {
        card.classList.remove("rotate-y-180");
        isFlipped = false;
        await new Promise(r => setTimeout(r, 200));
    }

    currentQuestion = question;
    document.getElementById("qTitle").textContent = question.question_text || question.title;
    document.getElementById("qAnswer").textContent = question.answer_text;
    document.getElementById("qDifficulty").textContent = question.difficulty || "Medium";
    document.getElementById("qCategory").textContent = `Category #${question.category_id}`;
    document.getElementById("cardCounter").textContent = `Card ${historyIndex + 1}`;
}

function toggleCreateModal() {
    const modal = document.getElementById("createModal");
    if (modal) {
        modal.classList.toggle("hidden");
    }
}

async function handleCreateQuestion(event) {
    event.preventDefault();
    const token = localStorage.getItem("access_token");

    const categoryIdInput = parseInt(document.getElementById("newCategoryId").value) || 1;

    const payload = {
        question_text: document.getElementById("newTitle").value,
        title: document.getElementById("newTitle").value,
        answer_text: document.getElementById("newAnswer").value,
        category_id: categoryIdInput,
        difficulty: document.getElementById("newDifficulty").value
    };

    try {
        const res = await fetch(`${API_URL}/questions/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById("newTitle").value = "";
            document.getElementById("newAnswer").value = "";
            toggleCreateModal();
            loadStats();
            loadRandomQuestion();
        } else {
            const errData = await res.json();
            console.error("Server error:", errData);
            alert(`Error: ${JSON.stringify(errData.detail || errData)}`);
        }
    } catch (err) {
        console.error("Network error:", err);
    }
}

// Оновлення статусу вивчення питання (Learning / Mastered)
async function updateStatus(newStatus) {
    if (!currentQuestionId) {
        alert("Не вдалося визначити ID питання!");
        return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
        alert("Будь ласка, увійдіть в акаунт!");
        return;
    }

    // Пробуємо відправити статус
    try {
        const response = await fetch("/progress", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question_id: currentQuestionId,
                status: newStatus.toUpperCase() // Наприклад: "LEARNING" або "MASTERED"
            })
        });

        if (response.ok) {
            if (typeof loadStats === "function") loadStats();
            loadRandomQuestion();
        } else {
            const errorData = await response.json();
            // Зрозумілий розбір помилки від FastAPI
            let errorMsg = "Помилка оновлення статусу";
            if (typeof errorData.detail === "string") {
                errorMsg = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                errorMsg = errorData.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join("\n");
            }
            alert(`Помилка: ${errorMsg}`);
        }
    } catch (err) {
        console.error("Error updating question status:", err);
        alert("Сталася помилка при з'єднанні з сервером.");
    }
}

// Перемикач відображення модального вікна редагування профілю
function toggleEditProfileModal() {
    const modal = document.getElementById("editProfileModal");
    if (!modal) return;
    
    const isHidden = modal.classList.contains("hidden");
    if (isHidden) {
        // Підставляємо поточні значення у форму
        document.getElementById("editUsername").value = localStorage.getItem("username") || "";
        document.getElementById("editAvatarUrl").value = localStorage.getItem("user_avatar") || "";
        modal.classList.remove("hidden");
    } else {
        modal.classList.add("hidden");
    }
}

// Збереження даних профілю
function handleSaveProfile(event) {
    event.preventDefault();
    
    const newUsername = document.getElementById("editUsername").value.trim();
    const fileInput = document.getElementById("editAvatarFile");
    let newAvatarUrl = document.getElementById("editAvatarUrl").value.trim();
    const defaultAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";
    const avatarEl = document.getElementById("userAvatar");

    // Збереження імені
    if (newUsername) {
        localStorage.setItem("username", newUsername);
        document.getElementById("usernameDisplay").textContent = newUsername;
    }

    // 1. Якщо обрано файл з комп'ютера
    if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const base64Image = e.target.result;
            localStorage.setItem("user_avatar", base64Image);
            if (avatarEl) avatarEl.src = base64Image;
            fileInput.value = ""; // Очищаємо поле файлу
            toggleEditProfileModal();
        };

        reader.readAsDataURL(file);
        return; // Виходимо, оскільки файл обробляється асинхронно
    }

    // 2. Якщо вказано URL-посилання
    if (newAvatarUrl) {
        if (newAvatarUrl.includes("pinterest.com/pin/")) {
            alert("Ви вставили посилання на сторінку Pinterest! Натисніть правою кнопкою на саму картинку та виберіть 'Копіювати адресу зображення'.");
            return;
        }
        localStorage.setItem("user_avatar", newAvatarUrl);
        if (avatarEl) avatarEl.src = newAvatarUrl;
    } else if (!localStorage.getItem("user_avatar")) {
        localStorage.removeItem("user_avatar");
        if (avatarEl) avatarEl.src = defaultAvatar;
    }

    toggleEditProfileModal();
}
// Відкрити зображення у збільшеному модальному вікні
// Зум зображення з перевіркою на валідність URL
function zoomImage(src) {
    const modal = document.getElementById("imageZoomModal");
    const zoomedImg = document.getElementById("zoomedImage");
    
    if (!modal || !zoomedImg) return;

    // Якщо src це сторінка (наприклад pinterest.com/pin/...), а не прямий файл картинки
    let imageSrc = src;
    if (!imageSrc || imageSrc.includes("pinterest.com/pin/")) {
        imageSrc = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800"; // Запасна якісна картинка для зуму
    }

    zoomedImg.src = imageSrc;

    // Якщо картинка все одно не завантажується — підставляємо дефолтну
    zoomedImg.onerror = function() {
        this.src = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800";
    };

    modal.classList.remove("hidden");
}

function closeImageZoomModal() {
    const modal = document.getElementById("imageZoomModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// Закриття по клавіші ESC
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeImageZoomModal();
    }
});

async function handleDeleteQuestion() {
    if (!currentQuestionId) {
        alert("Не вдалося визначити ID питання!");
        return;
    }

    const confirmDelete = confirm("Ви дійсно хочете видалити це питання?");
    if (!confirmDelete) return;

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`/api/questions/${currentQuestionId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            alert("Питання успішно видалено!");
            if (typeof loadStats === "function") loadStats();
            if (typeof loadRandomQuestion === "function") loadRandomQuestion();
        } else {
            const error = await response.json();
            alert(`Помилка видалення: ${error.detail || "Невідома помилка"}`);
        }
    } catch (err) {
        console.error("Помилка при видаленні:", err);
        alert("Сталася помилка при зверненні до сервера.");
    }
}
function logout() {
    localStorage.clear();
    location.reload();
}
