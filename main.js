// =====================================================
// 🔥 FIREBASE IMPORTS
// =====================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue,
  get,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


// =====================================================
// 🔧 NEW FIREBASE CONFIG (ALPHA QUIZ)
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCYWLPEtOPPdKpzMdp3wk9E92_FCaypqjk",
  authDomain: "alphaquiz-89594.firebaseapp.com",
  databaseURL: "https://alphaquiz-89594-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "alphaquiz-89594",
  storageBucket: "alphaquiz-89594.firebasestorage.app",
  messagingSenderId: "332118754128",
  appId: "1:332118754128:web:8a43a89a6cdbe64b32e255",
  measurementId: "G-T8KECF1V3R"
};

// =====================================================
// 🚀 INITIALIZE FIREBASE
// =====================================================

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


// =====================================================
// 📚 QUIZ LISTENER
// =====================================================

function listenQuizzes(callback) {
  const quizzesRef = ref(db, "quizzes");

  onValue(
    quizzesRef,
    snapshot => {
      callback(snapshot.val() || {});
    },
    error => {
      console.error("❌ Quiz Firebase Error:", error);
      callback({});
    }
  );
}

function syncUserResultsFromFirebase(userCode) {
  if (!userCode) return;
  const code = String(userCode).trim().toUpperCase();
  const resultsRef = ref(db, "results");

  onValue(resultsRef, snapshot => {
    const allResults = snapshot.val() || {};
    Object.keys(allResults).forEach(quizId => {
      const quizResults = allResults[quizId] || {};
      if (quizResults[code]) {
        const key = `${code}_${quizId}`;
        localStorage.setItem(key, JSON.stringify(quizResults[code]));
      }
    });
    if (typeof window.renderStudentQuizzes === "function") {
      window.renderStudentQuizzes();
    }
  });
}

window.syncUserResultsFromFirebase = syncUserResultsFromFirebase;


// =====================================================
// 👨🎓 STUDENT LISTENER & AUTO-SEED ADMIN
// =====================================================

function listenStudents(callback) {
  const studentsRef = ref(db, "students");

  onValue(
    studentsRef,
    snapshot => {
      const data = snapshot.val() || {};
      
      // Ensure Admin ID always exists in Firebase so login never breaks on new project
      if (!data["ADMIN"]) {
        saveStudentToFirebase({
          code: "ADMIN",
          name: "Akprem",
          password: "admin@akprem",
          isAdmin: true,
          userClass: "All Classes"
        });
      }

      callback(data);
      console.log("✅ Students loaded from Firebase:", Object.keys(data).length, "accounts");
    },
    error => {
      console.error("❌ Student Firebase Error:", error);
      callback({});
    }
  );
}


// =====================================================
// ➕ CREATE / UPDATE STUDENT (WITH CLASS PROPERTY)
// =====================================================

let isSavingStudent = false;

async function saveStudentToFirebase(student, oldCode = null) {
  if (isSavingStudent) {
    console.warn("⚠️ Already saving student, duplicate call prevented.");
    return false;
  }

  isSavingStudent = true;

  try {
    if (!student) {
      alert("❌ Student data नहीं मिला।");
      return false;
    }

    const newCode = String(student.code || "").trim().toUpperCase();
    const name = String(student.name || "").trim();
    const password = String(student.password || "").trim();
    const userClass = String(student.userClass || "Class 6th").trim();

    if (!newCode || !name || !password) {
      alert("❌ Name, Code और Password जरूरी हैं।");
      return false;
    }

    const old = oldCode ? String(oldCode).trim().toUpperCase() : null;

    if (old !== newCode) {
      const studentRef = ref(db, `students/${newCode}`);
      const existingSnapshot = await get(studentRef);

      if (existingSnapshot && existingSnapshot.exists()) {
        alert("❌ यह Student Code पहले से मौजूद है।");
        return false;
      }
    }

    const userData = {
      code: newCode,
      name: name,
      password: password,
      userClass: userClass,
      isAdmin: Boolean(student.isAdmin),
      updatedAt: Date.now()
    };

    await set(ref(db, `students/${newCode}`), userData);

    if (old && old !== newCode) {
      await remove(ref(db, `students/${old}`));
      console.log(`🗑️ Old Student Code deleted: ${old}`);
    }

    console.log("✅ Student saved to Firebase:", userData);
    return true;

  } catch (error) {
    console.error("❌ Student Save Error:", error);
    const reason = (error && error.message) ? error.message : "Unknown error";
    const isPermission = /permission/i.test(reason);
    alert(
      `❌ Student ID Firebase में save नहीं हो पाई।\n\nकारण: ${reason}` +
      (isPermission
        ? `\n\n👉 यह Firebase Realtime Database की Security Rules की वजह से हो सकता है। Firebase Console > Realtime Database > Rules में जाकर Read/Write Permission allow (.read: true, .write: true) करें।`
        : "")
    );
    return false;
  } finally {
    isSavingStudent = false;
  }
}


