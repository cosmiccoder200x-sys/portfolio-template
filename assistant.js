(() => {
  "use strict";

  const launcher = document.getElementById("ai-launcher");
  const panel = document.getElementById("ai-panel");
  const closeButton = document.getElementById("ai-close");
  const form = document.getElementById("ai-form");
  const input = document.getElementById("ai-input");
  const sendButton = document.getElementById("ai-send");
  const messages = document.getElementById("ai-messages");
  const webSearch = document.getElementById("ai-web-search");
  const modeHint = document.getElementById("ai-mode-hint");
  const status = document.getElementById("ai-status");
  const clearButton = document.getElementById("ai-clear");

  if (!launcher || !panel || !form || !input || !messages) return;

  const history = [];
  let busy = false;

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
    else launcher.focus();
  }

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  // Render bold Markdown using DOM nodes, never injecting model output as HTML.
  function renderMessageText(element, content) {
    const parts = String(content).split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((part) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        element.appendChild(strong);
      } else {
        element.appendChild(document.createTextNode(part));
      }
    });
  }

  function addMessage(role, content, sources = [], error = false) {
    const wrapper = document.createElement("article");
    wrapper.className = "ai-message " + role + (error ? " error" : "");

    const label = document.createElement("div");
    label.className = "ai-message-label";
    label.textContent = role === "user" ? "YOU" : error ? "ASSISTANT / NOTICE" : "ASK SREERANG";
    wrapper.appendChild(label);

    const bubble = document.createElement("div");
    bubble.className = "ai-message-bubble";
    if (role === "assistant" && !error) renderMessageText(bubble, content);
    else bubble.textContent = content;
    wrapper.appendChild(bubble);

    if (sources.length) {
      const sourceWrap = document.createElement("div");
      sourceWrap.className = "ai-sources";
      const sourceLabel = document.createElement("div");
      sourceLabel.className = "ai-sources-label";
      sourceLabel.textContent = "WEB SOURCES";
      sourceWrap.appendChild(sourceLabel);

      sources.forEach((source) => {
        try {
          const url = new URL(source.url);
          if (!["https:", "http:"].includes(url.protocol)) return;
          const link = document.createElement("a");
          link.className = "ai-source";
          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = source.title || url.hostname;
          sourceWrap.appendChild(link);
        } catch (_) {}
      });
      wrapper.appendChild(sourceWrap);
    }

    messages.appendChild(wrapper);
    scrollToBottom();
    return wrapper;
  }

  function showThinking() {
    const item = document.createElement("div");
    item.className = "ai-thinking";
    item.textContent = "THINKING";
    messages.appendChild(item);
    scrollToBottom();
    return item;
  }

  async function ask(question) {
    const text = question.trim();
    if (!text || busy) return;

    const welcome = messages.querySelector(".ai-welcome");
    if (welcome) welcome.remove();

    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";
    input.style.height = "42px";
    busy = true;
    sendButton.disabled = true;
    status.textContent = "GENERATING RESPONSE";
    const thinking = showThinking();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(-8, -1),
          webSearch: webSearch.checked
        })
      });
      const data = await response.json();
      thinking.remove();

      if (!response.ok) throw new Error(data.error || "The assistant is temporarily unavailable.");
      addMessage("assistant", data.answer, Array.isArray(data.sources) ? data.sources : []);
      history.push({ role: "assistant", content: data.answer });
      if (history.length > 10) history.splice(0, history.length - 10);
      status.textContent = data.notice ? "FALLBACK RESPONSE · WEB SEARCH UNAVAILABLE" : (data.searched ? "ANSWER GROUNDED WITH WEB SOURCES" : ((data.provider || "AI").toUpperCase() + " RESPONSE GENERATED"));
      if (data.notice) addMessage("assistant", data.notice, [], true);
    } catch (error) {
      thinking.remove();
      addMessage("assistant", error.message || "Something went wrong. Please try again.", [], true);
      status.textContent = "REQUEST FAILED";
    } finally {
      busy = false;
      sendButton.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  closeButton.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) setOpen(false);
  });

  webSearch.addEventListener("change", () => {
    modeHint.textContent = webSearch.checked ? "AUTO" : "OFF";
    status.textContent = webSearch.checked ? "LIVE SEARCH ENABLED" : "LIVE SEARCH DISABLED";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(input.value);
  });

  input.addEventListener("input", () => {
    input.style.height = "42px";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  messages.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt]");
    if (button) ask(button.dataset.prompt || "");
  });

  clearButton.addEventListener("click", () => {
    history.length = 0;
    messages.replaceChildren();
    const welcome = document.createElement("div");
    welcome.className = "ai-welcome";
    welcome.innerHTML = '<span class="ai-eyebrow">CONVERSATION RESET</span><h3>What would you<br>like to explore?</h3><p>Ask about my projects, technical skills, education, or any general topic.</p><div class="ai-suggestions"><button type="button" data-prompt="Tell me about Sreerang and his technical interests.">ABOUT SREERANG <span>↗</span></button><button type="button" data-prompt="Explain the Local Brain MCP project and its architecture.">LOCAL BRAIN MCP <span>↗</span></button><button type="button" data-prompt="What are the latest developments in AI agents?">LATEST IN AI <span>↗</span></button></div>';
    messages.appendChild(welcome);
    status.textContent = "CONVERSATION CLEARED";
  });

  status.textContent = "READY WHEN YOU ARE";
})();
