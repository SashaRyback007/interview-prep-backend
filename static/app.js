const API_URL = "http://127.0.0.1:8000";
let currentQuestion = null;
let isFlipped = false;
let questionHistory = [];
let historyIndex = -1;

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

async function loadRandomQuestion() {
    // Якщо ми дивилися історію і натиснули "Next", повертаємося до актуального завантаження
    if (historyIndex < questionHistory.length - 1) {
        historyIndex++;
        displayQuestion(questionHistory[historyIndex]);
        return;
    }

    const card = document.getElementById("flashcard");
    if (isFlipped && card) {
        card.classList.remove("rotate-y-180");
        isFlipped = false;
        await new Promise(r => setTimeout(r, 200));
    }

    const token = localStorage.getItem("access_token");

    try {
        const res = await fetch(`${API_URL}/questions/random`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!res.ok) {
            document.getElementById("qTitle").textContent = "No questions available in database";
            return;
        }

        const question = await res.json();
        
        // Зберігаємо питання в історію
        questionHistory.push(question);
        historyIndex = questionHistory.length - 1;
        
        displayQuestion(question);

    } catch (err) {
        console.error("Error loading question:", err);
    }
}

async function loadPreviousQuestion() {
    if (historyIndex <= 0) {
        return; // Якщо це перше питання, далі назад не йдемо
    }

    historyIndex--;
    const question = questionHistory[historyIndex];
    displayQuestion(question);
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
        console.error("Error saving progress:", err);
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
    const newAvatarUrl = document.getElementById("editAvatarUrl").value.trim();
    const defaultAvatar = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150";

    if (newUsername) {
        localStorage.setItem("username", newUsername);
        document.getElementById("usernameDisplay").textContent = newUsername;
    }

    const avatarEl = document.getElementById("userAvatar");
    if (newAvatarUrl) {
        localStorage.setItem("user_avatar", newAvatarUrl);
        avatarEl.src = newAvatarUrl;
    } else {
        localStorage.removeItem("user_avatar");
        avatarEl.src = defaultAvatar;
    }

    avatarEl.onerror = function() {
        this.src = defaultAvatar;
    };

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

function logout() {
    localStorage.clear();
    location.reload();
}