// =====================================================
// 🗑️ DELETE STUDENT
// =====================================================

async function deleteStudentFromFirebase(code) {
  try {
    const studentCode = String(code || "").trim().toUpperCase();

    if (!studentCode) {
      return false;
    }

    await remove(ref(db, `students/${studentCode}`));
    console.log("✅ Student deleted:", studentCode);
    return true;

  } catch (error) {
    console.error("❌ Student Delete Error:", error);
    const reason = (error && error.message) ? error.message : "Unknown error";
    alert(`❌ Student ID delete नहीं हुई।\n\nकारण: ${reason}`);
    return false;
  }
}


// =====================================================
// 💾 SAVE QUIZ (WITH TARGET CLASS & PRACTICE MODE)
// =====================================================

async function saveQuizToFirebase(quiz) {
  try {
    if (!quiz || !quiz.id) {
      alert("❌ Quiz ID missing है।");
      return false;
    }

    await set(ref(db, `quizzes/${quiz.id}`), quiz);
    console.log("✅ Quiz saved:", quiz);
    return true;

  } catch (error) {
    console.error("❌ Quiz Save Error:", error);
    const reason = (error && error.message) ? error.message : "Unknown error";
    alert(`❌ Quiz save नहीं हो पाया।\n\nकारण: ${reason}`);
    return false;
  }
}


// =====================================================
// 🗑️ DELETE QUIZ
// =====================================================

async function deleteQuizFromFirebase(quizId) {
  try {
    if (!quizId) {
      return false;
    }

    await remove(ref(db, `quizzes/${quizId}`));
    await remove(ref(db, `results/${quizId}`));

    console.log("✅ Quiz और results delete हो गए।");
    return true;

  } catch (error) {
    console.error("❌ Quiz Delete Error:", error);
    const reason = (error && error.message) ? error.message : "Unknown error";
    alert(`❌ Quiz delete नहीं हो पाया।\n\nकारण: ${reason}`);
    return false;
  }
}


// =====================================================
// 💾 SAVE RESULT (WITH RESPONSES FOR ANSWER KEY)
// =====================================================

async function saveResultToFirebase(result) {
  try {
    if (!result || !result.code || !result.quizId) {
      return false;
    }

    const code = String(result.code).trim().toUpperCase();

    await set(
      ref(db, `results/${result.quizId}/${code}`),
      {
        code: code,
        name: String(result.name || "Unknown"),
        userClass: String(result.userClass || "Class 6th"),
        score: Number(result.score) || 0,
        totalQuestions: Number(result.totalQuestions) || 0,
        date: Number(result.date) || Date.now(),
        quizId: String(result.quizId),
        responses: Array.isArray(result.responses) ? result.responses : []
      }
    );

    console.log("✅ Result saved.");
    return true;

  } catch (error) {
    console.error("❌ Result Save Error:", error);
    return false;
  }
}


