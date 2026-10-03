// ================== USER REGISTER/LOGIN ==================
let users = JSON.parse(localStorage.getItem("users")) || {};
let submittedQuizzes = JSON.parse(localStorage.getItem("submittedQuizzes")) || [];
let quizSets = JSON.parse(localStorage.getItem("quizSets")) || {};
let leaderboard = JSON.parse(localStorage.getItem("leaderboard")) || [];
let results = JSON.parse(localStorage.getItem("results")) || [];
let practiceMode = false;

const registerContainer = document.getElementById("register-container");
const loginContainer = document.getElementById("login-container");
const quizSelection = document.getElementById("quiz-selection");
const quizContainer = document.getElementById("quiz-container");
const leaderboardContainer = document.getElementById("leaderboard-container");
const adminContainer = document.getElementById("admin-container");

const userNameSpan = document.getElementById("user-name");
const questionBox = document.getElementById("question-box");
const optionsBox = document.getElementById("options-box");
const scoreBoard = document.getElementById("score-board");
const timerBox = document.getElementById("timer");
const nextBtn = document.getElementById("next-btn");
const leaderboardList = document.getElementById("leaderboard-list");
const backToLogin = document.getElementById("back-to-login");
const adminOutput = document.getElementById("admin-output");

const registerBtn = document.getElementById("register-btn");
const loginBtn = document.getElementById("login-btn");
const goLogin = document.getElementById("go-login");
const goRegister = document.getElementById("go-register");

// Sounds
const correctSound = new Audio("sounds/correct.mp3");
const wrongSound = new Audio("sounds/wrong.mp3");
const timeUpSound = new Audio("sounds/timeup.mp3");
const timerStartSound = new Audio("sounds/timerstart.mp3");

// Register
registerBtn.onclick = () => {
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;
  if(username && password) {
    users[username] = password;
    localStorage.setItem("users", JSON.stringify(users));
    alert("Registration successful! Please login.");
    registerContainer.style.display = "none";
    loginContainer.style.display = "block";
  } else {
    alert("Enter both name and password!");
  }
};

// Login
loginBtn.onclick = () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  if(username === "admin" && password === "12345") {
    loginContainer.style.display = "none";
    adminContainer.style.display = "block";
    refreshQuizDropdown();
    showQuizzes();
    return;
  }

  if(users[username] && users[username] === password) {
    loginContainer.style.display = "none";
    quizSelection.style.display = "block";
    userNameSpan.textContent = username;
    showAvailableQuizzes();
  } else {
    alert("Invalid login! Please register first.");
  }
};

goLogin.onclick = () => {
  registerContainer.style.display = "none";
  loginContainer.style.display = "block";
};
goRegister.onclick = () => {
  loginContainer.style.display = "none";
  registerContainer.style.display = "block";
};

// ================== QUIZ SYSTEM ==================
let currentQuiz = [];
let currentQuizName = "";
let currentIndex = 0;
let score = 0;
let timer;

function showAvailableQuizzes() {
  const quizList = document.getElementById("quiz-list");
  quizList.innerHTML = "";
  const now = new Date();

  for(let quizName in quizSets) {
    const quiz = quizSets[quizName];
    const start = new Date(quiz.start);
    const end = new Date(quiz.end);

    let status = "";
    if(now < start) status = "Upcoming";
    else if(now >= start && now <= end) status = "Live";
    else status = "Expired";

    const card = document.createElement("div");
    card.classList.add("quiz-card");
    card.innerHTML = `<h2>${quizName}</h2>
                      <p>Status: ${status}</p>
                      <p>Start: ${quiz.start}</p>
                      <p>End: ${quiz.end}</p>
                      <p>Duration: ${quiz.duration} minutes</p>`;
    card.onclick = () => startQuiz(quizName);
    quizList.appendChild(card);
  }
}

