const API_URL = "http://127.0.0.1:8000";
let currentQuestion = null;

// При завантаженні перевіряємо, чи є токен у localStorage
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("access_token");
    if (token) {
        showDashboard();
    }
});

// Авторизація
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

        if (!res.ok) throw new Error("Невірний логін або пароль");

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

// Показ робочого кабінету
function showDashboard() {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("dashboardSection").classList.remove("hidden");
    document.getElementById("userInfo").classList.remove("hidden");
    document.getElementById("usernameDisplay").textContent = `👤 ${localStorage.getItem("username")}`;

    loadStats();
    loadRandomQuestion();
}

// Завантаження статистики
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
        console.error("Помилка завантаження статистики:", err);
    }
}

// Завантаження випадкового питання
async function loadRandomQuestion() {
    document.getElementById("answerBox").classList.add("hidden");
    try {
        const res = await fetch(`${API_URL}/questions/random`);
        if (!res.ok) {
            document.getElementById("qTitle").textContent = "Питання відсутні у базі даних";
            return;
        }
        currentQuestion = await res.json();
        
        document.getElementById("qTitle").textContent = currentQuestion.title;
        document.getElementById("qAnswer").textContent = currentQuestion.answer_text;
        document.getElementById("qDifficulty").textContent = currentQuestion.difficulty;
        document.getElementById("qCategory").textContent = `ID Категорії: ${currentQuestion.category_id}`;
    } catch (err) {
        console.error("Помилка завантаження питання:", err);
    }
}

// Перемикач відповіді
function toggleAnswer() {
    const answerBox = document.getElementById("answerBox");
    const arrow = document.getElementById("answerArrow");
    
    answerBox.classList.toggle("hidden");
    arrow.classList.toggle("rotate-180");
}

// Оновлення статусу вивчення питання
async function updateStatus(status) {
    if (!currentQuestion) return;
    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch(`${API_URL}/progress`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                question_id: currentQuestion.id,
                status: status
            })
        });

        if (res.ok) {
            loadStats();
            loadRandomQuestion();
        }
    } catch (err) {
        console.error("Помилка збереження прогресу:", err);
    }
}

// Вихід
function logout() {
    localStorage.clear();
    location.reload();
}