// =====================================================
// 🏆 LIVE RESULTS LISTENER
// =====================================================

let stopResultsListener = null;


// =====================================================
// 🏆 RANKING HELPER
// =====================================================

function getRankHTML(result, rank) {
  const name = escapeHTML(result.name || "Unknown");
  const studentClass = escapeHTML(result.userClass || "Class 6th");
  const scoreText = `${Number(result.score || 0)}/${Number(result.totalQuestions || 0)}`;

  if (rank === 1) {
    return `
      <div class="result-row result-first">
        <div class="rank-number">🥇</div>
        <div class="rank-info">
          <strong>${name} (${studentClass})</strong>
          <small>🏆 1st Place</small>
        </div>
        <div class="rank-score">${scoreText}</div>
      </div>
    `;
  }

  if (rank === 2) {
    return `
      <div class="result-row result-second">
        <div class="rank-number">🥈</div>
        <div class="rank-info">
          <strong>${name} (${studentClass})</strong>
          <small>🏆 2nd Place</small>
        </div>
        <div class="rank-score">${scoreText}</div>
      </div>
    `;
  }

  if (rank === 3) {
    return `
      <div class="result-row result-third">
        <div class="rank-number">🥉</div>
        <div class="rank-info">
          <strong>${name} (${studentClass})</strong>
          <small>🏆 3rd Place</small>
        </div>
        <div class="rank-score">${scoreText}</div>
      </div>
    `;
  }

  return `
    <div class="result-row">
      <div class="rank-number">${rank}.</div>
      <div class="rank-info">
        <strong>${name} (${studentClass})</strong>
      </div>
      <div class="rank-score">${scoreText}</div>
    </div>
  `;
}


// =====================================================
// 🏆 3D OLYMPIC PODIUM HTML (1st, 2nd, 3rd)
// =====================================================

function getPodiumHTML(results) {
  if (!results || results.length === 0) return "";

  const first = results[0] || null;
  const second = results[1] || null;
  const third = results[2] || null;

  return `
    <div class="podium-container">
      <!-- 2nd Place (Silver) -->
      ${second ? `
        <div class="podium-step podium-2nd">
          <div class="podium-avatar-wrap">
            🥈
            <span class="podium-rank-badge">2</span>
          </div>
          <div class="podium-student-name">${escapeHTML(second.name || "Student")}</div>
          <div class="podium-score">${Number(second.score || 0)}/${Number(second.totalQuestions || 0)}</div>
          <div class="podium-pillar">2</div>
        </div>
      ` : `
        <div class="podium-step podium-2nd" style="opacity:0.3;">
          <div class="podium-pillar" style="height:90px;">-</div>
        </div>
      `}

      <!-- 1st Place (Gold / Champion) -->
      ${first ? `
        <div class="podium-step podium-1st">
          <div class="podium-avatar-wrap">
            👑
            <span class="podium-rank-badge">1</span>
          </div>
          <div class="podium-student-name">${escapeHTML(first.name || "Student")}</div>
          <div class="podium-score">${Number(first.score || 0)}/${Number(first.totalQuestions || 0)}</div>
          <div class="podium-pillar">1</div>
        </div>
      ` : ""}

      <!-- 3rd Place (Bronze) -->
      ${third ? `
        <div class="podium-step podium-3rd">
          <div class="podium-avatar-wrap">
            🥉
            <span class="podium-rank-badge">3</span>
          </div>
          <div class="podium-student-name">${escapeHTML(third.name || "Student")}</div>
          <div class="podium-score">${Number(third.score || 0)}/${Number(third.totalQuestions || 0)}</div>
          <div class="podium-pillar">3</div>
        </div>
      ` : `
        <div class="podium-step podium-3rd" style="opacity:0.3;">
          <div class="podium-pillar" style="height:70px;">-</div>
        </div>
      `}
    </div>
  `;
}



// =====================================================
// 🏆 SHOW LIVE RESULTS (WITH CLASS FILTER SUPPORT)
// =====================================================

