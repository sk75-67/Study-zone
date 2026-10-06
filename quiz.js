// =====================================================
// 👨🎓 STUDENTS / ADMIN (WITH CLASS ATTRIBUTE & DEFAULT ADMIN)
// =====================================================

const DEFAULT_ADMIN = {
  code: "ADMIN",
  password: "admin@akprem",
  name: "Akprem",
  isAdmin: true,
  userClass: "All Classes"
};

let students = [DEFAULT_ADMIN];


// =====================================================
// 🔢 GLOBAL VARIABLES
// =====================================================

let currentStudent = null;
let quizzes = {};
let selectedQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let userResponses = []; // Track student's chosen options for Answer Key
let timer = null;
let quizEndTimer = null;
let countdownTimer = null;
let quizSubmitted = false;
let editingQuizId = null;
let questionCounter = 0;
let editingUserCode = null;
let stopResultsListener = null;

let openStudentFolders = {}; // Track which folders are open/expanded
let activeStudentSection = null; // null = Main 3-Card Hub, or 'live', 'practice', 'expired'
let currentStudentFolderPath = []; // Drill-down folder path: e.g. ['Question Bank', '2024']
let activeAdminSection = null; // null = All, or 'live', 'practice', 'expired'

const LOGIN_SESSION_KEY = "quiz_logged_in_user";


// =====================================================
// 💾 LOGIN SESSION HELPERS
// =====================================================

function saveLoginSession(user) {
  if (!user) return;
  try {
    sessionStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("❌ Save Login Session Error:", error);
  }
}

