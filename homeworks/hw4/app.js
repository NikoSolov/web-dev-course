const exprDisplay = document.getElementById("exprDisplay");
const resultDisplay = document.getElementById("resultDisplay");
const historyList = document.getElementById("historyList");
const historyEmpty = document.getElementById("historyEmpty");
const historyPanel = document.getElementById("historyPanel");

const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

const STORAGE_KEY = "webcalc_v1";

let state = {
  expr: "0",
  result: "0",
  history: []
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    if (typeof parsed.expr === "string") state.expr = parsed.expr;
    if (typeof parsed.result === "string") state.result = parsed.result;

    if (Array.isArray(parsed.history)) state.history = parsed.history;
  } catch (e) {
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setExpr(next) {
  state.expr = normalizeLeadingZero(next);
  exprDisplay.textContent = state.expr || "0";
  saveState();
}

function setResult(next) {
  state.result = String(next);
  resultDisplay.textContent = state.result;
  saveState();
}

function normalizeLeadingZero(expr) {
  if (!expr) return "0";
  if (expr === "0") return "0";
  if (/^0\d/.test(expr)) return expr.replace(/^0+/, "");
  return expr;
}

function isOperator(ch) {
  return ["+", "-", "*", "/", "%", "^"].includes(ch);
}

function lastChar() {
  return state.expr?.slice(-1) ?? "";
}

function appendValue(v) {
  let expr = state.expr;

  if (expr === "0" && /[0-9]/.test(v)) {
    expr = v;
  } else {
    expr += v;
  }
  setExpr(expr);
  preview();
}

function clearAll() {
  state.expr = "0";
  state.result = "0";
  state.history = [];
  render();
  saveState();
}

function clearExpr() {
  setExpr("0");
  setResult("0");
}

function backspace() {
  let expr = state.expr;
  if (!expr || expr === "0") return;

  expr = expr.slice(0, -1);
  if (expr.length === 0) expr = "0";
  setExpr(expr);
  preview();
}

function toggleParen() {
  const expr = state.expr === "0" ? "" : state.expr;
  const openCount = (expr.match(/\(/g) || []).length;
  const closeCount = (expr.match(/\)/g) || []).length;

  const lc = expr.slice(-1);

  if (openCount > closeCount && (/\d|\)/.test(lc))) {
    setExpr(expr + ")");
  } else {
    if (/\d|\)/.test(lc)) setExpr(expr + "*(");
    else setExpr(expr + "(");
  }
  preview();
}

function useAns() {
  const ans = state.result ?? "0";
  const expr = state.expr === "0" ? "" : state.expr;
  const lc = expr.slice(-1);
  const glue = (/\d|\)/.test(lc)) ? "*" : "";
  setExpr((expr || "") + glue + ans);
  preview();
}

function normalizeTextExpression(expr) {
  const allowed = /^[0-9+\-*/%^().\s]+$/;
  if (!allowed.test(expr)) throw new Error("Недопустимые символы");

  return expr.replace(/\^/g, "**");
}

function safeEvalExpression(expr) {
  const sanitized = normalizeTextExpression(expr);

  const trimmed = sanitized.trim();
  if (!trimmed) throw new Error("Пустое выражение");

  const fn = new Function(`"use strict"; return (${trimmed});`);
  const value = fn();

  if (!Number.isFinite(value)) throw new Error("Ошибка вычисления");
  return value;
}

function formatNumber(n) {
  const rounded = Math.round((n + Number.EPSILON) * 1e12) / 1e12;
  return String(rounded);
}

function preview() {
  try {
    const expr = state.expr;
    const lc = lastChar();
    if (isOperator(lc) || lc === "(" || lc === "." ) return;

    const val = safeEvalExpression(expr);
    setResult(formatNumber(val));
  } catch {
  }
}

function equals() {
  try {
    const expr = state.expr;
    const val = safeEvalExpression(expr);
    const formatted = formatNumber(val);

    setResult(formatted);

    const item = { expr, result: formatted, ts: Date.now() };
    state.history.unshift(item);

    state.history = state.history.slice(0, 40);

    renderHistory();
    saveState();
  } catch (e) {
    setResult("Ошибка");
  }
}