function showLiveResults(quizId) {
  const resultsDiv = document.getElementById("results");
  const memberCount = document.getElementById("memberCount");
  const classFilterSelect = document.getElementById("resultClassFilter");

  if (!resultsDiv) return;

  resultsDiv.scrollIntoView({ behavior: "smooth", block: "start" });

  if (stopResultsListener) {
    stopResultsListener();
    stopResultsListener = null;
  }

  if (!quizId) {
    resultsDiv.innerHTML = `
      <h3>🏆 Live Quiz Results</h3>
      <p>Quiz select करें।</p>
    `;
    if (memberCount) memberCount.innerText = "Live Members: 0";
    return;
  }

  const resultsRef = ref(db, `results/${quizId}`);

  stopResultsListener = onValue(
    resultsRef,
    snapshot => {
      const data = snapshot.val() || {};
      let results = Object.values(data);

      const filterVal = classFilterSelect ? classFilterSelect.value : "ALL";
      if (filterVal !== "ALL") {
        results = results.filter(r => (r.userClass || "Class 6th") === filterVal);
      }

      results.sort((a, b) => {
        const scoreA = Number(a.score || 0);
        const scoreB = Number(b.score || 0);

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }

        return Number(a.date || 0) - Number(b.date || 0);
      });

      let html = `
        <div class="results-header-flex">
          <h3>🏆 Live Quiz Results</h3>
          <div class="class-filter-box">
            <label for="resultClassFilter">🏫 Filter Class:</label>
            <select id="resultClassFilter">
              <option value="ALL" ${filterVal === 'ALL' ? 'selected' : ''}>All Classes</option>
              <option value="Class 1st" ${filterVal === 'Class 1st' ? 'selected' : ''}>Class 1st</option>
              <option value="Class 2nd" ${filterVal === 'Class 2nd' ? 'selected' : ''}>Class 2nd</option>
              <option value="Class 3rd" ${filterVal === 'Class 3rd' ? 'selected' : ''}>Class 3rd</option>
              <option value="Class 4th" ${filterVal === 'Class 4th' ? 'selected' : ''}>Class 4th</option>
              <option value="Class 5th" ${filterVal === 'Class 5th' ? 'selected' : ''}>Class 5th</option>
              <option value="Class 6th" ${filterVal === 'Class 6th' ? 'selected' : ''}>Class 6th</option>
              <option value="Class 7th" ${filterVal === 'Class 7th' ? 'selected' : ''}>Class 7th</option>
              <option value="Class 8th" ${filterVal === 'Class 8th' ? 'selected' : ''}>Class 8th</option>
              <option value="Class 9th" ${filterVal === 'Class 9th' ? 'selected' : ''}>Class 9th</option>
              <option value="Class 10th" ${filterVal === 'Class 10th' ? 'selected' : ''}>Class 10th</option>
              <option value="Class 11th" ${filterVal === 'Class 11th' ? 'selected' : ''}>Class 11th</option>
              <option value="Class 12th" ${filterVal === 'Class 12th' ? 'selected' : ''}>Class 12th</option>
            </select>
          </div>
        </div>
      `;

      if (results.length === 0) {
        html += `
          <div class="empty-result">
            <p>📭 अभी कोई result नहीं आया है।</p>
          </div>
        `;
      } else {
        html += getPodiumHTML(results.slice(0, 3));
        html += `<div class="all-results"><h4>📊 Complete Ranking (${filterVal})</h4>`;

        results.forEach((r, index) => {
          html += getRankHTML(r, index + 1);
        });

        html += `</div>`;
      }

      resultsDiv.innerHTML = html;
      if (memberCount) memberCount.innerText = `Live Members: ${results.length}`;

      const newFilterSelect = document.getElementById("resultClassFilter");
      if (newFilterSelect) {
        newFilterSelect.onchange = () => showLiveResults(quizId);
      }
    },
    error => {
      console.error("❌ Results Listener Error:", error);
    }
  );
}