function getLoginSession() {
  try {
    const saved = sessionStorage.getItem(LOGIN_SESSION_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (error) {
    console.error("❌ Login Session Error:", error);
    sessionStorage.removeItem(LOGIN_SESSION_KEY);
    return null;
  }
}

function removeLoginSession() {
  try {
    sessionStorage.removeItem(LOGIN_SESSION_KEY);
  } catch (error) {
    console.error("❌ Remove Login Session Error:", error);
  }
}


// =====================================================
// 📅 DATE & TIME HELPERS
// =====================================================

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}


// =====================================================
// 🔐 LOGIN ENGINE
// =====================================================

function login() {
  const codeInput = document.getElementById("code");
  const passwordInput = document.getElementById("password");

  if (!codeInput || !passwordInput) {
    console.error("❌ Login input नहीं मिला।");
    return;
  }

  let code = codeInput.value.trim().toUpperCase();
  const password = passwordInput.value.trim();

  if (!code || !password) {
    alert("⚠️ Code और Password दोनों भरें!");
    return;
  }

  let user = null;
  if (code === "ADMIN" && password === "admin@akprem") {
    user = DEFAULT_ADMIN;
  } else {
    user = students.find(
      s => String(s.code).trim().toUpperCase() === code &&
           String(s.password).trim() === password
    );
  }

  if (!user) {
    alert("❌ गलत Student Code या Password!");
    return;
  }

  currentStudent = {
    ...user,
    code: code
  };

  saveLoginSession(currentStudent);
  showLoggedInScreen();
}


// =====================================================
// 🖥️ SHOW LOGGED-IN SCREEN
// =====================================================

function showLoggedInScreen() {
  if (!currentStudent) return;

  const loginBox = document.getElementById("loginBox");
  const quizArea = document.getElementById("quizArea");
  const studentName = document.getElementById("studentName");
  const studentSection = document.getElementById("studentSection");
  const adminPanel = document.getElementById("adminPanel");
  const results = document.getElementById("results");

  if (loginBox) loginBox.classList.add("hidden");
  if (quizArea) quizArea.classList.remove("hidden");
  if (studentName) {
    const studentClassText = currentStudent.userClass ? ` (${currentStudent.userClass})` : "";
    studentName.innerText = `🎯 शुभकामनाएँ, ${currentStudent.name}${studentClassText}!`;
  }

  // ADMIN VIEW
  if (currentStudent.isAdmin === true) {
    if (studentSection) studentSection.classList.add("hidden");
    if (adminPanel) adminPanel.classList.remove("hidden");
    if (results) results.classList.remove("hidden");

    renderSavedQuizzes();
    renderUserManagement();
    return;
  }

  // STUDENT VIEW
  if (adminPanel) adminPanel.classList.add("hidden");
  if (studentSection) studentSection.classList.remove("hidden");

  if (typeof window.syncUserResultsFromFirebase === "function" && currentStudent && currentStudent.code) {
    window.syncUserResultsFromFirebase(currentStudent.code);
  }

  renderStudentQuizzes();
}


// =====================================================
// 🔄 RESTORE LOGIN AFTER REFRESH
// =====================================================

function restoreLoginSession() {
  const savedUser = getLoginSession();

  if (!savedUser || !savedUser.code || !savedUser.name) {
    removeLoginSession();
    return;
  }

  currentStudent = {
    ...savedUser,
    code: String(savedUser.code).trim().toUpperCase()
  };

  showLoggedInScreen();
}


// =====================================================
// 🔥 UPDATE STUDENTS FROM FIREBASE
// =====================================================

function updateStudentsFromFirebase(firebaseStudents) {
  const firebaseList = firebaseStudents ? Object.values(firebaseStudents) : [];

  const parsedList = firebaseList
    .map(user => ({
      code: String(user.code || "").trim().toUpperCase(),
      name: String(user.name || "Student").trim(),
      password: String(user.password || "").trim(),
      userClass: String(user.userClass || "Class 6th").trim(),
      isAdmin: user.isAdmin === true
    }))
    .filter(user => user.code && user.password);

  const hasAdmin = parsedList.some(u => u.code === "ADMIN");
  if (!hasAdmin) {
    parsedList.push(DEFAULT_ADMIN);
  }

  students = parsedList;
  console.log("✅ Firebase Students Synced:", students.length, "total users");

  if (currentStudent) {
    const updatedUser = students.find(
      user => user.code === String(currentStudent.code).trim().toUpperCase()
    );

    if (updatedUser) {
      currentStudent = { ...updatedUser };
      saveLoginSession(currentStudent);
      showLoggedInScreen();
    }
  }

  if (currentStudent && currentStudent.isAdmin === true) {
    renderUserList();
  }
}

window.updateStudentsFromFirebase = updateStudentsFromFirebase;


// =====================================================
// 📊 QUIZ STATUS HELPER (WITH 30 MIN AUTO EXPIRED TRANSITION)
// =====================================================

function getQuizStatus(quiz) {
  if (quiz.mode === "practice") {
    return {
      text: "♾️ PRACTICE UNLIMITED",
      className: "practice",
      canStart: true,
      finished: false,
      isExpired: false,
      buttonText: "♾️ Practice Quiz Start",
      buttonClass: "btn-practice-start"
    };
  }

  const today = getTodayDate();

  if (today < quiz.date) {
    return {
      text: "📅 Upcoming Live",
      className: "upcoming",
      canStart: false,
      finished: false,
      isExpired: false,
      buttonText: "⏳ अभी शुरू नहीं हुआ",
      buttonClass: "btn-live-start"
    };
  }

  if (today > quiz.date) {
    return {
      text: "⌛ Expired",
      className: "expired",
      canStart: false,
      finished: true,
      isExpired: true,
      buttonText: "⌛ Quiz समाप्त (Expired)",
      buttonClass: "btn-live-start"
    };
  }

  const now = new Date();
  const start = getDateTime(quiz.date, quiz.start);
  const end = getDateTime(quiz.date, quiz.end);
  
  // 30 Minutes After End Time -> Automatic Expired Folder Transition
  const endPlus30Min = new Date(end.getTime() + (30 * 60 * 1000));

  if (now < start) {
    return {
      text: "⏳ Waiting Live",
      className: "waiting",
      canStart: false,
      finished: false,
      isExpired: false,
      buttonText: "⏳ समय का इंतजार करें",
      buttonClass: "btn-live-start"
    };
  }

  if (now >= endPlus30Min) {
    return {
      text: "⌛ Expired (Live Finished)",
      className: "expired",
      canStart: false,
      finished: true,
      isExpired: true,
      buttonText: "⌛ Quiz समाप्त (Expired)",
      buttonClass: "btn-live-start"
    };
  }

  if (now >= end) {
    return {
      text: "🏁 Live Ended",
      className: "finished",
      canStart: false,
      finished: true,
      isExpired: false,
      buttonText: "🏁 Live समाप्त",
      buttonClass: "btn-live-start"
    };
  }

  return {
    text: "🟢 Live Active",
    className: "live",
    canStart: true,
    finished: false,
    isExpired: false,
    buttonText: "🚀 Start Live Quiz",
    buttonClass: "btn-live-start"
  };
}


// =====================================================
// 📁 NESTED SUB-FOLDER TREE RECURSIVE ENGINE
// =====================================================

function buildFolderTree(quizList, defaultSystemFolder) {
  const root = { name: "root", subfolders: {}, quizzes: [] };

  quizList.forEach(quiz => {
    let folderPath = (quiz.folder || defaultSystemFolder).trim();
    const parts = folderPath.split(/[\/\\]+/).map(p => p.trim()).filter(Boolean);

    let current = root;
    parts.forEach(part => {
      if (!current.subfolders[part]) {
        current.subfolders[part] = { name: part, subfolders: {}, quizzes: [] };
      }
      current = current.subfolders[part];
    });

    current.quizzes.push(quiz);
  });

  return root;
}

function countQuizzesInNode(node) {
  let count = node.quizzes ? node.quizzes.length : 0;
  if (node.subfolders) {
    Object.values(node.subfolders).forEach(sub => {
      count += countQuizzesInNode(sub);
    });
  }
  return count;
}

function renderFolderTreeNode(node, container, pathPrefix = "sf_", isStudentView = true) {
  const subfolderNames = Object.keys(node.subfolders);

  subfolderNames.forEach(subName => {
    const subNode = node.subfolders[subName];
    const totalCount = countQuizzesInNode(subNode);
    const folderKey = `${pathPrefix}${subName}`;
    const isOpen = openStudentFolders[folderKey] === true;

    let themeClass = "";
    if (subName.includes("Live Active") || subName.includes("Live Quizzes")) themeClass = "folder-theme-live";
    else if (subName.includes("Practice")) themeClass = "folder-theme-practice";
    else if (subName.includes("Expired")) themeClass = "folder-theme-expired";

    const folderCard = document.createElement("div");
    folderCard.className = "student-folder-card";

    folderCard.innerHTML = `
      <div class="student-folder-header ${isOpen ? 'open' : ''} ${themeClass}">
        <div class="student-folder-title-wrap">
          <span class="student-folder-icon">${isOpen ? '📂' : '📁'}</span>
          <span>${escapeHTML(subName)}</span>
        </div>
        <span class="student-folder-count">${totalCount} Quizzes ${isOpen ? '▼' : '▶'}</span>
      </div>
      <div class="student-folder-body ${isOpen ? '' : 'hidden'}">
        <div class="folder-sub-container"></div>
        <div class="quiz-list">
          ${(totalCount === 0) ? `
            <div class="empty-box" style="padding:18px; margin:0;">
              📭 इस Folder में अभी कोई Quiz नहीं है।
            </div>
          ` : ""}
        </div>
      </div>
    `;

    const subContainer = folderCard.querySelector(".folder-sub-container");
    const quizListGrid = folderCard.querySelector(".quiz-list");

    // Recursively render nested subfolders first!
    if (Object.keys(subNode.subfolders).length > 0) {
      renderFolderTreeNode(subNode, subContainer, `${folderKey}_`, isStudentView);
    }

    // Render quizzes at this level
    if (subNode.quizzes && subNode.quizzes.length > 0) {
      subNode.quizzes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      subNode.quizzes.forEach(quiz => {
        if (isStudentView) {
          const card = buildStudentQuizCard(quiz);
          quizListGrid.appendChild(card);
        } else {
          const card = buildAdminSavedQuizCard(quiz);
          quizListGrid.appendChild(card);
        }
      });
    }

    const header = folderCard.querySelector(".student-folder-header");
    header.onclick = (e) => {
      e.stopPropagation();
      openStudentFolders[folderKey] = !isOpen;
      if (isStudentView) renderStudentQuizzes();
      else renderSavedQuizzes();

      if (!isOpen) {
        setTimeout(() => {
          const updatedHeader = document.querySelector(`[data-folder-key="${folderKey}"]`) || folderCard;
          if (updatedHeader) {
            updatedHeader.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 50);
      }
    };

    folderCard.setAttribute("data-folder-key", folderKey);
    container.appendChild(folderCard);
  });
}


// =====================================================
// 📚 RENDER STUDENT QUIZZES (TELEGRAM-STYLE DEDICATED PAGES & FOLDER DRILL-DOWN)
// =====================================================

function openStudentSection(sectionName) {
  activeStudentSection = sectionName;
  currentStudentFolderPath = [];
  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeStudentSection() {
  activeStudentSection = null;
  currentStudentFolderPath = [];
  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openStudentFolder(folderName) {
  currentStudentFolderPath.push(folderName);
  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function navigateBackStudentFolder() {
  if (currentStudentFolderPath.length > 0) {
    currentStudentFolderPath.pop();
  } else {
    activeStudentSection = null;
  }
  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function jumpToStudentFolder(index) {
  if (index === -1) {
    currentStudentFolderPath = [];
  } else {
    currentStudentFolderPath = currentStudentFolderPath.slice(0, index + 1);
  }
  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.openStudentSection = openStudentSection;
window.closeStudentSection = closeStudentSection;
window.openStudentFolder = openStudentFolder;
window.navigateBackStudentFolder = navigateBackStudentFolder;
window.jumpToStudentFolder = jumpToStudentFolder;

function renderStudentQuizzes() {
  const container = document.getElementById("studentQuizFoldersContainer");
  if (!container) return;

  const quizArray = Object.values(quizzes);
  const studentClass = currentStudent ? (currentStudent.userClass || "Class 6th") : "Class 6th";
  const studentName = currentStudent ? (currentStudent.name || "Student") : "Student";

  // 1. STRICT CLASS FILTERING
  const classAllowedQuizzes = quizArray.filter(q => {
    if (currentStudent?.isAdmin) return true;
    const target = q.targetClass || "All Classes";
    return target === "All Classes" || target === studentClass;
  });

  // 2. GROUP INTO SYSTEM LISTS
  const liveList = [];
  const practiceList = [];
  const expiredList = [];

  classAllowedQuizzes.forEach(quiz => {
    const status = getQuizStatus(quiz);

    if (quiz.mode === "practice") {
      practiceList.push(quiz);
    } else if (status.isExpired || status.finished) {
      expiredList.push(quiz);
    } else {
      liveList.push(quiz);
    }
  });

  container.innerHTML = "";
  const mainTitleEl = document.getElementById("studentSectionMainTitle");

  // =====================================================
  // 📱 VIEW 1: MAIN 3-CARD HUB (TELEGRAM-STYLE DASHBOARD)
  // =====================================================
  if (activeStudentSection === null) {
    if (mainTitleEl) mainTitleEl.style.display = "block";
    const hubWrap = document.createElement("div");
    hubWrap.className = "mobile-hub-container";

    hubWrap.innerHTML = `
      <!-- Student Greeting Banner -->
      <div class="hub-welcome-banner">
        <div class="hub-welcome-text">
          <h3>👋 नमस्ते, ${escapeHTML(studentName)}!</h3>
          <p>अपनी पसंद का सेक्शन चुनकर क्विज़ शुरू करें:</p>
        </div>
        <div class="hub-class-pill">
          🏫 ${escapeHTML(studentClass)}
        </div>
      </div>

      <!-- 1. LIVE QUIZZES CARD -->
      <div class="hub-card hub-card-live" onclick="openStudentSection('live')">
        <div class="hub-card-left">
          <div class="hub-card-icon-wrap">
            ⚡
          </div>
          <div class="hub-card-content">
            <h4>
              <span class="live-pulse"></span>
              Live Quizzes
            </h4>
            <p>निर्धारित समय पर चलने वाले लाइव टेस्ट</p>
          </div>
        </div>
        <div class="hub-card-right">
          <span class="hub-count-tag">
            🟢 ${liveList.length} उपलब्ध
          </span>
          <div class="hub-arrow-btn">➜</div>
        </div>
      </div>

      <!-- 2. PRACTICE MODE CARD -->
      <div class="hub-card hub-card-practice" onclick="openStudentSection('practice')">
        <div class="hub-card-left">
          <div class="hub-card-icon-wrap">
            ♾️
          </div>
          <div class="hub-card-content">
            <h4>
              Practice Mode
            </h4>
            <p>जितनी बार चाहें बिना समय सीमा अभ्यास करें</p>
          </div>
        </div>
        <div class="hub-card-right">
          <span class="hub-count-tag">
            📘 ${practiceList.length} उपलब्ध
          </span>
          <div class="hub-arrow-btn">➜</div>
        </div>
      </div>

      <!-- 3. EXPIRED & RESULTS CARD -->
      <div class="hub-card hub-card-expired" onclick="openStudentSection('expired')">
        <div class="hub-card-left">
          <div class="hub-card-icon-wrap">
            ⏳
          </div>
          <div class="hub-card-content">
            <h4>
              Expired & Results
            </h4>
            <p>समाप्त क्विज़, रिजल्ट्स और Answer Keys</p>
          </div>
        </div>
        <div class="hub-card-right">
          <span class="hub-count-tag">
            🔴 ${expiredList.length} उपलब्ध
          </span>
          <div class="hub-arrow-btn">➜</div>
        </div>
      </div>
    `;

    container.appendChild(hubWrap);
    return;
  }

  // =====================================================
  // 📄 VIEW 2: DEDICATED SEPARATE PAGE & FOLDER DRILL-DOWN
  // =====================================================
  if (mainTitleEl) mainTitleEl.style.display = "none";
  const pageContainer = document.createElement("div");
  pageContainer.className = "section-page-container";

  let sectionTitle = "";
  let sectionList = [];
  let defaultFolder = "";

  if (activeStudentSection === "live") {
    sectionTitle = "🟢 Live Active Quizzes";
    sectionList = liveList;
    defaultFolder = "Live Quizzes";
  } else if (activeStudentSection === "practice") {
    sectionTitle = "♾️ Unlimited Practice Quizzes";
    sectionList = practiceList;
    defaultFolder = "Practice Quizzes";
  } else if (activeStudentSection === "expired") {
    sectionTitle = "🔴 Expired / Completed Quizzes";
    sectionList = expiredList;
    defaultFolder = "Expired Quizzes";
  }

  // 3. BUILD RECURSIVE FOLDER TREE
  const tree = buildFolderTree(sectionList, defaultFolder);

  // 4. TRAVERSE TO CURRENT DRILL-DOWN FOLDER NODE
  let currentNode = tree;
  for (const part of currentStudentFolderPath) {
    if (currentNode.subfolders && currentNode.subfolders[part]) {
      currentNode = currentNode.subfolders[part];
    }
  }

  const currentFolderName = currentStudentFolderPath.length > 0
    ? currentStudentFolderPath[currentStudentFolderPath.length - 1]
    : sectionTitle;

  const parentName = currentStudentFolderPath.length > 1
    ? currentStudentFolderPath[currentStudentFolderPath.length - 2]
    : (currentStudentFolderPath.length === 1 ? sectionTitle : "मुख्य मेनू");

  const totalQuizzesInNode = countQuizzesInNode(currentNode);

  // 5. STICKY TELEGRAM-STYLE NAV HEADER WITH BACK BUTTON
  const navHeader = document.createElement("div");
  navHeader.className = "section-nav-bar";
  navHeader.innerHTML = `
    <button class="section-back-btn" onclick="navigateBackStudentFolder()">
      <span>←</span> <span>${escapeHTML(parentName)}</span>
    </button>
    <div class="section-nav-center">
      <h3 class="section-nav-title">📁 ${escapeHTML(currentFolderName)}</h3>
      <span class="section-nav-count">${totalQuizzesInNode} Quizzes उपलब्ध</span>
    </div>
    <div class="section-nav-right">
      <span class="section-class-tag">${escapeHTML(studentClass)}</span>
    </div>
  `;

  pageContainer.appendChild(navHeader);

  // 6. BREADCRUMB TRAIL (TAP ANY LEVEL TO JUMP)
  const breadcrumb = document.createElement("div");
  breadcrumb.className = "drill-breadcrumb";
  breadcrumb.innerHTML = `
    <span class="drill-crumb-link" onclick="closeStudentSection()">🏠 मुख्य मेनू</span>
    <span>›</span>
    <span class="${currentStudentFolderPath.length === 0 ? 'drill-crumb-current' : 'drill-crumb-link'}" onclick="jumpToStudentFolder(-1)">
      ${escapeHTML(sectionTitle)}
    </span>
    ${currentStudentFolderPath.map((folder, idx) => `
      <span>›</span>
      <span class="${idx === currentStudentFolderPath.length - 1 ? 'drill-crumb-current' : 'drill-crumb-link'}" onclick="jumpToStudentFolder(${idx})">
        ${escapeHTML(folder)}
      </span>
    `).join("")}
  `;
  pageContainer.appendChild(breadcrumb);

  const subfolderKeys = Object.keys(currentNode.subfolders || {});
  const directQuizzes = currentNode.quizzes || [];

  // 7. EMPTY STATE
  if (subfolderKeys.length === 0 && directQuizzes.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "empty-box";
    emptyBox.style.marginTop = "20px";
    emptyBox.innerHTML = `
      📭 इस Folder में अभी आपकी Class (${escapeHTML(studentClass)}) के लिए कोई Quiz नहीं है।
      <div style="margin-top:14px;">
        <button class="section-back-btn" onclick="navigateBackStudentFolder()" style="display:inline-flex;">
          ← वापस जाएँ
        </button>
      </div>
    `;
    pageContainer.appendChild(emptyBox);
    container.appendChild(pageContainer);
    return;
  }

  // 8. RENDER SUB-FOLDERS AS CLICKABLE CARDS (NEW PAGE ON TAP!)
  if (subfolderKeys.length > 0) {
    const folderHeading = document.createElement("div");
    folderHeading.className = "section-section-title";
    folderHeading.innerHTML = `📁 फोल्डर्स (${subfolderKeys.length})`;
    pageContainer.appendChild(folderHeading);

    const folderGrid = document.createElement("div");
    folderGrid.className = "drill-folder-grid";

    subfolderKeys.forEach(subName => {
      const subNode = currentNode.subfolders[subName];
      const count = countQuizzesInNode(subNode);

      const fCard = document.createElement("div");
      fCard.className = "drill-folder-card";
      fCard.onclick = () => openStudentFolder(subName);

      fCard.innerHTML = `
        <div class="drill-folder-left">
          <div class="drill-folder-icon">📂</div>
          <div class="drill-folder-info">
            <h4 class="drill-folder-title">${escapeHTML(subName)}</h4>
            <p class="drill-folder-meta">${count} Quizzes उपलब्ध</p>
          </div>
        </div>
        <div class="drill-folder-arrow">➜</div>
      `;
      folderGrid.appendChild(fCard);
    });

    pageContainer.appendChild(folderGrid);
  }

  // 9. RENDER DIRECT QUIZZES AS MODERN QUIZ CARDS
  if (directQuizzes.length > 0) {
    const quizHeading = document.createElement("div");
    quizHeading.className = "section-section-title";
    quizHeading.innerHTML = `📝 उपलब्ध टेस्ट (${directQuizzes.length})`;
    pageContainer.appendChild(quizHeading);

    const quizGrid = document.createElement("div");
    quizGrid.className = "section-quiz-grid";

    directQuizzes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    directQuizzes.forEach(quiz => {
      const card = buildStudentQuizCard(quiz);
      quizGrid.appendChild(card);
    });

    pageContainer.appendChild(quizGrid);
  }

  container.appendChild(pageContainer);
}

function renderSystemFolderCard(folderName, quizList, container, prefix, isStudentView = true) {
  const folderKey = `${prefix}main`;
  const isOpen = openStudentFolders[folderKey] === true;
  const tree = buildFolderTree(quizList, folderName);

  let themeClass = "";
  if (folderName.includes("Live Active")) themeClass = "folder-theme-live";
  else if (folderName.includes("Practice")) themeClass = "folder-theme-practice";
  else if (folderName.includes("Expired")) themeClass = "folder-theme-expired";

  const folderCard = document.createElement("div");
  folderCard.className = "student-folder-card";

  folderCard.innerHTML = `
    <div class="student-folder-header ${isOpen ? 'open' : ''} ${themeClass}">
      <div class="student-folder-title-wrap">
        <span class="student-folder-icon">${isOpen ? '📂' : '📁'}</span>
        <span>${escapeHTML(folderName)}</span>
      </div>
      <span class="student-folder-count">${quizList.length} Quizzes ${isOpen ? '▼' : '▶'}</span>
    </div>
    <div class="student-folder-body ${isOpen ? '' : 'hidden'}">
      <div class="folder-sub-container"></div>
    </div>
  `;

  const subContainer = folderCard.querySelector(".folder-sub-container");

  if (quizList.length === 0) {
    subContainer.innerHTML = `
      <div class="empty-box" style="padding:18px; margin:0;">
        📭 इस Folder में आपकी Class के लिए अभी कोई Quiz नहीं है।
      </div>
    `;
  } else {
    // Render tree nodes and quizzes
    renderFolderTreeNode(tree, subContainer, `${prefix}_node_`, isStudentView);
  }

  const header = folderCard.querySelector(".student-folder-header");
  header.onclick = (e) => {
    e.stopPropagation();
    openStudentFolders[folderKey] = !isOpen;
    if (isStudentView) renderStudentQuizzes();
    else renderSavedQuizzes();

    if (!isOpen) {
      setTimeout(() => {
        const updatedHeader = document.querySelector(`[data-folder-key="${folderKey}"]`) || folderCard;
        if (updatedHeader) {
          updatedHeader.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    }
  };

  folderCard.setAttribute("data-folder-key", folderKey);
  container.appendChild(folderCard);
}


// =====================================================
// 🃏 BUILD STUDENT QUIZ CARD
// =====================================================

function buildStudentQuizCard(quiz) {
  const status = getQuizStatus(quiz);
  const targetClass = quiz.targetClass || "All Classes";
  const quizFolder = quiz.folder || "Live Quizzes";
  const studentClass = currentStudent ? (currentStudent.userClass || "Class 6th") : "Class 6th";

  const isClassMatching = (targetClass === "All Classes" || targetClass === studentClass || currentStudent?.isAdmin);

  const resultKey = `${currentStudent ? currentStudent.code : ''}_${quiz.id}`;
  const savedResult = localStorage.getItem(resultKey);

  const card = document.createElement("div");
  card.className = "quiz-card";

  const isPracticeMode = quiz.mode === 'practice';

  card.innerHTML = `
    <div class="quiz-card-header">
      <h3>🧠 ${escapeHTML(quiz.title)}</h3>
      <div class="badge-group">
        <span class="status ${status.className}">
          ${status.text}
        </span>
        <span class="${isClassMatching ? 'class-badge' : 'class-badge-locked'}">
          🏫 ${escapeHTML(targetClass)}
        </span>
        <span class="class-badge" style="background:#475569;">
          📁 ${escapeHTML(quizFolder)}
        </span>
      </div>
    </div>

    <div class="quiz-details">
      <p>⚡ <strong>Mode:</strong> ${isPracticeMode ? '♾️ Unlimited Practice Mode' : '🟢 Scheduled Live Test Mode'}</p>
      ${isPracticeMode ? `
        <p>♾️ <strong>Availability:</strong> हमेशा उपलब्ध (जितनी बार चाहें प्रैक्टिस करें)</p>
      ` : `
        <p>📅 <strong>Date:</strong> ${escapeHTML(quiz.date)}</p>
        <p>🟢 <strong>Start:</strong> ${escapeHTML(quiz.start)}</p>
        <p>🔴 <strong>End:</strong> ${escapeHTML(quiz.end)} (30 min बाद Auto Expired)</p>
      `}
      <p>❓ <strong>Questions:</strong> ${Array.isArray(quiz.questions) ? quiz.questions.length : 0}</p>
      <p>⏱️ <strong>हर Question:</strong> ${Number(quiz.questionTime) || 15}s</p>
      ${!isClassMatching ? `<p style="color:#ef4444; font-weight:800;">🔒 केवल ${escapeHTML(targetClass)} के बच्चे खेल सकते हैं</p>` : ''}
    </div>

    <div class="quiz-card-actions">
      <button
        class="${isPracticeMode ? 'btn-practice-start' : 'btn-live-start'}"
        data-id="${escapeHTML(quiz.id)}"
        ${(status.canStart && isClassMatching) ? "" : "disabled"}
      >
        ${!isClassMatching ? `🔒 Only ${escapeHTML(targetClass)}` : status.buttonText}
      </button>

      ${(status.finished || status.isExpired || savedResult) ? `
        <button class="result-btn" data-result="${escapeHTML(quiz.id)}">
          🏆 Result
        </button>
      ` : ""}

      ${savedResult ? `
        <button class="answer-key-btn" data-ak="${escapeHTML(quiz.id)}">
          📑 Answer Key & Review (याद करें)
        </button>
      ` : ""}
    </div>
  `;

  const startBtn = card.querySelector(`.${isPracticeMode ? 'btn-practice-start' : 'btn-live-start'}`);
  if (startBtn) startBtn.onclick = () => startSelectedQuiz(quiz.id);

  const resBtn = card.querySelector(".result-btn");
  if (resBtn) resBtn.onclick = () => {
    selectedQuiz = quiz;
    showLiveResults(quiz.id);
  };

  const akBtn = card.querySelector(".answer-key-btn");
  if (akBtn) akBtn.onclick = () => openAnswerKeyModal(quiz.id);

  return card;
}


// =====================================================
// 🃏 BUILD ADMIN SAVED QUIZ CARD
// =====================================================

function buildAdminSavedQuizCard(quiz) {
  const card = document.createElement("div");
  card.className = "saved-quiz";

  card.innerHTML = `
    <div>
      <h4>🧠 ${escapeHTML(quiz.title)} <span class="status ${quiz.mode === 'practice' ? 'practice' : 'live'}">${quiz.mode === 'practice' ? '♾️ Practice' : '🟢 Live'}</span></h4>
      <p>🏫 <strong>Class:</strong> ${escapeHTML(quiz.targetClass || "All Classes")} &nbsp; | &nbsp; ${quiz.mode === 'practice' ? '♾️ हमेशा उपलब्ध' : `📅 ${escapeHTML(quiz.date)} &nbsp; | &nbsp; 🕐 ${escapeHTML(quiz.start)}-${escapeHTML(quiz.end)}`}</p>
      <p>❓ ${Array.isArray(quiz.questions) ? quiz.questions.length : 0} Questions &nbsp; | &nbsp; 📁 Folder Path: <strong>${escapeHTML(quiz.folder || "Live Quizzes")}</strong></p>
    </div>
    <div class="saved-actions">
      <button class="view-result-admin" data-id="${escapeHTML(quiz.id)}">🏆 Results</button>
      <button class="edit-quiz" data-id="${escapeHTML(quiz.id)}">✏️ Edit / Folder Path / Practice Mode</button>
      <button class="delete-quiz" data-id="${escapeHTML(quiz.id)}">🗑️ Delete</button>
    </div>
  `;

  const resBtn = card.querySelector(".view-result-admin");
  if (resBtn) resBtn.onclick = () => {
    selectedQuiz = quiz;
    showLiveResults(quiz.id);
  };

  const editBtn = card.querySelector(".edit-quiz");
  if (editBtn) editBtn.onclick = () => editQuiz(quiz.id);

  const delBtn = card.querySelector(".delete-quiz");
  if (delBtn) delBtn.onclick = () => deleteQuiz(quiz.id);

  return card;
}


// =====================================================
// 🚀 START SELECTED QUIZ (WITH AUTOMATIC SMOOTH SCROLL)
// =====================================================

function startSelectedQuiz(quizId) {
  const quiz = quizzes[quizId];

  if (!quiz) {
    alert("❌ Quiz नहीं मिला।");
    return;
  }

  if (!currentStudent) {
    alert("⚠️ पहले Login करें।");
    return;
  }

  // Class Match Check
  const targetClass = quiz.targetClass || "All Classes";
  const studentClass = currentStudent.userClass || "Class 6th";
  if (targetClass !== "All Classes" && targetClass !== studentClass && !currentStudent.isAdmin) {
    alert(`🔒 यह Quiz केवल ${targetClass} के लिए है। आपकी Class: ${studentClass}`);
    return;
  }

  selectedQuiz = quiz;
  const status = getQuizStatus(quiz);

  if (!status.canStart) {
    if (status.finished) {
      showLiveResults(quiz.id);
    } else {
      showQuizWaiting(quiz);
    }
    return;
  }

  if (quiz.mode !== "practice") {
    const key = `${currentStudent.code}_${quiz.id}`;
    const already = localStorage.getItem(key);

    if (already) {
      alert("⏳ आपने यह Live Quiz पहले ही दे दिया है। Answer Key या Live Results देखें।");
      showLiveResults(quiz.id);
      return;
    }
  }

  currentQuestionIndex = 0;
  score = 0;
  userResponses = [];
  quizSubmitted = false;

  // HIDE STUDENT SECTION - ENTER DEDICATED FULLSCREEN QUIZ PLAY PAGE
  const studentSec = document.getElementById("studentSection");
  if (studentSec) studentSec.classList.add("hidden");

  const endTime = quiz.mode === "practice"
    ? Date.now() + (quiz.questions.length * (quiz.questionTime || 15) * 1000)
    : getDateTime(quiz.date, quiz.end).getTime();

  startQuiz(endTime);
}

function exitQuizToFolder() {
  const confirmExit = confirm("⚠️ क्या आप Quiz छोड़कर वापस फोल्डर पर जाना चाहते हैं? (वर्तमान प्रगति सुरक्षित नहीं होगी)");
  if (!confirmExit) return;

  clearInterval(timer);
  clearTimeout(quizEndTimer);
  disableAntiCheatProtection();

  const quizDiv = document.getElementById("quiz");
  if (quizDiv) quizDiv.innerHTML = "";

  const studentSec = document.getElementById("studentSection");
  if (studentSec) studentSec.classList.remove("hidden");

  renderStudentQuizzes();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

window.exitQuizToFolder = exitQuizToFolder;



// =====================================================
// ⏳ WAITING COUNTDOWN SCREEN
// =====================================================

function showQuizWaiting(quiz) {
  const quizDiv = document.getElementById("quiz");
  if (!quizDiv) return;

  quizDiv.innerHTML = `
    <div class="question-card">
      <h2>⏳ ${escapeHTML(quiz.title)}</h2>
      <p>🏫 Target Class: <strong>${escapeHTML(quiz.targetClass || "All Classes")}</strong></p>
      <p>📅 Date: <strong>${escapeHTML(quiz.date)}</strong></p>
      <p>🟢 Start: <strong>${escapeHTML(quiz.start)}</strong></p>
      <p>🔴 End: <strong>${escapeHTML(quiz.end)}</strong></p>
      <p id="quizWaitingCountdown">Loading...</p>
    </div>
  `;

  // Automatic Smooth Scroll down to question box
  quizDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  updateWaitingCountdown(quiz);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => updateWaitingCountdown(quiz), 1000);
}

function updateWaitingCountdown(quiz) {
  const element = document.getElementById("quizWaitingCountdown");
  if (!element) return;

  const start = getDateTime(quiz.date, quiz.start).getTime();
  const diff = start - Date.now();

  if (diff <= 0) {
    clearInterval(countdownTimer);
    renderStudentQuizzes();
    return;
  }

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  element.innerText = `⏰ शुरू होने में ${mins} मिनट ${secs} सेकंड`;
}


// =====================================================
// 🚀 QUIZ EXECUTION ENGINE
// =====================================================

function startQuiz(endTime) {
  quizSubmitted = false;
  clearTimeout(quizEndTimer);

  // Enable Anti-Cheating & Anti-Screenshot Safeguards
  enableAntiCheatProtection();

  const remaining = endTime - Date.now();
  if (remaining <= 0) {
    autoSubmitQuiz();
    return;
  }

  quizEndTimer = setTimeout(() => autoSubmitQuiz(), remaining);
  loadQuestion();
}


// =====================================================
// 🟣 LOAD QUESTION (WITH EARLY SUBMIT & AUTO SCROLL)
// =====================================================

function loadQuestion() {
  if (quizSubmitted) return;
  if (!selectedQuiz || !Array.isArray(selectedQuiz.questions)) return;

  clearInterval(timer);
  const quizDiv = document.getElementById("quiz");
  if (!quizDiv) return;

  const question = selectedQuiz.questions[currentQuestionIndex];
  if (!question) {
    submitQuiz(false);
    return;
  }

  quizDiv.innerHTML = `
    <div class="question-card anti-cheat-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.15);">
        <button onclick="exitQuizToFolder()" type="button" class="section-back-btn" style="padding:6px 12px; font-size:12px;">
          ✖️ Exit Quiz (बाहर निकलें)
        </button>
        <span style="font-size:13px; font-weight:800; color:#38bdf8;">
          ⏱️ हर सवाल: ${Number(selectedQuiz.questionTime) || 15}s
        </span>
      </div>

      <div class="question-top">
        <span>Question ${currentQuestionIndex + 1} / ${selectedQuiz.questions.length}</span>
        <span>🧠 ${escapeHTML(selectedQuiz.title)} (${escapeHTML(selectedQuiz.targetClass || "All")})</span>
      </div>

      <h2 class="protected-text">${escapeHTML(question.q)}</h2>

      ${question.figure ? `
        <div class="question-figure-box protected-image">
          <img src="${escapeHTML(question.figure)}" class="question-figure-img" alt="Question Diagram" draggable="false" oncontextmenu="return false;" />
        </div>
      ` : ""}

      <div class="options protected-text">
        ${question.options.map((option, index) => `
          <label class="option">
            <input type="radio" name="currentQuestion" value="${index}">
            <span>${escapeHTML(option)}</span>
          </label>
        `).join("")}
      </div>

      <p id="timer" class="question-timer">
        समय शेष: ${Number(selectedQuiz.questionTime) || 15}s
      </p>

      <div class="quiz-nav-action-grid">
        <button id="nextBtn" class="next-btn" type="button">
          ${(currentQuestionIndex === selectedQuiz.questions.length - 1) ? "🏁 Quiz पूरा करें" : "अगला प्रश्न ➡️"}
        </button>

        <button id="earlySubmitBtn" class="early-submit-btn" type="button">
          📥 बीच में Quiz जमा करें (Submit Now)
        </button>
      </div>
    </div>
  `;

  // AUTOMATIC SMOOTH SCROLL STRAIGHT TO QUESTION CARD!
  quizDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  // ⚡ TELEGRAM OPTION TAP RIPPLE & HAPTIC VIBE
  quizDiv.querySelectorAll(".option").forEach(optLabel => {
    optLabel.addEventListener("click", (e) => {
      // Light mobile vibration if supported
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try { navigator.vibrate(25); } catch (_) {}
      }

      // Create ripple wave element
      const rect = optLabel.getBoundingClientRect();
      const circle = document.createElement("span");
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${(e.clientX || rect.left + radius) - rect.left - radius}px`;
      circle.style.top = `${(e.clientY || rect.top + radius) - rect.top - radius}px`;
      circle.classList.add("option-tap-ripple");

      const existingRipple = optLabel.querySelector(".option-tap-ripple");
      if (existingRipple) existingRipple.remove();

      optLabel.appendChild(circle);
      setTimeout(() => circle.remove(), 550);
    });
  });

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.onclick = () => nextQuestion(false);
  }

  const earlySubmitBtn = document.getElementById("earlySubmitBtn");
  if (earlySubmitBtn) {
    earlySubmitBtn.onclick = () => {
      const confirmSubmit = confirm("क्या आप बीच में ही Quiz जमा (Submit) करना चाहते हैं?");
      if (confirmSubmit) {
        nextQuestion(false, true);
      }
    };
  }

  let timeLeft = Number(selectedQuiz.questionTime) || 15;
  timer = setInterval(() => {
    if (quizSubmitted) {
      clearInterval(timer);
      return;
    }

    timeLeft--;
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.innerText = `समय शेष: ${timeLeft}s`;
    }

    if (timeLeft <= 0) {
      clearInterval(timer);
      nextQuestion(true);
    }
  }, 1000);
}


// =====================================================
// 🟣 NEXT QUESTION
// =====================================================

function nextQuestion(autoNext = false, forceEarlySubmit = false) {
  if (quizSubmitted) return;
  clearInterval(timer);

  const selected = document.querySelector('input[name="currentQuestion"]:checked');
  const currentQuestion = selectedQuiz.questions[currentQuestionIndex];

  let selectedIndex = -1;

  if (selected) {
    selectedIndex = parseInt(selected.value, 10);
  } else if (!autoNext && !forceEarlySubmit) {
    alert("⚠️ कोई option select करें या 'बीच में Quiz जमा करें' बटन दबाएँ!");
    loadQuestion();
    return;
  }

  const isCorrect = (selectedIndex === Number(currentQuestion.answer));
  if (isCorrect) {
    score++;
  }

  userResponses.push({
    questionIndex: currentQuestionIndex,
    questionText: currentQuestion.q,
    figure: currentQuestion.figure || "",
    options: currentQuestion.options,
    selectedAnswer: selectedIndex,
    correctAnswer: Number(currentQuestion.answer),
    isCorrect: isCorrect,
    explanation: currentQuestion.explanation || ""
  });

  if (forceEarlySubmit) {
    submitQuiz(false);
    return;
  }

  currentQuestionIndex++;

  if (currentQuestionIndex < selectedQuiz.questions.length) {
    loadQuestion();
  } else {
    submitQuiz(false);
  }
}


// =====================================================
// ⛔ AUTO SUBMIT
// =====================================================

function autoSubmitQuiz() {
  if (quizSubmitted) return;
  quizSubmitted = true;

  clearInterval(timer);
  clearTimeout(quizEndTimer);

  const selected = document.querySelector('input[name="currentQuestion"]:checked');
  const currentQuestion = selectedQuiz ? selectedQuiz.questions[currentQuestionIndex] : null;

  if (currentQuestion && userResponses.length <= currentQuestionIndex) {
    let selectedIndex = selected ? parseInt(selected.value, 10) : -1;
    const isCorrect = (selectedIndex === Number(currentQuestion.answer));
    if (isCorrect) score++;

    userResponses.push({
      questionIndex: currentQuestionIndex,
      questionText: currentQuestion.q,
      figure: currentQuestion.figure || "",
      options: currentQuestion.options,
      selectedAnswer: selectedIndex,
      correctAnswer: Number(currentQuestion.answer),
      isCorrect: isCorrect,
      explanation: currentQuestion.explanation || ""
    });
  }

  submitQuiz(true);
}


// =====================================================
// 🧾 SUBMIT QUIZ
// =====================================================

async function submitQuiz(isAutoSubmit = false) {
  if (quizSubmitted && !isAutoSubmit) return;

  quizSubmitted = true;
  clearInterval(timer);
  clearTimeout(quizEndTimer);

  disableAntiCheatProtection();

  if (!currentStudent || !selectedQuiz) return;

  const result = {
    code: currentStudent.code,
    name: currentStudent.name,
    userClass: currentStudent.userClass || "Class 6th",
    score: score,
    totalQuestions: selectedQuiz.questions.length,
    date: Date.now(),
    quizId: selectedQuiz.id,
    responses: userResponses
  };

  const key = `${currentStudent.code}_${selectedQuiz.id}`;
  localStorage.setItem(key, JSON.stringify(result));

  if (typeof window.saveResultToFirebase === "function") {
    await window.saveResultToFirebase(result);
  }

  triggerConfetti(3500);

  if (isAutoSubmit) {
    showToast(`⏰ समय समाप्त! आपका Score: ${score}/${selectedQuiz.questions.length}`, "warning", 3000);
  } else {
    showToast(`🎉 बधाई हो! आपका Score: ${score}/${selectedQuiz.questions.length}`, "success", 3000);
  }

  const studentSec = document.getElementById("studentSection");
  if (studentSec) studentSec.classList.remove("hidden");

  const quizDiv = document.getElementById("quiz");
  if (quizDiv) {
    quizDiv.innerHTML = `
      <div class="question-card">
        <h2>🎉 Quiz Submit हो गया!</h2>
        <p>आपका Score: <strong>${score} / ${selectedQuiz.questions.length}</strong></p>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:16px;">
          <button id="viewAkDirectBtn" type="button" class="save-btn">
            📑 View Answer Key & Review (याद करें)
          </button>
          <button id="returnToFoldersBtn" type="button" class="cancel-btn">
            📁 वापस फोल्डर पर जाएँ (Back to Quizzes)
          </button>
        </div>
      </div>
    `;
    quizDiv.scrollIntoView({ behavior: "smooth", block: "start" });

    const viewAkDirectBtn = document.getElementById("viewAkDirectBtn");
    if (viewAkDirectBtn) {
      viewAkDirectBtn.onclick = () => openAnswerKeyModal(selectedQuiz.id);
    }

    const returnBtn = document.getElementById("returnToFoldersBtn");
    if (returnBtn) {
      returnBtn.onclick = () => {
        quizDiv.innerHTML = "";
        renderStudentQuizzes();
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }
  }

  if (selectedQuiz.mode === "practice") {
    showLiveResults(selectedQuiz.id);
  } else {
    const end = getDateTime(selectedQuiz.date, selectedQuiz.end).getTime();
    if (Date.now() >= end) {
      showLiveResults(selectedQuiz.id);
    } else {
      showResultCountdown(end);
    }
  }

  renderStudentQuizzes();
}


// =====================================================
// 🛡️ ANTI-CHEAT & ANTI-SCREENSHOT PROTECTION
// =====================================================

function preventShortcuts(e) {
  if (
    e.key === "PrintScreen" ||
    e.keyCode === 44 ||
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "S" || e.key === "s")) ||
    (e.metaKey && e.shiftKey && (e.key === "4" || e.key === "3" || e.key === "s")) ||
    (e.ctrlKey && (e.key === "u" || e.key === "U" || e.key === "p" || e.key === "P" || e.key === "s" || e.key === "S"))
  ) {
    e.preventDefault();
    e.stopPropagation();
    alert("🔒 सुरक्षा सूचना: Quiz के दौरान Screenshot, Screen Capture या Code Inspect करना सख्त मना है!");
    return false;
  }
}

function preventContextMenu(e) {
  e.preventDefault();
  return false;
}

function preventCopy(e) {
  e.preventDefault();
  return false;
}

function enableAntiCheatProtection() {
  document.addEventListener("keydown", preventShortcuts, true);
  document.addEventListener("contextmenu", preventContextMenu, true);
  document.addEventListener("copy", preventCopy, true);
  document.addEventListener("cut", preventCopy, true);
  document.body.classList.add("no-select-protected");
}

function disableAntiCheatProtection() {
  document.removeEventListener("keydown", preventShortcuts, true);
  document.removeEventListener("contextmenu", preventContextMenu, true);
  document.removeEventListener("copy", preventCopy, true);
  document.removeEventListener("cut", preventCopy, true);
  document.body.classList.remove("no-select-protected");
}


// =====================================================
// ⏳ RESULT COUNTDOWN
// =====================================================

function showResultCountdown(endTime) {
  const quizDiv = document.getElementById("quiz");
  if (!quizDiv) return;

  quizDiv.innerHTML = `
    <div class="question-card">
      <h2>✅ Quiz Submit हो गया</h2>
      <p>🏆 Result Quiz समाप्त होने के बाद दिखेगा।</p>
      <button id="viewAkBtn" type="button" class="save-btn" style="margin-bottom:15px;">
        📑 View Answer Key & Review
      </button>
      <p id="resultCountdown">Loading...</p>
    </div>
  `;
  quizDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  const viewAkBtn = document.getElementById("viewAkBtn");
  if (viewAkBtn && selectedQuiz) {
    viewAkBtn.onclick = () => openAnswerKeyModal(selectedQuiz.id);
  }

  updateResultCountdown(endTime);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => updateResultCountdown(endTime), 1000);
}

function updateResultCountdown(endTime) {
  const element = document.getElementById("resultCountdown");
  if (!element) return;

  const diff = endTime - Date.now();

  if (diff <= 0) {
    clearInterval(countdownTimer);
    if (selectedQuiz) showLiveResults(selectedQuiz.id);
    return;
  }

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  element.innerText = `⏰ Result आने में ${mins} मिनट ${secs} सेकंड`;
}


// =====================================================
// 📑 DETAILED ANSWER KEY & REVIEW MODAL
// =====================================================

function openAnswerKeyModal(quizId) {
  const modal = document.getElementById("answerKeyModal");
  const headerInfo = document.getElementById("answerKeyHeaderInfo");
  const content = document.getElementById("answerKeyContent");

  if (!modal || !headerInfo || !content) return;

  const quiz = quizzes[quizId] || selectedQuiz;
  if (!quiz) {
    alert("❌ Quiz details नहीं मिले।");
    return;
  }

  const resultKey = `${currentStudent ? currentStudent.code : ''}_${quiz.id}`;
  let result = null;

  try {
    const saved = localStorage.getItem(resultKey);
    if (saved) result = JSON.parse(saved);
  } catch (e) {
    console.error("Local result error:", e);
  }

  const totalQs = quiz.questions ? quiz.questions.length : 0;
  const userScore = result ? Number(result.score) : 0;
  const percentage = totalQs > 0 ? Math.round((userScore / totalQs) * 100) : 0;

  headerInfo.innerHTML = `
    <h3>📋 Answer Key & Detailed Review (याद करने के लिए)</h3>
    <p>👤 <strong>Student:</strong> ${escapeHTML(currentStudent ? currentStudent.name : "Student")} (${escapeHTML(currentStudent ? (currentStudent.userClass || "Class 6th") : "")})</p>
    <p>🧠 <strong>Quiz:</strong> ${escapeHTML(quiz.title)}</p>
    <div class="score-badge-big">
      📊 Score: ${userScore} / ${totalQs} (${percentage}%)
    </div>
  `;

  content.innerHTML = "";

  if (!quiz.questions || quiz.questions.length === 0) {
    content.innerHTML = "<p>कोई प्रश्न उपलब्ध नहीं हैं।</p>";
  } else {
    quiz.questions.forEach((q, qIndex) => {
      const resp = result && Array.isArray(result.responses) ? result.responses[qIndex] : null;
      const selectedOpt = resp ? resp.selectedAnswer : -1;
      const correctOpt = Number(q.answer);

      const card = document.createElement("div");
      card.className = "ak-question-card";

      let optionsHTML = "";
      q.options.forEach((optText, optIndex) => {
        let optClass = "ak-option";
        let badge = "";

        if (optIndex === correctOpt) {
          optClass += " correct";
          badge = " ✅ (Correct Answer)";
        }

        if (optIndex === selectedOpt && selectedOpt !== correctOpt) {
          optClass += " wrong-selected";
          badge = " ❌ (Your Answer)";
        } else if (optIndex === selectedOpt && selectedOpt === correctOpt) {
          badge = " 🌟 (Your Choice & Correct Answer)";
        }

        optionsHTML += `
          <div class="${optClass}">
            <span>Option ${String.fromCharCode(65 + optIndex)}: ${escapeHTML(optText)}</span>
            <span>${badge}</span>
          </div>
        `;
      });

      card.innerHTML = `
        <h4>Question ${qIndex + 1}: ${escapeHTML(q.q)}</h4>

        ${q.figure ? `
          <div class="question-figure-box">
            <img src="${escapeHTML(q.figure)}" class="question-figure-img" alt="Question Diagram" />
          </div>
        ` : ""}

        <div class="ak-options">
          ${optionsHTML}
        </div>

        ${q.explanation ? `
          <div class="explanation-box">
            💡 <strong>Explanation / Solution:</strong> ${escapeHTML(q.explanation)}
          </div>
        ` : ""}
      `;

      content.appendChild(card);
    });
  }

  modal.classList.remove("hidden");
  modal.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeAnswerKeyModal() {
  const modal = document.getElementById("answerKeyModal");
  if (modal) modal.classList.add("hidden");
}


// =====================================================
// 👨💼 ADMIN - QUIZ BUILDER (WITH NESTED FOLDER PATH SUPPORT)
// =====================================================

function addQuestion() {
  const container = document.getElementById("adminQuestions");
  if (!container) return;

  questionCounter++;
  const card = document.createElement("div");
  card.className = "admin-question";

  card.innerHTML = `
    <button type="button" class="remove-question">❌</button>
    <h4>Question ${container.children.length + 1}</h4>
    
    <input type="text" class="question-text" placeholder="Question लिखें">
    
    <label style="font-size:13px; font-weight:700; color:#475569;">🖼️ Figure / Diagram Image (URL or File Upload)</label>
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
      <input type="text" class="question-figure-url" placeholder="Image URL (http://...)">
      <input type="file" class="question-figure-file" accept="image/*" style="max-width:200px;">
    </div>
    <img class="admin-figure-preview hidden" src="" alt="Figure Preview" />

    <input type="text" class="option-input" placeholder="Option A">
    <input type="text" class="option-input" placeholder="Option B">
    <input type="text" class="option-input" placeholder="Option C">
    <input type="text" class="option-input" placeholder="Option D">
    
    <label>✅ Correct Answer</label>
    <select class="correct-answer">
      <option value="0">Option A</option>
      <option value="1">Option B</option>
      <option value="2">Option C</option>
      <option value="3">Option D</option>
    </select>

    <label style="font-size:13px; font-weight:700; color:#475569; margin-top:8px;">💡 Explanation / Answer Key Solution (Optional)</label>
    <textarea class="question-explanation" placeholder="हल/व्याख्या लिखें (Student Answer Key में दिखेगा)..." style="min-height:70px;"></textarea>
  `;

  const fileInput = card.querySelector(".question-figure-file");
  const urlInput = card.querySelector(".question-figure-url");
  const previewImg = card.querySelector(".admin-figure-preview");

  if (fileInput && previewImg) {
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          previewImg.src = evt.target.result;
          previewImg.classList.remove("hidden");
          urlInput.value = evt.target.result;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (urlInput && previewImg) {
    urlInput.oninput = () => {
      if (urlInput.value.trim()) {
        previewImg.src = urlInput.value.trim();
        previewImg.classList.remove("hidden");
      } else {
        previewImg.classList.add("hidden");
      }
    };
  }

  card.querySelector(".remove-question").onclick = () => {
    card.remove();
    renumberQuestions();
  };

  container.appendChild(card);
  renumberQuestions();
}

function renumberQuestions() {
  document.querySelectorAll(".admin-question").forEach((card, index) => {
    const heading = card.querySelector("h4");
    if (heading) heading.innerText = `Question ${index + 1}`;
  });
}

function collectQuestions() {
  const questions = [];

  document.querySelectorAll(".admin-question").forEach(card => {
    const question = card.querySelector(".question-text")?.value.trim();
    const figure = card.querySelector(".question-figure-url")?.value.trim() || "";
    const options = Array.from(card.querySelectorAll(".option-input")).map(i => i.value.trim());
    const answer = parseInt(card.querySelector(".correct-answer")?.value, 10);
    const explanation = card.querySelector(".question-explanation")?.value.trim() || "";

    if (question && options.length === 4 && options.every(o => o.length > 0)) {
      questions.push({
        q: question,
        figure: figure,
        options: options,
        answer: Number.isInteger(answer) ? answer : 0,
        explanation: explanation
      });
    }
  });

  return questions;
}

function toggleTimingFieldsByMode(mode) {
  const grid = document.getElementById("quizDateTimeGrid");
  const note = document.getElementById("practiceModeNote");
  const isPractice = mode === "practice";

  if (grid) grid.classList.toggle("hidden", isPractice);
  if (note) note.classList.toggle("hidden", !isPractice);
}

async function saveQuiz() {
  if (!currentStudent || !currentStudent.isAdmin) {
    alert("❌ केवल Admin Quiz बना सकता है।");
    return;
  }

  const title = document.getElementById("quizTitle")?.value.trim();
  const folder = document.getElementById("quizFolder")?.value.trim() || "Live Quizzes";
  const targetClass = document.getElementById("quizClass")?.value || "All Classes";
  const mode = document.getElementById("quizMode")?.value || "live";
  const isPractice = mode === "practice";

  const date = isPractice ? "" : document.getElementById("quizDate")?.value;
  const start = isPractice ? "" : document.getElementById("quizStart")?.value;
  const end = isPractice ? "" : document.getElementById("quizEnd")?.value;
  const questionTime = Number(document.getElementById("questionTime")?.value);

  if (!title) { alert("⚠️ Quiz का नाम डालें!"); return; }

  if (!isPractice) {
    if (!date) { alert("⚠️ Quiz Date चुनें!"); return; }
    if (!start || !end) { alert("⚠️ Start और End Time दोनों चुनें!"); return; }
    if (start >= end) { alert("❌ End Time, Start Time के बाद होना चाहिए!"); return; }
  }

  const questions = collectQuestions();
  if (questions.length === 0) { alert("⚠️ कम से कम 1 पूरा Question add करें!"); return; }

  const quizId = editingQuizId || `quiz_${Date.now()}`;

  const quiz = {
    id: quizId,
    title: title,
    folder: folder,
    targetClass: targetClass,
    mode: mode,
    date: date,
    start: start,
    end: end,
    questionTime: questionTime > 0 ? questionTime : 15,
    questions: questions,
    updatedAt: Date.now()
  };

  if (typeof window.saveQuizToFirebase !== "function") {
    alert("❌ Firebase save function उपलब्ध नहीं है।");
    return;
  }

  const success = await window.saveQuizToFirebase(quiz);
  if (!success) return;

  alert(editingQuizId ? "✅ Quiz update हो गया!" : "✅ Quiz successfully create हो गया!");
  clearQuizForm();
}

function editQuiz(quizId) {
  if (!currentStudent || !currentStudent.isAdmin) return;

  const quiz = quizzes[quizId];
  if (!quiz) return;

  editingQuizId = quizId;

  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.innerText = "✏️ Edit Quiz (Change Folder / Practice Mode)";

  const titleInput = document.getElementById("quizTitle");
  const folderInput = document.getElementById("quizFolder");
  const classInput = document.getElementById("quizClass");
  const modeInput = document.getElementById("quizMode");
  const dateInput = document.getElementById("quizDate");
  const startInput = document.getElementById("quizStart");
  const endInput = document.getElementById("quizEnd");
  const questionTimeInput = document.getElementById("questionTime");

  if (titleInput) titleInput.value = quiz.title || "";
  if (folderInput) folderInput.value = quiz.folder || "Live Quizzes";
  if (classInput) classInput.value = quiz.targetClass || "All Classes";
  if (modeInput) modeInput.value = quiz.mode || "live";
  if (dateInput) dateInput.value = quiz.date || "";
  if (startInput) startInput.value = quiz.start || "";
  if (endInput) endInput.value = quiz.end || "";
  if (questionTimeInput) questionTimeInput.value = quiz.questionTime || 15;

  toggleTimingFieldsByMode(quiz.mode || "live");

  const container = document.getElementById("adminQuestions");
  if (!container) return;

  container.innerHTML = "";
  questionCounter = 0;

  if (Array.isArray(quiz.questions)) {
    quiz.questions.forEach(question => {
      addQuestion();
      const card = container.lastElementChild;
      if (!card) return;

      const questionInput = card.querySelector(".question-text");
      if (questionInput) questionInput.value = question.q || "";

      const figureInput = card.querySelector(".question-figure-url");
      const previewImg = card.querySelector(".admin-figure-preview");
      if (figureInput && question.figure) {
        figureInput.value = question.figure;
        if (previewImg) {
          previewImg.src = question.figure;
          previewImg.classList.remove("hidden");
        }
      }

      const inputs = card.querySelectorAll(".option-input");
      if (Array.isArray(question.options)) {
        question.options.forEach((option, index) => {
          if (inputs[index]) inputs[index].value = option;
        });
      }

      const correct = card.querySelector(".correct-answer");
      if (correct) correct.value = question.answer ?? 0;

      const explanation = card.querySelector(".question-explanation");
      if (explanation) explanation.value = question.explanation || "";
    });
  }

  const cancel = document.getElementById("cancelEditBtn");
  if (cancel) cancel.classList.remove("hidden");

  // Scroll to Edit Form
  const formCard = document.getElementById("formTitle")?.closest(".admin-card");
  if (formCard) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEdit() {
  clearQuizForm();
}

function clearQuizForm() {
  editingQuizId = null;

  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.innerText = "➕ Create New Quiz";

  ["quizTitle", "quizDate", "quizStart", "quizEnd"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const quizFolder = document.getElementById("quizFolder");
  if (quizFolder) quizFolder.value = "Live Quizzes";

  const questionTime = document.getElementById("questionTime");
  if (questionTime) questionTime.value = "15";

  const quizClass = document.getElementById("quizClass");
  if (quizClass) quizClass.value = "All Classes";

  const quizMode = document.getElementById("quizMode");
  if (quizMode) quizMode.value = "live";

  toggleTimingFieldsByMode("live");

  const questions = document.getElementById("adminQuestions");
  if (questions) questions.innerHTML = "";

  questionCounter = 0;
  const cancel = document.getElementById("cancelEditBtn");
  if (cancel) cancel.classList.add("hidden");
}

// =====================================================
// 📚 RENDER SAVED QUIZZES IN ADMIN (WITH NESTED SUB-FOLDERS)
// =====================================================

function renderSavedQuizzes() {
  const container = document.getElementById("savedQuizList");
  if (!container) return;

  const list = Object.values(quizzes);

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-box">📭 अभी कोई Quiz save नहीं है।</div>`;
    return;
  }

  const liveList = [];
  const practiceList = [];
  const expiredList = [];

  list.forEach(quiz => {
    const status = getQuizStatus(quiz);

    if (quiz.mode === "practice") {
      practiceList.push(quiz);
    } else if (status.isExpired || status.finished) {
      expiredList.push(quiz);
    } else {
      liveList.push(quiz);
    }
  });

  container.innerHTML = "";

  // 1. Live Active Folder Tree
  renderSystemFolderCard("🟢 Live Active Quizzes", liveList, container, "admin_qf_live_", false);
  // 2. Unlimited Practice Folder Tree
  renderSystemFolderCard("♾️ Unlimited Practice Quizzes", practiceList, container, "admin_qf_practice_", false);
  // 3. Expired Quizzes Folder Tree
  renderSystemFolderCard("🔴 Expired / Completed Quizzes", expiredList, container, "admin_qf_expired_", false);
}

async function deleteQuiz(quizId) {
  if (!currentStudent || !currentStudent.isAdmin) return;

  const quiz = quizzes[quizId];
  if (!quiz) return;

  const confirmed = confirm(`क्या आप "${quiz.title}" को delete करना चाहते हैं?\n\nइस quiz के सभी results भी delete हो जाएंगे।`);
  if (!confirmed) return;

  if (typeof window.deleteQuizFromFirebase !== "function") {
    alert("❌ Firebase delete function नहीं मिला।");
    return;
  }

  const success = await window.deleteQuizFromFirebase(quizId);
  if (!success) return;

  if (selectedQuiz && selectedQuiz.id === quizId) {
    selectedQuiz = null;
  }

  alert("✅ Quiz delete हो गया!");
}

async function resetQuiz() {
  if (!currentStudent || !currentStudent.isAdmin) {
    alert("❌ केवल Admin Results reset कर सकता है।");
    return;
  }

  if (!selectedQuiz) {
    alert("⚠️ पहले Saved Quiz में जाकर Results button दबाएँ।");
    return;
  }

  const confirmed = confirm(`"${selectedQuiz.title}" के सभी student results delete करें?`);
  if (!confirmed) return;

  if (typeof window.resetAllResults !== "function") {
    alert("❌ Firebase reset function नहीं मिला।");
    return;
  }

  const success = await window.resetAllResults(selectedQuiz.id);
  if (!success) return;

  students.forEach(student => {
    localStorage.removeItem(`${student.code}_${selectedQuiz.id}`);
  });

  alert("✅ इस Quiz के सभी results reset हो गए!");
}


// =====================================================
// 👨💼 STUDENT ID MANAGEMENT (GROUPED IN FOLDERS BY CLASS)
// =====================================================

function renderUserManagement() {
  const adminPanel = document.getElementById("adminPanel");
  if (!adminPanel) return;

  let box = document.getElementById("userManagement");
  if (box) {
    box.remove();
  }

  box = document.createElement("div");
  box.id = "userManagement";
  box.className = "admin-card";

  box.innerHTML = `
    <h3>👥 Student ID Management (Folder View)</h3>

    <div class="user-form">
      <input id="userName" type="text" placeholder="Student Name" autocomplete="off">
      <input id="userCode" type="text" placeholder="Student Code" autocomplete="off">
      <input id="userPassword" type="text" placeholder="Student Password" autocomplete="off">
      
      <label style="font-weight:700; font-size:14px; margin-top:6px; display:block;">🏫 Student Class / Folder:</label>
      <select id="userClass">
        <option value="Class 1st">Class 1st</option>
        <option value="Class 2nd">Class 2nd</option>
        <option value="Class 3rd">Class 3rd</option>
        <option value="Class 4th">Class 4th</option>
        <option value="Class 5th">Class 5th</option>
        <option value="Class 6th" selected>Class 6th</option>
        <option value="Class 7th">Class 7th</option>
        <option value="Class 8th">Class 8th</option>
        <option value="Class 9th">Class 9th</option>
        <option value="Class 10th">Class 10th</option>
        <option value="Class 11th">Class 11th</option>
        <option value="Class 12th">Class 12th</option>
      </select>

      <button id="saveUserBtn" type="button" class="save-btn" style="margin-top:14px;">
        ➕ Create Student ID
      </button>

      <button id="cancelUserBtn" type="button" class="cancel-btn hidden" style="margin-top:14px;">
        ❌ Cancel
      </button>
    </div>

    <hr>
    <div id="userList">Loading folders...</div>
  `;

  const resetButton = document.getElementById("resetBtn");
  if (resetButton && resetButton.parentNode === adminPanel) {
    adminPanel.insertBefore(box, resetButton);
  } else {
    adminPanel.prepend(box);
  }

  const saveBtn = document.getElementById("saveUserBtn");
  if (saveBtn) saveBtn.onclick = saveUser;

  const cancelBtn = document.getElementById("cancelUserBtn");
  if (cancelBtn) cancelBtn.onclick = clearUserForm;

  renderUserList();
}


// =====================================================
// 👥 RENDER USER LIST (GROUPED INTO COLLAPSIBLE FOLDERS WITH AUTO SCROLL)
// =====================================================

function renderUserList() {
  const container = document.getElementById("userList");
  if (!container) return;

  if (students.length === 0) {
    container.innerHTML = "<p>कोई Student ID नहीं है।</p>";
    return;
  }

  // Group Students into Folders by Class
  const classMap = {};
  students.forEach(user => {
    const cls = user.isAdmin ? "👑 Admin Accounts" : (user.userClass || "Class 6th");
    if (!classMap[cls]) classMap[cls] = [];
    classMap[cls].push(user);
  });

  container.innerHTML = "";

  Object.keys(classMap).sort().forEach(className => {
    const userGroup = classMap[className];
    const folderCard = document.createElement("div");
    folderCard.className = "student-folder-card";

    const folderKey = `user_folder_${className}`;
    const isOpen = openStudentFolders[folderKey] === true; // default closed for security

    folderCard.innerHTML = `
      <div class="student-folder-header ${isOpen ? 'open' : ''}">
        <div class="student-folder-title-wrap">
          <span class="student-folder-icon">${isOpen ? '📂' : '📁'}</span>
          <span>${escapeHTML(className)}</span>
        </div>
        <span class="student-folder-count">${userGroup.length} IDs ${isOpen ? '▼' : '▶'}</span>
      </div>
      <div class="student-folder-body ${isOpen ? '' : 'hidden'}">
        ${userGroup.map(user => `
          <div class="student-item" style="margin:0;">
            <div class="student-info">
              <h4>👨🎓 ${escapeHTML(user.name)}</h4>
              <p>Code: <strong>${escapeHTML(user.code)}</strong></p>
              <p>Password: <strong>${escapeHTML(user.password)}</strong></p>
            </div>
            <div class="student-actions">
              ${user.isAdmin ? `
                <span>👑 Admin</span>
              ` : `
                <button class="edit-user" data-code="${escapeHTML(user.code)}">✏️ Edit</button>
                <button class="delete-user" data-code="${escapeHTML(user.code)}">🗑️ Delete</button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const header = folderCard.querySelector(".student-folder-header");
    header.onclick = () => {
      openStudentFolders[folderKey] = !isOpen;
      renderUserList();

      // AUTO SCROLL TO OPENED CLASS FOLDER
      setTimeout(() => {
        const updated = document.querySelector(`[data-folder-key="${folderKey}"]`) || folderCard;
        if (updated) {
          updated.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 50);
    };

    folderCard.setAttribute("data-folder-key", folderKey);
    container.appendChild(folderCard);
  });

  container.querySelectorAll(".edit-user").forEach(button => {
    button.onclick = () => editUser(button.dataset.code);
  });

  container.querySelectorAll(".delete-user").forEach(button => {
    button.onclick = () => deleteUser(button.dataset.code);
  });
}


// =====================================================
// ➕ CREATE / UPDATE USER (WITH CLASS 1ST TO 12TH)
// =====================================================

let isSavingUserUI = false;

async function saveUser() {
  if (isSavingUserUI) return;

  if (!currentStudent || !currentStudent.isAdmin) {
    alert("❌ केवल Admin Student ID manage कर सकता है।");
    return;
  }

  const nameInput = document.getElementById("userName");
  const codeInput = document.getElementById("userCode");
  const passInput = document.getElementById("userPassword");
  const classInput = document.getElementById("userClass");
  const saveBtn = document.getElementById("saveUserBtn");

  const name = nameInput?.value.trim();
  const code = codeInput?.value.trim().toUpperCase();
  const password = passInput?.value.trim();
  const uClass = classInput?.value || "Class 6th";

  if (!name || !code || !password) {
    alert("⚠️ Name, Code और Password भरें!");
    return;
  }

  isSavingUserUI = true;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";
  }

  try {
    const updatedUser = { name: name, code: code, password: password, userClass: uClass, isAdmin: false };

    // Auto open folder for newly created/edited class
    openStudentFolders[`user_folder_${uClass}`] = true;

    if (editingUserCode) {
      const index = students.findIndex(
        user => String(user.code).trim().toUpperCase() === String(editingUserCode).trim().toUpperCase()
      );

      if (index !== -1) {
        const oldCode = students[index].code;
        students[index] = updatedUser;
        renderUserList();

        if (typeof window.saveStudentToFirebase === "function") {
          await window.saveStudentToFirebase(updatedUser, oldCode);
        }

        alert("✅ Student ID successfully update हो गई!");
        clearUserForm();
      }
      return;
    }

    const exists = students.some(
      user => String(user.code).trim().toUpperCase() === code
    );

    if (exists) {
      alert("❌ यह Code पहले से मौजूद है!");
      return;
    }

    students.push(updatedUser);
    renderUserList();

    if (typeof window.saveStudentToFirebase === "function") {
      await window.saveStudentToFirebase(updatedUser);
    }

    alert("✅ नया Student ID create हो गया!");
    clearUserForm();

  } finally {
    isSavingUserUI = false;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = editingUserCode ? "💾 Update Student ID" : "➕ Create Student ID";
    }
  }
}


// =====================================================
// ✏️ EDIT USER
// =====================================================

function editUser(code) {
  const user = students.find(
    student => String(student.code).trim().toUpperCase() === String(code).trim().toUpperCase()
  );

  if (!user) return;
  if (user.isAdmin === true) {
    alert("⚠️ Admin ID यहाँ edit नहीं की जा सकती।");
    return;
  }

  editingUserCode = user.code;

  const name = document.getElementById("userName");
  const codeInput = document.getElementById("userCode");
  const password = document.getElementById("userPassword");
  const userClass = document.getElementById("userClass");

  if (name) name.value = user.name;
  if (codeInput) codeInput.value = user.code;
  if (password) password.value = user.password;
  if (userClass) userClass.value = user.userClass || "Class 6th";

  const saveButton = document.getElementById("saveUserBtn");
  if (saveButton) saveButton.innerText = "💾 Update Student ID";

  const cancelButton = document.getElementById("cancelUserBtn");
  if (cancelButton) cancelButton.classList.remove("hidden");

  const userForm = document.getElementById("userManagement");
  if (userForm) userForm.scrollIntoView({ behavior: "smooth", block: "start" });
}


// =====================================================
// ❌ CLEAR USER FORM
// =====================================================

function clearUserForm() {
  editingUserCode = null;

  const name = document.getElementById("userName");
  const code = document.getElementById("userCode");
  const password = document.getElementById("userPassword");

  if (name) name.value = "";
  if (code) code.value = "";
  if (password) password.value = "";

  const saveButton = document.getElementById("saveUserBtn");
  if (saveButton) saveButton.innerText = "➕ Create Student ID";

  const cancelButton = document.getElementById("cancelUserBtn");
  if (cancelButton) cancelButton.classList.add("hidden");
}


// =====================================================
// 🗑️ DELETE USER
// =====================================================

async function deleteUser(code) {
  if (!currentStudent || !currentStudent.isAdmin) return;

  const user = students.find(
    student => String(student.code).trim().toUpperCase() === String(code).trim().toUpperCase()
  );

  if (!user) return;
  if (user.isAdmin === true) {
    alert("❌ Admin ID delete नहीं की जा सकती।");
    return;
  }

  const confirmed = confirm(`क्या आप "${user.name}" की Student ID delete करना चाहते हैं?`);
  if (!confirmed) return;

  students = students.filter(s => String(s.code).trim().toUpperCase() !== String(code).trim().toUpperCase());
  renderUserList();

  if (typeof window.deleteStudentFromFirebase !== "function") {
    alert("❌ Firebase student delete function नहीं मिला।");
    return;
  }

  const success = await window.deleteStudentFromFirebase(user.code);
  if (!success) return;

  alert("✅ Student ID delete हो गई!");
}


// =====================================================
// 🚪 LOGOUT
// =====================================================

function logout() {
  clearInterval(timer);
  clearInterval(countdownTimer);
  clearTimeout(quizEndTimer);

  timer = null;
  countdownTimer = null;
  quizEndTimer = null;

  disableAntiCheatProtection();

  if (stopResultsListener) {
    stopResultsListener();
    stopResultsListener = null;
  }

  removeLoginSession();

  currentStudent = null;
  selectedQuiz = null;
  quizSubmitted = false;
  currentQuestionIndex = 0;
  score = 0;
  userResponses = [];
  editingQuizId = null;
  editingUserCode = null;
  activeStudentSection = null;
  activeAdminSection = null;

  const code = document.getElementById("code");
  const password = document.getElementById("password");

  if (code) code.value = "";
  if (password) password.value = "";

  const quizArea = document.getElementById("quizArea");
  if (quizArea) quizArea.classList.add("hidden");

  const loginBox = document.getElementById("loginBox");
  if (loginBox) loginBox.classList.remove("hidden");

  const studentSection = document.getElementById("studentSection");
  if (studentSection) studentSection.classList.remove("hidden");

  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) adminPanel.classList.add("hidden");

  const quiz = document.getElementById("quiz");
  if (quiz) quiz.innerHTML = "";

  const results = document.getElementById("results");
  if (results) {
    results.innerHTML = `
      <h3>🏆 Live Quiz Results</h3>
      <p>Quiz select करने के बाद result यहाँ दिखाई देगा।</p>
    `;
  }

  const memberCount = document.getElementById("memberCount");
  if (memberCount) memberCount.innerText = "Live Members: 0";

  alert("🚪 Logout successfully हो गया।");
}


// =====================================================
// 🔗 DOM READY INITS
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  restoreLoginSession();

  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) loginBtn.onclick = login;

  const passwordInput = document.getElementById("password");
  if (passwordInput) {
    passwordInput.onkeydown = (event) => {
      if (event.key === "Enter") login();
    };
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.onclick = logout;

  const addQuestionBtn = document.getElementById("addQuestionBtn");
  if (addQuestionBtn) addQuestionBtn.onclick = addQuestion;

  const saveQuizBtn = document.getElementById("saveQuizBtn");
  if (saveQuizBtn) saveQuizBtn.onclick = saveQuiz;

  const cancelEditBtn = document.getElementById("cancelEditBtn");
  if (cancelEditBtn) cancelEditBtn.onclick = cancelEdit;

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.onclick = resetQuiz;

  const closeAkBtn = document.getElementById("closeAnswerKeyBtn");
  if (closeAkBtn) closeAkBtn.onclick = closeAnswerKeyModal;

  const closeAkFooterBtn = document.getElementById("closeAnswerKeyFooterBtn");
  if (closeAkFooterBtn) closeAkFooterBtn.onclick = closeAnswerKeyModal;

  const quizModeSelect = document.getElementById("quizMode");
  if (quizModeSelect) {
    quizModeSelect.onchange = () => toggleTimingFieldsByMode(quizModeSelect.value);
    toggleTimingFieldsByMode(quizModeSelect.value);
  }

  // 📸 QUICK PHOTO QUIZ BATCH UPLOAD (No Typing Needed!)
  const photoBatchBtn = document.getElementById("quickPhotoBatchBtn");
  const photoBatchInput = document.getElementById("quickPhotoBatchInput");
  const photoBadge = document.getElementById("quickPhotoCountBadge");

  if (photoBatchBtn && photoBatchInput) {
    photoBatchBtn.onclick = () => photoBatchInput.click();

    photoBatchInput.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (photoBadge) photoBadge.innerText = `⏳ ${files.length} फोटो लोड हो रही हैं...`;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            const base64Data = evt.target.result;
            addQuestion(); // Create new empty question card

            // Get the newly created question card (the last one)
            const cards = document.querySelectorAll(".admin-question");
            const lastCard = cards[cards.length - 1];

            if (lastCard) {
              const qTextInput = lastCard.querySelector(".question-text");
              const figUrlInput = lastCard.querySelector(".question-figure-url");
              const previewImg = lastCard.querySelector(".admin-figure-preview");
              const optionInputs = lastCard.querySelectorAll(".option-input");

              if (qTextInput) qTextInput.value = `प्रश्न चित्र देखें (Question Figure ${i + 1})`;
              if (figUrlInput) figUrlInput.value = base64Data;
              if (previewImg) {
                previewImg.src = base64Data;
                previewImg.classList.remove("hidden");
              }

              // Auto-fill standard Options
              const defaultOptions = ["Option A", "Option B", "Option C", "Option D"];
              optionInputs.forEach((optInput, idx) => {
                if (defaultOptions[idx]) optInput.value = defaultOptions[idx];
              });
            }

            resolve();
          };
          reader.readAsDataURL(file);
        });
      }

      if (photoBadge) photoBadge.innerText = `✅ ${files.length} सवाल तुरंत तैयार हो गए!`;
      showToast(`📸 ${files.length} फोटो से सवाल तैयार हो गए! सही उत्तर चुनें।`, "success", 3500);

      // Scroll smoothly down to the questions container
      const questionsContainer = document.getElementById("questionsContainer");
      if (questionsContainer) {
        questionsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      photoBatchInput.value = ""; // Reset
    };
  }

  // Firebase Quizzes Listener
  if (typeof window.listenQuizzes === "function") {
    window.listenQuizzes(data => {
      quizzes = data || {};
      if (currentStudent) {
        if (currentStudent.isAdmin) renderSavedQuizzes();
        else renderStudentQuizzes();
      }
    });
  } else {
    setTimeout(() => {
      if (typeof window.listenQuizzes === "function") {
        window.listenQuizzes(data => {
          quizzes = data || {};
          if (currentStudent) {
            if (currentStudent.isAdmin) renderSavedQuizzes();
            else renderStudentQuizzes();
          }
        });
      }
    }, 700);
  }

  // Firebase Students Listener
  if (typeof window.listenStudents === "function") {
    window.listenStudents(data => {
      updateStudentsFromFirebase(data);
    });
  } else {
    setTimeout(() => {
      if (typeof window.listenStudents === "function") {
        window.listenStudents(data => {
          updateStudentsFromFirebase(data);
        });
      }
    }, 700);
  }
});


function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// 🎉 CELEBRATION CONFETTI ENGINE (HTML5 CANVAS)
// =====================================================

function triggerConfetti(durationMs = 3000) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const colors = ["#f59e0b", "#10b981", "#6366f1", "#ec4899", "#38bdf8", "#ef4444", "#fbbf24"];
  const particles = [];
  const particleCount = 110;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 100,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -18 - 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.45,
      opacity: 1
    });
  }

  const startTime = Date.now();

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.rotSpeed;

      const elapsed = Date.now() - startTime;
      if (elapsed > durationMs - 800) {
        p.opacity = Math.max(0, 1 - (elapsed - (durationMs - 800)) / 800);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (Date.now() - startTime < durationMs) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  animate();
}

window.triggerConfetti = triggerConfetti;
