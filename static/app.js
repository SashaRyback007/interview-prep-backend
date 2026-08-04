const API_URL = "http://127.0.0.1:8000";
let currentQuestion = null;
let isFlipped = false;
let questionHistory = [];
let historyIndex = -1;
let currentQuestionId = null;
let currentQuestionData = null;
let timerInterval = null;
let secondsPassed = 0;

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
    
    // Avatar inputs
    const avatarFile = document.getElementById("editAvatarFile").files[0];
    const avatarUrl = document.getElementById("editAvatarUrl").value.trim();
    const avatarEl = document.getElementById("userAvatar");

    // Banner inputs
    const bannerFile = document.getElementById("editBannerFile").files[0];
    const bannerUrl = document.getElementById("editBannerUrl").value.trim();
    const heroBanner = document.getElementById("heroBanner");

    if (newUsername) {
        localStorage.setItem("username", newUsername);
        document.getElementById("usernameDisplay").textContent = newUsername;
    }

    // Збереження аватарки
    if (avatarFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            localStorage.setItem("user_avatar", e.target.result);
            if (avatarEl) avatarEl.src = e.target.result;
        };
        reader.readAsDataURL(avatarFile);
    } else if (avatarUrl) {
        localStorage.setItem("user_avatar", avatarUrl);
        if (avatarEl) avatarEl.src = avatarUrl;
    }

    // Збереження банера
    if (bannerFile) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Banner = e.target.result;
            localStorage.setItem("user_banner", base64Banner);
            if (heroBanner) heroBanner.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url('${base64Banner}')`;
        };
        reader.readAsDataURL(bannerFile);
    } else if (bannerUrl) {
        localStorage.setItem("user_banner", bannerUrl);
        if (heroBanner) heroBanner.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url('${bannerUrl}')`;
    }

    toggleEditProfileModal();
}

// Додаємо виклики в DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadSavedBanner();
});
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

function updateStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastVisit = localStorage.getItem("last_active_date");
    let streak = parseInt(localStorage.getItem("daily_streak") || "1");

    if (!lastVisit) {
        streak = 1;
    } else if (lastVisit !== today) {
        const lastDate = new Date(lastVisit);
        const currentDate = new Date(today);
        const diffTime = Math.abs(currentDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak += 1; // Продовження стріку
        } else if (diffDays > 1) {
            streak = 1;  // Пропущено день, перезапуск
        }
    }

    localStorage.setItem("last_active_date", today);
    localStorage.setItem("daily_streak", streak.toString());

    const streakEl = document.getElementById("statStreak");
    if (streakEl) {
        streakEl.innerHTML = `${streak} <span class="text-xs text-slate-400 font-normal">days</span>`;
    }
}

// 2. Таймер для картки
function startTimer() {
    clearInterval(timerInterval);
    secondsPassed = 0;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        secondsPassed++;
        updateTimerDisplay();
    }, 1000);
}

function resetTimer() {
    startTimer();
}

function updateTimerDisplay() {
    const minutes = Math.floor(secondsPassed / 60).toString().padStart(2, '0');
    const seconds = (secondsPassed % 60).toString().padStart(2, '0');
    const timerEl = document.getElementById("timerDisplay");
    if (timerEl) {
        timerEl.textContent = `${minutes}:${seconds}`;
    }
}

// 3. Оновлення Прогрес-бару та статистики
async function loadStats() {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const response = await fetch("/stats", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.status === 401) {
            // Токен застарів — очищаємо та просимо увійти знову
            localStorage.removeItem("access_token");
            console.warn("Session expired. Please log in again.");
            // Перенаправлення / відкриття модалки логіну якщо є
            if (typeof toggleLoginModal === "function") toggleLoginModal();
            return;
        }

        if (!response.ok) return;

        const data = await response.json();

        document.getElementById("statTotal").textContent = data.total_questions;
        document.getElementById("statNew").textContent = data.new_count;
        document.getElementById("statLearning").textContent = data.learning_count;
        document.getElementById("statMastered").textContent = data.mastered_count;

        const percent = data.progress_percentage || 0;
        const barFill = document.getElementById("progressBarFill");
        const percentText = document.getElementById("progressPercentageText");

        if (barFill) barFill.style.width = `${percent}%`;
        if (percentText) percentText.textContent = `${percent}%`;

    } catch (err) {
        console.error("Error loading stats:", err);
    }
}
// Усередині функції renderQuestion(data):
startTimer();
function logout() {
    localStorage.clear();
    location.reload();
}
// Викликаємо оновлення статистики, категорій та стріку після завантаження сторінки
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");
    if (token) {
        if (typeof updateStreak === "function") updateStreak();
        if (typeof loadStats === "function") loadStats();
        if (typeof loadCategoriesDropdown === "function") loadCategoriesDropdown();
        if (typeof loadRandomQuestion === "function") loadRandomQuestion();
    }
});
// ==================== THEME TOGGLE LOGIC ====================

function initTheme() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    applyTheme(savedTheme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem("theme") || "dark";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
}

function applyTheme(theme) {
    const body = document.body;
    const themeIcon = document.getElementById("themeIcon");

    if (theme === "light") {
        body.classList.remove("bg-[#0b0e14]", "text-slate-100");
        body.classList.add("bg-slate-100", "text-slate-900");
        if (themeIcon) themeIcon.textContent = "🌙";
    } else {
        body.classList.remove("bg-slate-100", "text-slate-900");
        body.classList.add("bg-[#0b0e14]", "text-slate-100");
        if (themeIcon) themeIcon.textContent = "☀️";
    }
}

// ==================== BANNER & PROFILE LOGIC ====================

function loadSavedBanner() {
    const bannerUrl = localStorage.getItem("user_banner");
    const heroBanner = document.getElementById("heroBanner");
    if (heroBanner && bannerUrl) {
        heroBanner.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.7)), url('${bannerUrl}')`;
    }
}