function startQuiz(type) {
  if(submittedQuizzes.includes(type)) {
    practiceMode = true;
    alert("You have already submitted this quiz. Practice Mode enabled!");
  } else {
    practiceMode = false;
  }

  currentQuiz = quizSets[type].questions;
  currentQuizName = type;
  currentIndex = 0;
  score = 0;
  quizSelection.style.display = "none";
  quizContainer.style.display = "block";
  loadQuestion();

  let quizDuration = quizSets[type].duration || 15;
  setTimeout(() => {
    if(!practiceMode) {
      alert("Quiz duration ended!");
      finishQuiz();
    }
  }, quizDuration * 60 * 1000);
}

function loadQuestion() {
  const q = currentQuiz[currentIndex];
  questionBox.textContent = q.q;
  optionsBox.innerHTML = "";
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.classList.add("option");
    btn.onclick = () => checkAnswer(btn, q.answer);
    optionsBox.appendChild(btn);
  });
  resetTimer();
}

function checkAnswer(btn, correct) {
  if (btn.textContent === correct) {
    btn.classList.add("correct");
    correctSound.play();
    if(!practiceMode) score++;
  } else {
    btn.classList.add("wrong");
    wrongSound.play();
  }

  if(!practiceMode) {
    scoreBoard.textContent = "Score: " + score;
    clearInterval(timer);
  } else {
    setTimeout(() => nextQuestion(), 1000);
  }
}

function resetTimer() {
  let timeLeft = 15;
  timerBox.textContent = "Time: " + timeLeft;
  clearInterval(timer);
  timerStartSound.play();
  timer = setInterval(() => {
    timeLeft--;
    timerBox.textContent = "Time: " + timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timer);
      timeUpSound.play();
      nextQuestion();
    }
  }, 1000);
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < currentQuiz.length) {
    questionBox.classList.add("flip");
    setTimeout(() => {
      questionBox.classList.remove("flip");
      loadQuestion();
    }, 600);
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  questionBox.textContent = "Quiz Finished!";
  optionsBox.innerHTML = "";
  nextBtn.style.display = "none";

  if(!practiceMode) {
    const username = userNameSpan.textContent;
    saveResult(username, currentQuizName, score);
    submittedQuizzes.push(currentQuizName);
    localStorage.setItem("submittedQuizzes", JSON.stringify(submittedQuizzes));
  }
}

// ================== LEADERBOARD ==================
function saveResult(username, quizName, score) {
  results.push({username, quiz: quizName, score});
  leaderboard.push({username, score});
  localStorage.setItem("results", JSON.stringify(results));
  localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
  showLeaderboard();
}

function showLeaderboard() {
  quizContainer.style.display = "none";
  leaderboardContainer.style.display = "block";
  leaderboardList.innerHTML = "";
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.forEach(entry => {
    const li = document.createElement("li");
    li.textContent = `${entry.username} - ${entry.score}`;
    leaderboardList.appendChild(li);
  });
}

backToLogin.onclick = () => {
  leaderboardContainer.style.display = "none";
  loginContainer.style.display = "block";
};

// ================== ADMIN PANEL ==================
const addQuizBtn = document.getElementById("add-quiz-btn");
const addQuestionBtn = document.getElementById("add-question-btn");
const deleteQuizBtn = document.getElementById("delete-quiz-btn");
const viewAnswerKeyBtn = document.getElementById("view-answer-key");
const viewResultsBtn = document.getElementById("view-results");
const enablePracticeBtn = document.getElementById("enable-practice");
const resetUserBtn = document.getElementById("reset-user-btn");
const quizSelect = document.getElementById("quiz-select");

function refreshQuizDropdown() {
  quizSelect.innerHTML = "";
  for(let quiz in quizSets) {
    const opt = document.createElement("option");
    opt.value = quiz;
    opt.textContent = quiz;
    quizSelect.appendChild(opt);
  }
}

addQuizBtn.onclick = () => {
  const quizName = document.getElementById("