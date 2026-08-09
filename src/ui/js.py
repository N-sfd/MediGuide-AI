"""Client-side JS for citations, voice timer, and mobile chrome."""

APP_JS = r"""
() => {
  document.addEventListener("click", (event) => {
    const pill = event.target.closest("a.cite-pill");
    if (!pill) return;
    const href = pill.getAttribute("href") || "";
    if (!href.startsWith("#source-")) return;
    event.preventDefault();
    const target = document.querySelector(href);
    if (!target) return;
    document
      .querySelectorAll(".source-card-highlight")
      .forEach((el) => el.classList.remove("source-card-highlight"));
    target.classList.add("source-card-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  const pad = (n) => String(n).padStart(2, "0");
  let seconds = 0;
  let timerId = null;

  const renderTimer = () => {
    const el = document.getElementById("mg-voice-timer");
    if (!el || el.textContent === "Paused") return;
    el.textContent = `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  };

  window.mgVoiceTimer = {
    start() {
      seconds = 0;
      renderTimer();
      if (timerId) clearInterval(timerId);
      timerId = setInterval(() => {
        seconds += 1;
        renderTimer();
      }, 1000);
    },
    pause() {
      if (timerId) clearInterval(timerId);
      timerId = null;
    },
    reset() {
      if (timerId) clearInterval(timerId);
      timerId = null;
      seconds = 0;
    },
  };

  document.addEventListener("click", (event) => {
    const start = event.target.closest("#mg-voice-start");
    if (start) window.mgVoiceTimer.start();
    const label = event.target.closest("button")?.textContent?.trim();
    const inVoice = event.target.closest("#mg-voice");
    if (inVoice && label === "Pause") window.mgVoiceTimer.pause();
    if (inVoice && (label === "Finish" || label === "Cancel")) {
      window.mgVoiceTimer.reset();
    }
    if (label === "Record again") window.mgVoiceTimer.reset();

    if (event.target.closest("#mg-menu-btn")) {
      document.getElementById("mg-shell")?.classList.toggle("mg-sidebar-open");
    }
    if (event.target.closest("#mg-sidebar-backdrop")) {
      document.getElementById("mg-shell")?.classList.remove("mg-sidebar-open");
    }
    if (event.target.closest("#mg-evidence-sheet-toggle")) {
      document.getElementById("mg-shell")?.classList.toggle("mg-evidence-open");
    }
    if (event.target.closest("#mg-evidence-sheet-close")) {
      document.getElementById("mg-shell")?.classList.remove("mg-evidence-open");
    }

    if (event.target.closest("#mg-hero-ask")) {
      const input = document.querySelector(
        "#mg-composer-input textarea, #mg-composer-input input"
      );
      document.getElementById("mg-composer")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      input?.focus();
    }
    if (event.target.closest("#mg-hero-how") ||
        event.target.closest("#mg-prepare-visit")) {
      document.getElementById("mg-how-it-works")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
}
"""
