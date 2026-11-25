(function () {
  // Acquire VS Code API
  const vscode = acquireVsCodeApi();

  // State
  let notes = [];
  let maxZIndex = 100;
  let activeDrag = null;
  let activeResize = null;
  let workspaceRoot = null;
  // Filtre "ce projet" + prefs UI persistent entre reloads via vscode.setState
  const _vsState = vscode.getState() || {};
  let scopeProjectOnly = Boolean(_vsState.scopeProjectOnly);
  let prefs = _vsState.prefs || { boardTheme: "default", font: "mono", fontSize: "normal", color: "random" };

  function persistState() {
    vscode.setState({ scopeProjectOnly, prefs });
  }

  // DOM Elements
  const board = document.getElementById("board");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const btnCapture = document.getElementById("btnCapture");
  const btnNew = document.getElementById("btnNew");
  const btnClearAll = document.getElementById("btnClearAll");
  const btnPasteNote = document.getElementById("btnPasteNote");
  const btnScope = document.getElementById("btnScope");
  const toast = document.getElementById("toast");

  // Show Toast Message
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  // Generate Unique ID
  function generateId() {
    return "note_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  // Save Notes to Extension State
  function saveState() {
    vscode.postMessage({
      type: "saveNotes",
      notes: notes
    });
  }

  // Update Empty State Visibility
  function updateEmptyState() {
    const visibleNotes = board.querySelectorAll(".postit");
    if (visibleNotes.length === 0) {
      emptyState.style.display = "flex";
    } else {
      emptyState.style.display = "none";
    }
  }

  // Create Post-it DOM Element
  function renderNote(note) {
    const el = document.createElement("div");
    el.className = `postit theme-${note.color || "yellow"}${note.collapsed ? " collapsed" : ""}`;
    el.id = note.id;
    el.style.left = (note.x || 20) + "px";
    el.style.top = (note.y || 20) + "px";
    el.style.zIndex = note.zIndex || ++maxZIndex;
    if (note.w) el.style.width = note.w + "px";

    const sourceTagHtml = note.sourceFile
      ? `<div class="source-tag" title="Aller a la source dans l'IDE" data-file="${note.sourceFile}" data-line="${note.sourceLine || 1}">
           [${note.sourceFile.split(/[/\\]/).pop()}${note.sourceLine ? ":L" + note.sourceLine : ""}]
         </div>`
      : `<div></div>`;

    el.innerHTML = `
      <div class="magnetic-pin" title="Tete magnetique — glissez pour deplacer"></div>
      <div class="postit-header">
        <div class="postit-title-container">
          <span class="postit-title" contenteditable="true" spellcheck="false">${escapeHtml(note.title || "Post-it")}</span>
        </div>
        <div class="postit-actions">
          <button class="icon-btn btn-copy" title="Copier le contenu">C</button>
          <button class="icon-btn btn-paste" title="Coller depuis le presse-papiers">P</button>
          <button class="icon-btn btn-devin-draft" title="Poster dans le chat : insere en brouillon dans le champ de saisie (tu edites, puis Entree)">&#9998;</button>
          <button class="icon-btn btn-devin" title="Envoyer a l'agent : soumet directement le post-it comme message">&#10148;</button>
          <button class="icon-btn btn-collapse" title="${note.collapsed ? "Deplier" : "Reduire"}">${note.collapsed ? "+" : "-"}</button>
          <button class="icon-btn btn-delete" title="Supprimer">x</button>
        </div>
      </div>
      <div class="postit-body">
        <textarea class="postit-textarea" placeholder="Note, code, snippet, URL...">${escapeHtml(note.content || "")}</textarea>
      </div>
      <div class="postit-footer">
        ${sourceTagHtml}
        <div class="palette-picker">
          <div class="palette-dot yellow" data-color="yellow" title="Jaune canari"></div>
          <div class="palette-dot mint" data-color="mint" title="Menthe"></div>
          <div class="palette-dot cyan" data-color="cyan" title="Cyan ciel"></div>
          <div class="palette-dot rose" data-color="rose" title="Rose bonbon"></div>
          <div class="palette-dot purple" data-color="purple" title="Lavande"></div>
          <div class="palette-dot orange" data-color="orange" title="Coucher de soleil"></div>
        </div>
      </div>
      <div class="resize-handle" title="Glisser pour redimensionner (largeur + hauteur)"></div>
    `;

    // Event: Bring to front on click
    el.addEventListener("pointerdown", () => {
      maxZIndex++;
      el.style.zIndex = maxZIndex;
      note.zIndex = maxZIndex;
    });

    // Event: Dragging via Header or Magnetic Pin
    const header = el.querySelector(".postit-header");
    const pin = el.querySelector(".magnetic-pin");

    function startDrag(e) {
      if (e.target.closest(".postit-actions") || e.target.classList.contains("postit-title")) {
        return;
      }
      activeDrag = {
        el: el,
        note: note,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.offsetLeft,
        origY: el.offsetTop
      };
      el.classList.add("dragging");
      maxZIndex += 2;
      el.style.zIndex = maxZIndex;
      note.zIndex = maxZIndex;
      e.preventDefault();
    }

    header.addEventListener("pointerdown", startDrag);
    pin.addEventListener("pointerdown", startDrag);

    // Event: Resize handle (coin bas-droit : largeur + hauteur)
    const resizeHandle = el.querySelector(".resize-handle");
    resizeHandle.addEventListener("pointerdown", (e) => {
      const ta = el.querySelector(".postit-textarea");
      activeResize = {
        el: el,
        ta: ta,
        note: note,
        startX: e.clientX,
        startY: e.clientY,
        origW: el.offsetWidth,
        origH: ta.offsetHeight
      };
      el.classList.add("resizing");
      e.preventDefault();
      e.stopPropagation();
    });

    // Event: Title rename
    const titleEl = el.querySelector(".postit-title");
    titleEl.addEventListener("blur", () => {
      note.title = titleEl.textContent.trim() || "Post-it";
      saveState();
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      }
    });

    // Event: Textarea input
    const textarea = el.querySelector(".postit-textarea");
    if (note.h) textarea.style.height = note.h + "px";
    textarea.addEventListener("input", () => {
      note.content = textarea.value;
      saveState();
    });

    // Event: Quick Copy button
    const btnCopy = el.querySelector(".btn-copy");
    btnCopy.addEventListener("click", () => {
      vscode.postMessage({
        type: "copyToClipboard",
        text: note.content || ""
      });
      showToast("Contenu copie dans le presse-papiers !");
    });

    // Event: Paste button
    const btnPaste = el.querySelector(".btn-paste");
    btnPaste.addEventListener("click", () => {
      vscode.postMessage({
        type: "requestPaste",
        noteId: note.id
      });
    });

    // Event: Draft into active Devin chat composer (no send)
    const btnDevinDraft = el.querySelector(".btn-devin-draft");
    btnDevinDraft.addEventListener("click", () => {
      vscode.postMessage({
        type: "draftToDevin",
        title: note.title || "Post-it",
        text: note.content || "",
        file: note.sourceFile || null,
        line: note.sourceLine || null
      });
    });

    // Event: Send note to Devin agent (direct message)
    const btnDevin = el.querySelector(".btn-devin");
    btnDevin.addEventListener("click", () => {
      vscode.postMessage({
        type: "sendToDevin",
        title: note.title || "Post-it",
        text: note.content || "",
        file: note.sourceFile || null,
        line: note.sourceLine || null
      });
      showToast("Envoi a Devin...");
    });

    // Event: Collapse / Expand
    const btnCollapse = el.querySelector(".btn-collapse");
    btnCollapse.addEventListener("click", () => {
      note.collapsed = !note.collapsed;
      el.classList.toggle("collapsed", note.collapsed);
      btnCollapse.textContent = note.collapsed ? "+" : "-";
      btnCollapse.title = note.collapsed ? "Deplier" : "Reduire";
      saveState();
    });

    // Event: Delete Note
    const btnDelete = el.querySelector(".btn-delete");
    btnDelete.addEventListener("click", () => {
      el.remove();
      notes = notes.filter((n) => n.id !== note.id);
      saveState();
      updateEmptyState();
      showToast("Post-it supprime");
    });

    // Event: Color change
    const dots = el.querySelectorAll(".palette-dot");
    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const color = dot.getAttribute("data-color");
        el.className = el.className.replace(/theme-[a-z]+/g, `theme-${color}`);
        note.color = color;
        saveState();
      });
    });

    // Event: Source Jump
    const sourceTag = el.querySelector(".source-tag");
    if (sourceTag) {
      sourceTag.addEventListener("click", () => {
        const file = sourceTag.getAttribute("data-file");
        const line = parseInt(sourceTag.getAttribute("data-line") || "1", 10);
        vscode.postMessage({
          type: "openSource",
          file: file,
          line: line
        });
      });
    }

    board.appendChild(el);
    updateEmptyState();
  }

  // Global Pointer Move (Magnetic Dragging + Width Resize)
  window.addEventListener("pointermove", (e) => {
    if (activeResize) {
      const dx = e.clientX - activeResize.startX;
      const dy = e.clientY - activeResize.startY;
      const newW = Math.min(640, Math.max(160, activeResize.origW + dx));
      const newH = Math.min(600, Math.max(60, activeResize.origH + dy));
      activeResize.el.style.width = newW + "px";
      activeResize.ta.style.height = newH + "px";
      activeResize.note.w = newW;
      activeResize.note.h = newH;
      return;
    }
    if (!activeDrag) return;

    const dx = e.clientX - activeDrag.startX;
    const dy = e.clientY - activeDrag.startY;

    let newX = activeDrag.origX + dx;
    let newY = activeDrag.origY + dy;

    // Boundaries
    newX = Math.max(5, newX);
    newY = Math.max(5, newY);

    // Magnetic Snapping (edges)
    if (newX < 18) newX = 10;
    if (newY < 18) newY = 10;

    activeDrag.el.style.left = newX + "px";
    activeDrag.el.style.top = newY + "px";
    activeDrag.note.x = newX;
    activeDrag.note.y = newY;
  });

  // Global Pointer Up
  window.addEventListener("pointerup", () => {
    if (activeResize) {
      activeResize.el.classList.remove("resizing");
      activeResize = null;
      saveState();
    }
    if (activeDrag) {
      activeDrag.el.classList.remove("dragging");
      activeDrag = null;
      saveState();
    }
  });

  // Add New Note
  function addNewNote(data = {}) {
    const note = {
      id: generateId(),
      title: data.title || "Note " + (notes.length + 1),
      content: data.content || "",
      color: data.color || (prefs.color === "random" ? getRandomColor() : prefs.color),
      collapsed: false,
      sourceFile: data.sourceFile || null,
      sourceLine: data.sourceLine || null,
      x: 15 + ((notes.length * 25) % 120),
      y: 15 + ((notes.length * 35) % 300),
      zIndex: ++maxZIndex
    };

    notes.push(note);
    renderNote(note);
    applyFilters();
    saveState();
    showToast(data.sourceFile ? "Selection capturee en post-it !" : "Nouveau post-it cree");
  }

  function getRandomColor() {
    const colors = ["yellow", "mint", "cyan", "rose", "purple", "orange"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Top Action: Capture Selection
  btnCapture.addEventListener("click", () => {
    vscode.postMessage({ type: "requestCapture" });
  });

  // Top Action: New Note
  btnNew.addEventListener("click", () => {
    addNewNote();
  });

  // Filtre combine : recherche texte + filtre workspace
  function normPath(p) {
    return (p || "").replace(/\\/g, "/").toLowerCase();
  }

  function noteInWorkspace(note) {
    if (!workspaceRoot) return true;
    if (!note.sourceFile) return true; // notes sans source : visibles dans les deux modes
    return normPath(note.sourceFile).startsWith(normPath(workspaceRoot));
  }

  function applyFilters() {
    const q = searchInput.value.toLowerCase().trim();
    board.querySelectorAll(".postit").forEach((el) => {
      const note = notes.find((n) => n.id === el.id);
      if (!note) return;
      const matchText =
        !q ||
        (note.title && note.title.toLowerCase().includes(q)) ||
        (note.content && note.content.toLowerCase().includes(q)) ||
        (note.sourceFile && note.sourceFile.toLowerCase().includes(q));
      const matchScope = !scopeProjectOnly || noteInWorkspace(note);
      el.style.display = matchText && matchScope ? "flex" : "none";
    });
  }

  function updateScopeBtn() {
    btnScope.classList.toggle("active", scopeProjectOnly);
    btnScope.textContent = scopeProjectOnly ? "Ce projet" : "Tous";
    btnScope.title = scopeProjectOnly
      ? "Notes du workspace courant uniquement — cliquer pour tout afficher"
      : "Toutes les notes (tous projets) — cliquer pour filtrer ce workspace";
  }

  btnScope.addEventListener("click", () => {
    scopeProjectOnly = !scopeProjectOnly;
    persistState();
    updateScopeBtn();
    applyFilters();
  });
  updateScopeBtn();

  // ===== Menu parametres (engrenage) =====
  const btnSettings = document.getElementById("btnSettings");
  const settingsMenu = document.getElementById("settingsMenu");
  const optBoardTheme = document.getElementById("optBoardTheme");
  const optFont = document.getElementById("optFont");
  const optFontSize = document.getElementById("optFontSize");
  const optColor = document.getElementById("optColor");

  function applyPrefs() {
    document.body.className =
      `bt-${prefs.boardTheme} ff-${prefs.font} fs-${prefs.fontSize}`;
    optBoardTheme.value = prefs.boardTheme;
    optFont.value = prefs.font;
    optFontSize.value = prefs.fontSize;
    optColor.value = prefs.color;
  }

  btnSettings.addEventListener("click", (e) => {
    settingsMenu.classList.toggle("open");
    e.stopPropagation();
  });
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".settings-wrap")) {
      settingsMenu.classList.remove("open");
    }
  });

  [
    [optBoardTheme, "boardTheme"],
    [optFont, "font"],
    [optFontSize, "fontSize"],
    [optColor, "color"],
  ].forEach(([sel, key]) => {
    sel.addEventListener("change", () => {
      prefs[key] = sel.value;
      persistState();
      applyPrefs();
    });
  });
  applyPrefs();

  // Top Action: New note from clipboard (e.g. Devin answer)
  btnPasteNote.addEventListener("click", () => {
    vscode.postMessage({ type: "requestPasteAsNote" });
  });

  // Top Action: Clear All
  btnClearAll.addEventListener("click", () => {
    if (notes.length === 0) return;
    if (confirm("Supprimer tous les post-its de ce tableau ?")) {
      notes = [];
      board.querySelectorAll(".postit").forEach((el) => el.remove());
      saveState();
      updateEmptyState();
      showToast("Tableau vide");
    }
  });

  // Search filter (combine avec le filtre workspace)
  searchInput.addEventListener("input", applyFilters);

  // Messages from Extension Host
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.type) {
      case "initNotes":
        notes = message.notes || [];
        if (message.workspaceRoot) workspaceRoot = message.workspaceRoot;
        board.querySelectorAll(".postit").forEach((el) => el.remove());
        notes.forEach((n) => renderNote(n));
        updateEmptyState();
        applyFilters();
        break;

      case "capturedSelection":
        addNewNote({
          title: message.title || "Snippet Code",
          content: message.text || "",
          sourceFile: message.file || null,
          sourceLine: message.line || null
        });
        break;

      case "pasteAsNote":
        addNewNote({
          title: "Depuis Devin",
          content: message.text || ""
        });
        break;

      case "devinSent":
        showToast(
          !message.ok
            ? "Echec de l'envoi a Devin"
            : message.mode === "draft"
              ? "Brouillon insere dans le chat — edite puis Entree"
              : "Post-it envoye a l'agent Devin"
        );
        break;

      case "pasteContent":
        if (message.noteId && message.text) {
          const note = notes.find((n) => n.id === message.noteId);
          if (note) {
            const el = document.getElementById(note.id);
            if (el) {
              const ta = el.querySelector(".postit-textarea");
              ta.value = (ta.value ? ta.value + "\n" : "") + message.text;
              note.content = ta.value;
              saveState();
              showToast("Contenu colle dans le post-it !");
            }
          }
        }
        break;
    }
  });

  // Notify extension that webview is ready
  vscode.postMessage({ type: "ready" });
})();
