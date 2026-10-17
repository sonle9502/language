(() => {
  "use strict";

  // 1. KẾT NỐI SUPABASE
  const cfg = window.SUPABASE_CONFIG || {};
  const configured = cfg.url && cfg.key && !cfg.url.includes("YOUR_PROJECT") && !cfg.key.includes("YOUR_SUPABASE");
  const db = configured && window.supabase ? window.supabase.createClient(cfg.url, cfg.key) : null;

  // Hàm ngắn để lấy phần tử HTML theo ID
  const $ = (id) => document.getElementById(id);

  // 2. TRẠNG THÁI ỨNG DỤNG (STATE)
  const state = {
    mode: "login",
    user: null,
    exams: [],
    currentExam: null,
    questions: [],
    answers: {},
    currentWord: null,
    favorites: [],
    currentPage: "dashboard"
  };

  // Dữ liệu danh sách cấp độ JLPT
  const levels = [
    { level: "N5", jp: "基礎", vi: "Cơ bản · Làm quen tiếng Nhật" },
    { level: "N4", jp: "初級", vi: "Sơ cấp · Mẫu câu thường gặp" },
    { level: "N3", jp: "中級", vi: "Trung cấp · Giao tiếp hằng ngày" },
    { level: "N2", jp: "中上級", vi: "Trung cao cấp · Ngôn ngữ thực tế" },
    { level: "N1", jp: "上級", vi: "Cao cấp · Đọc hiểu chuyên sâu" }
  ];

  // 3. THÔNG BÁO VÀ CHUYỂN TRANG
  let toastTimer;
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function showMessage(message, isError = false) {
    const el = $("auth-message");
    el.textContent = message;
    el.classList.toggle("error", isError);
  }

  function navigate(pageName) {
    state.currentPage = pageName;

    // Ẩn tất cả các trang, chỉ hiện trang được chọn
    ["dashboard", "exam", "result", "favorites", "history"].forEach(p => {
      $(`${p}-page`).classList.toggle("hidden", p !== pageName);
    });

    // Cập nhật trạng thái Active trên Menu
    document.querySelectorAll(".nav-link").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === pageName);
    });

    // Tải dữ liệu tương ứng theo trang
    if (pageName === "dashboard") loadDashboard();
    if (pageName === "favorites") loadFavorites();
    if (pageName === "history") loadHistory();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // 4. CHỨC NĂNG ĐĂNG NHẬP / ĐĂNG XUẤT
  function setAuthMode(mode) {
    state.mode = mode;
    $("tab-login").classList.toggle("selected", mode === "login");
    $("tab-register").classList.toggle("selected", mode === "register");
    $("auth-title").textContent = mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới";
    $("auth-subtitle").textContent = mode === "login" ? "Đăng nhập để tiếp tục hành trình học tiếng Nhật." : "Tạo tài khoản để lưu từ vựng và lịch sử luyện đề.";
    $("auth-submit").innerHTML = mode === "login" ? 'Đăng nhập <span>→</span>' : 'Tạo tài khoản <span>→</span>';
    $("auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
    showMessage("");
  }

  async function handleAuth() {
    if (!db) {
      showMessage("Bạn chưa cấu hình Supabase. Hãy kiểm tra file js/config.js", true);
      return;
    }
    const email = $("auth-email").value.trim();
    const password = $("auth-password").value;

    $("auth-submit").disabled = true;
    showMessage("Đang xử lý...");

    try {
      if (state.mode === "register") {
        const { data, error } = await db.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          state.user = data.user;
          showApp();
          toast("Tạo tài khoản thành công!");
        } else {
          showMessage("Đã tạo yêu cầu. Kiểm tra email xác nhận rồi đăng nhập.");
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.user = data.user;
        showApp();
        toast("Đăng nhập thành công!");
      }
    } catch (err) {
      showMessage(err.message || "Đã xảy ra lỗi, vui lòng thử lại.", true);
    } finally {
      $("auth-submit").disabled = false;
    }
  }

  async function logout() {
    if (db) await db.auth.signOut();
    state.user = null;
    state.exams = [];
    $("auth-view").classList.remove("hidden");
    $("app-view").classList.add("hidden");
    $("main-nav").classList.add("hidden");
    $("user-area").classList.add("hidden");
    toast("Bạn đã đăng xuất.");
  }

  function showApp() {
    $("auth-view").classList.add("hidden");
    $("app-view").classList.remove("hidden");
    $("main-nav").classList.remove("hidden");
    $("user-area").classList.remove("hidden");
    $("user-email").textContent = state.user?.email || "";
    navigate("dashboard");
  }

  // 5. TRANG CHỦ (DASHBOARD) - LẤY DỮ LIỆU & ĐỔ RA CÁC THẺ LEVEL
  async function loadDashboard() {
    if (!db) return;
    const grid = $("levels-grid");
    grid.innerHTML = '<div class="loading">Đang tải kho đề...</div>';

    try {
      // Lấy dữ liệu từ Database
      const [{ data: exams }, { data: results }, { data: favs }] = await Promise.all([
        db.from("jlpt_exams").select("id,level,title,description,question_count").order("level"),
        db.from("jlpt_results").select("score,exam_id"),
        db.from("jlpt_favorites").select("id")
      ]);

      state.exams = exams || [];

      // Cập nhật Thống kê
      $("stat-exams").textContent = (results || []).length;
      $("stat-average").textContent = results?.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) + "%" : "—";
      $("stat-favorites").textContent = (favs || []).length;

      // Đổ danh sách cấp độ ra giao diện
      grid.innerHTML = "";

      levels.forEach(item => {
        const exam = state.exams.find(e => e.level === item.level);

        const card = document.createElement("button");
        card.className = "level-card";
        if (!exam) card.disabled = true;

        card.innerHTML = `
          <div class="level-number">${item.level}</div>
          <h3>${item.jp} · ${item.level}</h3>
          <p>${item.vi}</p>
          <div class="card-bottom">
            <span>${exam ? `${exam.question_count} câu · 1 đề mẫu` : "Chưa có đề"}</span>
            <span class="card-arrow">↗</span>
          </div>
        `;

        card.onclick = () => {
          if (exam) startExam(exam.id);
        };

        grid.appendChild(card);
      });

    } catch (err) {
      grid.innerHTML = `<div class="empty-state">Lỗi tải dữ liệu: ${err.message}</div>`;
    }
  }

  // 6. TRANG LÀM BÀI (EXAM)
  async function startExam(examId) {
    try {
      const exam = state.exams.find(e => e.id === examId);
      if (!exam) throw new Error("Không tìm thấy đề thi.");

      const { data: questions, error } = await db.from("jlpt_questions").select("*").eq("exam_id", examId).order("order_no");
      if (error) throw error;

      state.currentExam = exam;
      state.questions = questions || [];
      state.answers = {};

      $("exam-title").textContent = exam.title;
      $("exam-description").textContent = exam.description || "Chọn một đáp án cho mỗi câu hỏi.";
      $("exam-level-chip").textContent = "JLPT " + exam.level;
      $("total-count").textContent = state.questions.length;

      renderQuestions();
      navigate("exam");
    } catch (err) {
      toast("Không mở được đề: " + err.message);
    }
  }

  function renderQuestions() {
    const container = $("questions-container");
    const jumpNav = $("question-jump");

    container.innerHTML = "";
    jumpNav.innerHTML = "";

    state.questions.forEach((q, index) => {
      const qNum = index + 1;

      const card = document.createElement("article");
      card.className = "question-card";
      card.id = `question-${qNum}`;

      const optionsHtml = (q.options || []).map((op, j) => `
        <label class="option-label ${state.answers[q.id] === j ? "selected" : ""}">
          <input type="radio" name="q-${q.id}" value="${j}" ${state.answers[q.id] === j ? "checked" : ""}>
          <span class="option-letter">${String.fromCharCode(65 + j)}</span>
          <span>${op}</span>
        </label>
      `).join("");

      card.innerHTML = `
        <div class="question-top">
          <span>QUESTION ${String(qNum).padStart(2, "0")}</span>
          <span class="question-type">言語知識 · Từ vựng</span>
        </div>
        <p class="question-text" lang="ja">${q.question_text}</p>
        <div class="question-options">${optionsHtml}</div>
      `;

      card.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.onchange = (e) => {
          state.answers[q.id] = Number(e.target.value);
          card.querySelectorAll(".option-label").forEach(lbl => lbl.classList.remove("selected"));
          e.target.closest(".option-label").classList.add("selected");
          updateExamProgress();
        };
      });

      container.appendChild(card);

      const jumpBtn = document.createElement("button");
      jumpBtn.className = "jump-btn";
      jumpBtn.id = `jump-btn-${q.id}`;
      jumpBtn.textContent = qNum;
      jumpBtn.onclick = () => {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      };

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
      const btn = $(`jump-btn-${q.id}`);
      if (btn) {
        btn.classList.toggle("answered", Object.hasOwn(state.answers, q.id));
      }
    });

    $("submit-hint").textContent = count === total 
      ? "Bạn đã trả lời tất cả câu hỏi. Hãy nộp bài khi sẵn sàng." 
      : `Còn ${total - count} câu chưa chọn đáp án.`;
  }

  async function submitExam() {
    if (!state.currentExam || !db) return;
    const unanswered = state.questions.length - Object.keys(state.answers).length;
    if (unanswered && !confirm(`Còn ${unanswered} câu chưa làm. Bạn có chắc muốn nộp bài?`)) return;

    const btn = $("submit-exam");
    btn.disabled = true;
    btn.textContent = "Đang chấm bài...";

    try {
      const payload = state.questions.map(q => ({
        question_id: q.id,
        selected_option: Object.hasOwn(state.answers, q.id) ? state.answers[q.id] : null
      }));

      const { data, error } = await db.rpc("grade_jlpt_exam", {
        p_exam_id: state.currentExam.id,
        p_answers: payload
      });

      if (error) throw error;
      renderResult(data);
      navigate("result");
    } catch (err) {
      toast("Không thể nộp bài: " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Nộp bài <span>→</span>';
    }
  }

  function renderResult(data) {
    $("result-score").textContent = `${data.score}%`;
    $("result-fraction").textContent = `${data.correct_count} / ${data.total_count} câu đúng`;
    $("result-heading").textContent = data.score >= 80 ? "素晴らしい！ Rất tốt!" : "よくできました！ Làm tốt lắm!";
    $("result-subtitle").textContent = `${state.currentExam.level} · ${state.currentExam.title}`;

    const container = $("result-details");
    container.innerHTML = "";

    (data.details || []).forEach((d, index) => {
      const card = document.createElement("article");
      card.className = `result-card ${d.is_correct ? "correct" : "incorrect"}`;

      card.innerHTML = `
        <div class="result-status">${d.is_correct ? "✓ CHÍNH XÁC" : "✕ CHƯA CHÍNH XÁC"} · CÂU ${index + 1}</div>
        <p class="result-question" lang="ja">${d.question_text}</p>
        <p class="result-answer">Bạn chọn: <b>${d.selected_option == null ? "Chưa chọn" : d.options[d.selected_option]}</b></p>
        <p class="result-answer">Đáp án đúng: <b>${d.options[d.correct_option]}</b></p>
        <p class="result-explanation">${d.explanation || "Chưa có giải thích."}</p>
      `;

      container.appendChild(card);
    });
  }

  // 7. TRANG TỪ YÊU THÍCH (FAVORITES)
  async function loadFavorites() {
    if (!db) return;
    const listEl = $("favorites-list");
    listEl.innerHTML = '<div class="loading">Đang tải...</div>';

    try {
      const { data, error } = await db.from("jlpt_favorites").select("*").order("created_at", { ascending: false });
      if (error) throw error;

      state.favorites = data || [];
      renderFavorites();
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">Lỗi tải từ vựng: ${err.message}</div>`;
    }
  }

  function renderFavorites(query = "") {
    const listEl = $("favorites-list");
    listEl.innerHTML = "";

    const searchKey = query.trim().toLowerCase();
    const filtered = state.favorites.filter(x => 
      [x.word, x.reading, x.meaning].some(v => (v || "").toLowerCase().includes(searchKey))
    );

    $("favorite-count").textContent = `${filtered.length} từ`;

    if (!filtered.length) {
      listEl.innerHTML = '<div class="empty-state">Không tìm thấy từ vựng nào.</div>';
      return;
    }

    filtered.forEach(fav => {
      const card = document.createElement("article");
      card.className = "favorite-card";

      card.innerHTML = `
        <div class="favorite-main">
          <div class="favorite-kanji">${fav.word}</div>
          <div>
            <div class="favorite-reading">${fav.reading || ""}</div>
            <div class="favorite-meaning">${fav.meaning || ""}</div>
            <div class="favorite-example">${fav.example_jp || ""}</div>
            <div class="favorite-reading">${fav.example_vi || ""}</div>
          </div>
        </div>
        <button class="remove-favorite">Xóa ×</button>
      `;

      card.querySelector(".remove-favorite").onclick = async () => {
        await db.from("jlpt_favorites").delete().eq("id", fav.id);
        state.favorites = state.favorites.filter(f => f.id !== fav.id);
        card.remove();
        toast("Đã xóa khỏi yêu thích.");
      };

      listEl.appendChild(card);
    });
  }

  // 8. TRANG LỊCH SỬ HỌC TẬP (HISTORY)
  async function loadHistory() {
    if (!db) return;
    const listEl = $("history-list");
    listEl.innerHTML = '<div class="loading">Đang tải...</div>';

    try {
      const { data, error } = await db.from("jlpt_results")
        .select("id, score, correct_count, total_count, created_at, jlpt_exams(level, title)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      listEl.innerHTML = "";

      if (!data?.length) {
        listEl.innerHTML = '<div class="empty-state">Chưa có lịch sử làm bài.</div>';
        return;
      }

      data.forEach(r => {
        const item = document.createElement("article");
        item.className = "history-card";
        item.innerHTML = `
          <span class="history-level">${r.jlpt_exams?.level || "JLPT"}</span>
          <div class="history-meta">
            <b>${r.jlpt_exams?.title || "Đề luyện tập"}</b>
            <small>${new Date(r.created_at).toLocaleString("vi-VN")}</small>
          </div>
          <span class="history-score">${r.score}%</span>
          <span class="muted">${r.correct_count}/${r.total_count}</span>
        `;
        listEl.appendChild(item);
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state">Lỗi tải lịch sử: ${err.message}</div>`;
    }
  }

  // 9. TRA TỪ ĐIỂN TỪ SUPABASE (DOUBLE CLICK)
  async function handleDoubleClick(event) {
    if (event.target.closest("input, button, label, .dictionary-card")) return;

    const selectedText = window.getSelection()?.toString().trim().replace(/[。、！？!?]/g, "");
    if (!selectedText || selectedText.length > 30) return;

    if (!db) return;

    // Tìm kiếm từ vựng trên bảng jlpt_dictionary của Supabase
    const { data, error } = await db.from("jlpt_dictionary")
      .select("*")
      .ilike("word", `%${selectedText}%`)
      .limit(1)
      .maybeSingle();

    if (data) {
      const foundWord = {
        reading: data.reading,
        meaning: data.meaning,
        example: data.example,
        translation: data.translation
      };

      state.currentWord = { word: data.word, entry: foundWord };

      $("dict-word").textContent = data.word;
      $("dict-reading").textContent = data.reading || "";
      $("dict-meaning").textContent = data.meaning || "";
      $("dict-example-jp").textContent = data.example || "";
      $("dict-example-vi").textContent = data.translation || "";
      $("dictionary-modal").classList.remove("hidden");
    } else {
      toast("Chưa có từ này trong từ điển.");
    }
  }

  async function saveCurrentWord() {
    if (!state.currentWord || !db) return;
    const { word, entry } = state.currentWord;

    try {
      const { data: existing } = await db.from("jlpt_favorites").select("id").eq("word", word).maybeSingle();

      if (existing) {
        await db.from("jlpt_favorites").delete().eq("id", existing.id);
        toast("Đã bỏ lưu từ.");
      } else {
        await db.from("jlpt_favorites").insert({
          user_id: state.user.id,
          word,
          reading: entry.reading,
          meaning: entry.meaning,
          example_jp: entry.example,
          example_vi: entry.translation
        });
        toast("Đã lưu từ vựng!");
      }
      $("dictionary-modal").classList.add("hidden");
    } catch (err) {
      toast("Lỗi lưu từ: " + err.message);
    }
  }

  // 10. GÁN SỰ KIỆN TOÀN CỤC BẰNG WINDOW
  window.navigateTo = navigate;
  window.switchAuthTab = setAuthMode;
  window.handleLogout = logout;

  window.handleAuthSubmit = (event) => {
    if (event) event.preventDefault();
    handleAuth();
  };

  window.handleSubmitExam = submitExam;
  window.closeDictionary = () => $("dictionary-modal").classList.add("hidden");
  window.saveDictionaryWord = saveCurrentWord;

  window.handleSearchFavorites = (query) => renderFavorites(query);
  window.handleTextDoubleClick = handleDoubleClick;

  // Keydown Escape để đóng Modal
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") $("dictionary-modal").classList.add("hidden");
  });

  // 11. KHỞI CHẠY ỨNG DỤNG
  async function init() {
    if (!db) {
      $("auth-view").classList.remove("hidden");
      showMessage("Cần cấu hình Supabase trước khi dùng.", true);
      return;
    }

    const { data: { session } } = await db.auth.getSession();
    if (session) {
      state.user = session.user;
      showApp();
    } else {
      $("auth-view").classList.remove("hidden");
    }

    db.auth.onAuthStateChange((_evt, session) => {
      if (session) {
        state.user = session.user;
        showApp();
      } else {
        state.user = null;
        $("auth-view").classList.remove("hidden");
        $("app-view").classList.add("hidden");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();