// =====================================================
// 🔄 RESET RESULTS
// =====================================================

async function resetAllResults(quizId) {
  try {
    if (!quizId) {
      alert("⚠️ पहले कोई Quiz select करें।");
      return false;
    }

    await remove(ref(db, `results/${quizId}`));
    console.log("✅ Results reset हो गए।");
    return true;

  } catch (error) {
    console.error("❌ Reset Error:", error);
    const reason = (error && error.message) ? error.message : "Unknown error";
    alert(`❌ Results reset नहीं हो सके।\n\nकारण: ${reason}`);
    return false;
  }
}


// =====================================================
// 🤖 GEMINI AI QUIZ GENERATOR ENGINE (UNLIMITED MULTI-PHOTO)
// =====================================================

let uploadedAiImages = [];

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("aiApiKey");
  if (apiKeyInput) {
    const savedKey = localStorage.getItem("gemini_api_key");
    if (savedKey) apiKeyInput.value = savedKey;
    apiKeyInput.onchange = () => {
      localStorage.setItem("gemini_api_key", apiKeyInput.value.trim());
    };
  }

  const fileInput = document.getElementById("aiImageInput");

  if (fileInput) {
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files || []);

      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          uploadedAiImages.push({
            mimeType: file.type || "image/jpeg",
            base64: evt.target.result.split(",")[1],
            name: file.name || "photo"
          });
          renderAiImagePreviews();
        };
        reader.readAsDataURL(file);
      });

      fileInput.value = "";
    };
  }

  const generateBtn = document.getElementById("generateAiQuizBtn");
  if (generateBtn) {
    generateBtn.onclick = handleGenerateAiQuiz;
  }
});

function renderAiImagePreviews() {
  const previewContainer = document.getElementById("aiImagePreviewContainer");
  if (!previewContainer) return;

  if (uploadedAiImages.length === 0) {
    previewContainer.classList.add("hidden");
    previewContainer.innerHTML = "";
    return;
  }

  previewContainer.classList.remove("hidden");
  previewContainer.innerHTML = "";

  uploadedAiImages.forEach((img, index) => {
    const wrap = document.createElement("div");
    wrap.className = "ai-image-thumb-wrap";
    wrap.innerHTML = `
      <img src="data:${img.mimeType};base64,${img.base64}" class="image-preview-thumb" alt="${escapeHTML(img.name)}" />
      <button type="button" class="btn-sm-danger ai-remove-image-btn" data-index="${index}">❌ Remove</button>
    `;
    previewContainer.appendChild(wrap);
  });

  previewContainer.querySelectorAll(".ai-remove-image-btn").forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index, 10);
      uploadedAiImages.splice(idx, 1);
      renderAiImagePreviews();
    };
  });
}

