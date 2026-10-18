// js/result.js
document.addEventListener("DOMContentLoaded", () => {
  const rawData = localStorage.getItem("last_exam_result");

  if (!rawData) {
    alert("Không tìm thấy dữ liệu kết quả!");
    return;
  }

  try {
    const { examTitle, level, resultData } = JSON.parse(rawData);

    // 1. Cập nhật thông tin Header & Điểm số
    if ($("result-level")) $("result-level").textContent = "JLPT " + (level || "");
    if ($("result-title")) $("result-title").textContent = examTitle || "Bài thi JLPT";
    
    const score = resultData?.score ?? 0;
    if ($("result-score")) $("result-score").textContent = score + "%";

    const headingEl = $("result-heading");
    if (headingEl) {
      if (score >= 80) headingEl.textContent = "🎉 素晴らしい！ Bạn đã hoàn thành xuất sắc bài thi!";
      else if (score >= 50) headingEl.textContent = "👍 よくできました！ Kết quả khá tốt, cố gắng hơn nhé!";
      else headingEl.textContent = "💪 がんばってください！ Cần ôn tập thêm kiến thức nhé!";
    }

    // 2. Lấy mảng câu hỏi chi tiết (Hỗ trợ bắt cả details, questions)
    const details = resultData?.details || resultData?.questions || [];
    const totalCount = resultData?.total_count || details.length || 0;
    const correctCount = resultData?.correct_count || 0;

    // Tính số câu chưa làm
    const skippedCount = details.filter(d => d.selected_option == null && d.user_option == null).length;
    const incorrectCount = Math.max(0, totalCount - correctCount - skippedCount);

    // Điền dữ liệu vào các ô thống kê
    if ($("stat-correct")) $("stat-correct").textContent = correctCount;
    if ($("stat-incorrect")) $("stat-incorrect").textContent = incorrectCount;
    if ($("stat-skipped")) $("stat-skipped").textContent = skippedCount;
    if ($("stat-total")) $("stat-total").textContent = totalCount;

    // 3. Render danh sách chi tiết từng câu
    const container = $("result-details");
    if (!container) return;

    container.innerHTML = "";

    if (details.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">Không có dữ liệu chi tiết câu hỏi.</p>`;
      return;
    }

    details.forEach((d, index) => {
      const card = document.createElement("article");
      const isCorrect = Boolean(d.is_correct);
      card.className = `result-card-item ${isCorrect ? "status-correct" : "status-incorrect"}`;

      // Xử lý giá trị đáp án người dùng chọn
      const userChoice = d.selected_option ?? d.user_option ?? null;
      const correctChoice = d.correct_option ?? d.correct_answer ?? null;

      // Xử lý danh sách lựa chọn A, B, C, D
      let options = d.options;
      if (!options || !Array.isArray(options)) {
        options = [d.option_a || d.a, d.option_b || d.b, d.option_c || d.c, d.option_d || d.d].filter(Boolean);
      }

      let userAnsText = "Chưa chọn";
      if (userChoice != null && options[userChoice] !== undefined) {
        userAnsText = `${String.fromCharCode(65 + Number(userChoice))}. ${options[userChoice]}`;
      }

      let correctAnsText = "N/A";
      if (correctChoice != null && options[correctChoice] !== undefined) {
        correctAnsText = `${String.fromCharCode(65 + Number(correctChoice))}. ${options[correctChoice]}`;
      }

      const questionText = d.question_text || d.content || d.question || "Nội dung câu hỏi";

      card.innerHTML = `
        <div class="result-card-header">
          <span class="q-badge">CÂU ${index + 1}</span>
          <span style="font-size: 13px; font-weight: bold; color: ${isCorrect ? '#10b981' : '#ef4444'}">
            ${isCorrect ? "✓ Chính xác" : "✕ Chưa chính xác"}
          </span>
        </div>

        <div class="q-text" lang="ja">${questionText}</div>

        <div class="answers-comparison">
          <div class="ans-row">
            <span class="ans-label">Bạn chọn:</span>
            <span class="ans-value ${isCorrect ? 'text-correct' : 'text-incorrect'}">${userAnsText}</span>
          </div>
          ${!isCorrect ? `
            <div class="ans-row">
              <span class="ans-label">Đáp án đúng:</span>
              <span class="ans-value text-correct">${correctAnsText}</span>
            </div>
          ` : ''}
        </div>

        ${d.explanation ? `
          <div class="explanation-box">
            💡 <b>Giải thích:</b> ${d.explanation}
          </div>
        ` : ''}
      `;

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Lỗi xử lý dữ liệu kết quả:", err);
    alert("Lỗi hiển thị kết quả: " + err.message);
  }
});

// Hàm hỗ trợ lấy DOM theo ID an toàn
function $(id) {
  return document.getElementById(id);
}