function render() {
  exprDisplay.textContent = state.expr || "0";
  resultDisplay.textContent = state.result || "0";
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!state.history.length) {
    historyEmpty.style.display = "block";
    return;
  }
  historyEmpty.style.display = "none";

  for (const item of state.history) {
    const div = document.createElement("div");
    div.className = "history-item";
    div.setAttribute("role", "listitem");
    div.tabIndex = 0;

    const expr = document.createElement("div");
    expr.className = "history-expr";
    expr.textContent = item.expr;

    const res = document.createElement("div");
    res.className = "history-res";
    res.textContent = item.result;

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = new Date(item.ts).toLocaleString("ru-RU");

    div.appendChild(expr);
    div.appendChild(res);
    div.appendChild(meta);

    const loadThis = () => {
      setExpr(item.expr);
      setResult(item.result);
    };

    div.addEventListener("click", loadThis);
    div.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        loadThis();
      }
    });

    historyList.appendChild(div);
  }
}

function clearHistory() {
  state.history = [];
  renderHistory();
  saveState();
}

function toggleHistory() {
  const isHidden = historyPanel.classList.toggle("hidden");
  toggleHistoryBtn.setAttribute("aria-expanded", String(!isHidden));
  toggleHistoryBtn.textContent = isHidden ? "Журнал (скрыт)" : "Журнал";
}

function handleKeyButtonClick(btn) {
  const action = btn.dataset.action;
  const value = btn.dataset.value;

  if (action === "clear") return clearExpr();
  if (action === "backspace") return backspace();
  if (action === "equals") return equals();
  if (action === "paren") return toggleParen();
  if (action === "ans") return useAns();

  if (value) {
    const lc = lastChar();
    if (isOperator(value)) {
      if (state.expr === "0" && value !== "-") return;
      if (isOperator(lc)) {
        const next = state.expr.slice(0, -1) + value;
        setExpr(next);
        return;
      }
      if (lc === "(" && value !== "-") return;
    }

    if (value === ".") {
      const expr = state.expr;
      const tail = expr.split(/[\+\-\*\/%\^\(\)]/).pop() || "";
      if (tail.includes(".")) return;
      if (isOperator(lc) || lc === "(") {
        return appendValue("0.");
      }
    }

    if (value === "(") {
      const expr = state.expr === "0" ? "" : state.expr;
      const l = expr.slice(-1);
      const glue = (/\d|\)/.test(l)) ? "*(" : "(";
      setExpr(expr + glue);
      return;
    }

    appendValue(value);
  }
}

function setupButtons() {
  document.querySelectorAll(".key").forEach((btn) => {
    btn.addEventListener("click", () => handleKeyButtonClick(btn));
  });
}

function setupTopButtons() {
  toggleHistoryBtn.addEventListener("click", toggleHistory);
  clearHistoryBtn.addEventListener("click", clearHistory);
  clearAllBtn.addEventListener("click", clearAll);
}

function setupKeyboard() {
  document.addEventListener("keydown", (e) => {
    const k = e.key;

    if (k === "Escape") {
      e.preventDefault();
      clearExpr();
      return;
    }

    if (k === "Enter" || k === "=") {
      e.preventDefault();
      equals();
      return;
    }

    if (k === "Backspace") {
      e.preventDefault();
      backspace();
      return;
    }

    if (k === "(" || k === ")") {
      e.preventDefault();
      if (k === "(") {
        const expr = state.expr === "0" ? "" : state.expr;
        const l = expr.slice(-1);
        const glue = (/\d|\)/.test(l)) ? "*(" : "(";
        setExpr(expr + glue);
      } else {
        const expr = state.expr === "0" ? "" : state.expr;
        setExpr(expr + ")");
      }
      preview();
      return;
    }

    const allowed = "0123456789+-*/%^.";
    if (allowed.includes(k)) {
      e.preventDefault();
      if (isOperator(k)) {
        const lc = lastChar();
        if (state.expr === "0" && k !== "-") return;
        if (isOperator(lc)) {
          setExpr(state.expr.slice(0, -1) + k);
          return;
        }
        if (lc === "(" && k !== "-") return;
      }

      if (k === ".") {
        const expr = state.expr;
        const tail = expr.split(/[\+\-\*\/%\^\(\)]/).pop() || "";
        if (tail.includes(".")) return;
        const lc = lastChar();
        if (isOperator(lc) || lc === "(") {
          appendValue("0.");
          return;
        }
      }

      appendValue(k);
    }
  });
}

loadState();
render();
setupButtons();
setupTopButtons();
setupKeyboard();

preview();