async function handleGenerateAiQuiz() {
  const apiKeyInput = document.getElementById("aiApiKey");
  const promptInput = document.getElementById("aiPromptText");
  const targetClassSelect = document.getElementById("aiTargetClass");
  const numQuestionsInput = document.getElementById("aiNumQuestions");
  const statusDiv = document.getElementById("aiStatus");

  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
  const promptText = promptInput ? promptInput.value.trim() : "";
  const targetClass = targetClassSelect ? targetClassSelect.value : "All Classes";
  const numQuestions = numQuestionsInput ? parseInt(numQuestionsInput.value, 10) : 5;

  if (!apiKey) {
    alert("⚠️ कृपया Gemini API Key डालें!");
    if (apiKeyInput) apiKeyInput.focus();
    return;
  }

  if (!promptText && uploadedAiImages.length === 0) {
    alert("⚠️ कृपया Prompt लिखें या कम से कम एक Photo Upload करें!");
    return;
  }

  localStorage.setItem("gemini_api_key", apiKey);

  if (statusDiv) {
    statusDiv.className = "ai-status loading";
    statusDiv.innerText = uploadedAiImages.length > 0
      ? `⏳ Gemini AI से ${uploadedAiImages.length} Photo(s) के साथ Quiz Generate हो रहा है... कृपया प्रतीक्षा करें।`
      : "⏳ Gemini AI से Quiz Generate हो रहा है... कृपया प्रतीक्षा करें।";
    statusDiv.classList.remove("hidden");
  }

  try {
    const contents = [];
    let userMessageText = `Please generate a quiz for ${targetClass} with ${numQuestions} questions. `;
    if (promptText) {
      userMessageText += `Topic & Instructions: ${promptText}. `;
    }
    if (uploadedAiImages.length > 0) {
      userMessageText += `Use ALL ${uploadedAiImages.length} attached photo(s) as source material for the questions. `;
    }
    userMessageText += `Respond strictly in valid JSON format matching this structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "q": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Detailed explanation of correct answer"
    }
  ]
}
Return ONLY pure JSON without markdown code block ticks.`;

    const parts = [{ text: userMessageText }];

    uploadedAiImages.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64
        }
      });
    });

    contents.push({ parts: parts });

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: contents })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status} Error`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let cleanedJson = rawText.trim();
    if (cleanedJson.startsWith("```json")) {
      cleanedJson = cleanedJson.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (cleanedJson.startsWith("```")) {
      cleanedJson = cleanedJson.replace(/^```/, "").replace(/```$/, "").trim();
    }

    const quizData = JSON.parse(cleanedJson);

    if (!quizData || !Array.isArray(quizData.questions) || quizData.questions.length === 0) {
      throw new Error("Invalid response format from AI");
    }

    const titleInput = document.getElementById("quizTitle");
    const classInput = document.getElementById("quizClass");
    const container = document.getElementById("adminQuestions");

    if (titleInput) titleInput.value = quizData.title || `AI Generated Quiz (${targetClass})`;
    if (classInput) classInput.value = targetClass;

    if (container) {
      container.innerHTML = "";
      quizData.questions.forEach(q => {
        if (typeof window.addQuestion === "function") {
          window.addQuestion();
          const card = container.lastElementChild;
          if (card) {
            const qInput = card.querySelector(".question-text");
            if (qInput) qInput.value = q.q || "";

            const optInputs = card.querySelectorAll(".option-input");
            if (Array.isArray(q.options)) {
              q.options.forEach((opt, idx) => {
                if (optInputs[idx]) optInputs[idx].value = opt;
              });
            }

            const correctSelect = card.querySelector(".correct-answer");
            if (correctSelect) correctSelect.value = Number.isInteger(q.answer) ? q.answer : 0;

            const expText = card.querySelector(".question-explanation");
            if (expText) expText.value = q.explanation || "";
          }
        }
      });
    }

    if (statusDiv) {
      statusDiv.className = "ai-status success";
      statusDiv.innerText = `✅ Successfully Generated ${quizData.questions.length} Questions! Form में भर दिया गया है। Scroll करके Save Quiz दबाएँ।`;
    }

  } catch (error) {
    console.error("❌ Gemini AI Error:", error);
    if (statusDiv) {
      statusDiv.className = "ai-status error";
      statusDiv.innerText = `❌ AI Generation Failed: ${error.message}`;
    }
  }
}


// =====================================================
// 🌐 GLOBAL EXPORTS
// =====================================================

window.listenQuizzes = listenQuizzes;
window.listenStudents = listenStudents;
window.saveStudentToFirebase = saveStudentToFirebase;
window.deleteStudentFromFirebase = deleteStudentFromFirebase;
window.saveQuizToFirebase = saveQuizToFirebase;
window.deleteQuizFromFirebase = deleteQuizFromFirebase;
window.saveResultToFirebase = saveResultToFirebase;
window.showLiveResults = showLiveResults;
window.resetAllResults = resetAllResults;


// =====================================================
// 🛡️ ESCAPE HTML
// =====================================================

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}