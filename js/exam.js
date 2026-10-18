// exam.js
let db = null;
const $ = (id) => document.getElementById(id);

const state = { currentExam: null, questions: [], answers: {} };

document.addEventListener("DOMContentLoaded", async () => {
  if (window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.key) {
    db = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key);
  } else if (typeof window.db !== "undefined") {
    db = window.db;
  }

  if (!db) return alert("Lỗi: Không tìm thấy cấu hình Supabase.");

  const urlParams = new URLSearchParams(window.location.search);
  const examIdRaw = urlParams.get("id");
  if (!examIdRaw) return alert("Không tìm thấy ID đề thi.");

  const examId = isNaN(examIdRaw) ? examIdRaw : Number(examIdRaw);
  await startExam(examId);
});

async function startExam(examId) {
  try {
    const { data: exam, error: eErr } = await db.from("jlpt_exams").select("*").eq("id", examId).maybeSingle();
    if (eErr || !exam) throw new Error("Không tìm thấy bài thi.");

    const { data: questions, error: qErr } = await db.from("jlpt_questions").select("*").eq("exam_id", examId).order("order_no");
    if (qErr) throw qErr;

    state.currentExam = exam;
    state.questions = questions || [];
    state.answers = {};

    $("exam-title").textContent = exam.title || "Đề thi JLPT";
    $("exam-description").textContent = exam.description || "Chọn một đáp án cho mỗi câu hỏi.";
    $("exam-level-chip").textContent = "JLPT " + (exam.level || "");
    $("total-count").textContent = state.questions.length;

    renderQuestions();
  } catch (err) {
    alert("Lỗi: " + err.message);
  }
}

function renderQuestions() {
  const container = $("questions-container");
  const jumpNav = $("question-jump");
  container.innerHTML = "";
  jumpNav.innerHTML = "";

  state.questions.forEach((q, index) => {
    const qNum = index + 1;
    const questionText = q.question_text || q.content || q.question || "Nội dung câu hỏi";

    let options = Array.isArray(q.options) ? q.options : [q.option_a || q.a, q.option_b || q.b, q.option_c || q.c, q.option_d || q.d].filter(Boolean);

    const card = document.createElement("article");
    card.className = "question-card";
    card.id = `question-${qNum}`;

    const optionsHtml = options.map((op, j) => `
      <label class="option-item ${state.answers[q.id] === j ? "selected" : ""}">
        <input type="radio" name="q-${q.id}" value="${j}" ${state.answers[q.id] === j ? "checked" : ""}>
        <span><b>${String.fromCharCode(65 + j)}.</b> ${op}</span>
      </label>
    `).join("");

    card.innerHTML = `
      <div class="question-top">CÂU ${qNum}</div>
      <p class="question-text">${questionText}</p>
      <div class="option-list">${optionsHtml}</div>
    `;

    card.querySelectorAll('.option-item').forEach(item => {
      item.onclick = () => {
        const radio = item.querySelector('input[type="radio"]');
        radio.checked = true;
        state.answers[q.id] = Number(radio.value);
        card.querySelectorAll('.option-item').forEach(lbl => lbl.classList.remove("selected"));
        item.classList.add("selected");
        updateExamProgress();
      };
    });

    container.appendChild(card);

    const jumpBtn = document.createElement("button");
    jumpBtn.className = "jump-btn";
    jumpBtn.id = `jump-btn-${q.id}`;
    jumpBtn.textContent = qNum;
    jumpBtn.onclick = () => card.scrollIntoView({ behavior: "smooth", block: "start" });
    jumpNav.appendChild(jumpBtn);
  });

  updateExamProgress();
}

function updateExamProgress() {
  const count = Object.keys(state.answers).length;
  const total = state.questions.length;
  $("answered-count").textContent = count;
  $("exam-progress").style.width = (total ? (count / total) * 100 : 0) + "%";

  state.questions.forEach(q => {
    $(`jump-btn-${q.id}`)?.classList.toggle("answered", Object.prototype.hasOwnProperty.call(state.answers, q.id));
  });

  $("submit-hint").textContent = count === total ? "Bạn đã làm xong tất cả câu hỏi." : `Còn ${total - count} câu chưa làm.`;
}

async function submitExam() {
  const unanswered = state.questions.length - Object.keys(state.answers).length;
  if (unanswered > 0 && !confirm(`Còn ${unanswered} câu chưa làm. Bạn có chắc muốn nộp bài?`)) return;

  const btn = $("btn-submit");
  btn.disabled = true;
  btn.textContent = "Đang chấm bài...";

  try {
    const payload = state.questions.map(q => ({
      question_id: q.id,
      selected_option: Object.prototype.hasOwnProperty.call(state.answers, q.id) ? state.answers[q.id] : null
    }));

    const { data, error } = await db.rpc("grade_jlpt_exam", {
      p_exam_id: state.currentExam.id,
      p_answers: payload
    });

    if (error) throw error;

    // Lưu dữ liệu vào LocalStorage để trang result.html đọc
    localStorage.setItem("last_exam_result", JSON.stringify({
      examTitle: state.currentExam.title,
      level: state.currentExam.level,
      resultData: data
    }));

    // Chuyển sang trang kết quả
    window.location.href = "result.html";

  } catch (err) {
    alert("Không thể nộp bài: " + err.message);
    btn.disabled = false;
    btn.textContent = "Nộp bài";
  }
}