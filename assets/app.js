// Mobile nav toggle
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector("#navLinks");
  if (!toggle || !links) return;

  toggle.addEventListener("click", function () {
    var open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  // Close menu when a link is clicked (mobile)
  links.addEventListener("click", function (e) {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();

// Contact form friendly feedback
(function () {
  var form = document.querySelector("#contactForm");
  var status = document.querySelector("#formStatus");
  if (!form || !status) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = (form.querySelector("#name") || {}).value || "friend";
    status.textContent = "Thanks, " + name + "! Your message is on its way. 🌼";
    status.style.display = "block";
    form.reset();
  });
})();

// To-do list app
(function () {
  var app = document.querySelector("#todoApp");
  if (!app) return;

  var form = app.querySelector("#todoForm");
  var dateInput = app.querySelector("#todoDate");
  var taskInput = app.querySelector("#todoTask");
  var list = app.querySelector("#todoList");
  var emptyState = app.querySelector("#todoEmpty");
  var statusEl = app.querySelector("#todoStatus");
  var foot = app.querySelector("#todoFoot");
  var count = app.querySelector("#todoCount");
  var clearBtn = app.querySelector("#todoClear");
  var priorityGroup = app.querySelector(".seg");
  var emojiGroup = app.querySelector(".emoji-row");

  // ===== Supabase client =====
  var SUPABASE_URL = "https://bqqirjfhwevuvtgfwrmm.supabase.co";
  var SUPABASE_KEY = "sb_publishable_yZSnrjd1UQna-EtAmDR7eQ_hvThEz23";
  var sb = null;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (err) {
      console.error("Supabase init failed:", err);
    }
  } else {
    console.error("Supabase library not loaded.");
  }

  var statusTimer = null;
  function showError(msg) {
    if (!statusEl) { console.error(msg); return; }
    statusEl.textContent = msg;
    statusEl.hidden = false;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.hidden = true; }, 5000);
  }
  function clearStatus() {
    if (statusEl) statusEl.hidden = true;
  }

  // ===== Local storage for fields not stored in Supabase =====
  // Supabase table only has id / date / created_at. text, priority, emoji, done
  // are kept client-side in localStorage, keyed by the Supabase row id.
  var LOCAL_KEY = "todos_local_data";
  function getLocalData() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function setLocalData(data) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(data)); }
    catch (e) { console.error("localStorage write failed:", e); }
  }
  function saveLocal(id, payload) {
    if (!id) return;
    var data = getLocalData();
    data[id] = payload;
    setLocalData(data);
  }
  function getLocal(id) {
    return id ? (getLocalData()[id] || {}) : {};
  }
  function removeLocal(id) {
    if (!id) return;
    var data = getLocalData();
    delete data[id];
    setLocalData(data);
  }
  function clearLocal() { setLocalData({}); }

  // Currently selected priority + emoji (defaults: medium / none)
  var selectedPriority = "medium";
  var selectedEmoji = "";

  function selectInGroup(group, btn, itemSelector) {
    var siblings = group.querySelectorAll(itemSelector);
    siblings.forEach(function (s) {
      s.classList.remove("is-active");
      s.setAttribute("aria-checked", "false");
    });
    btn.classList.add("is-active");
    btn.setAttribute("aria-checked", "true");
  }

  if (priorityGroup) {
    priorityGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".seg-btn");
      if (!btn) return;
      selectInGroup(priorityGroup, btn, ".seg-btn");
      selectedPriority = btn.getAttribute("data-pri") || "medium";
    });
  }

  if (emojiGroup) {
    emojiGroup.addEventListener("click", function (e) {
      var btn = e.target.closest(".emo-btn");
      if (!btn) return;
      selectInGroup(emojiGroup, btn, ".emo-btn");
      selectedEmoji = btn.getAttribute("data-emoji") || "";
    });
  }

  function resetPickers() {
    selectedPriority = "medium";
    selectedEmoji = "";
    if (priorityGroup) {
      var medBtn = priorityGroup.querySelector('.seg-btn[data-pri="medium"]');
      if (medBtn) {
        selectInGroup(priorityGroup, medBtn, ".seg-btn");
      }
    }
    if (emojiGroup) {
      var noneBtn = emojiGroup.querySelector('.emo-btn[data-emoji=""]');
      if (noneBtn) {
        selectInGroup(emojiGroup, noneBtn, ".emo-btn");
      }
    }
  }

  // Default the date to today so the calendar opens pre-filled
  var today = new Date();
  var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
  dateInput.value = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());

  function formatDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function updateFoot() {
    var items = list.querySelectorAll(".todo-item");
    var done = list.querySelectorAll(".todo-item.done").length;
    var left = items.length - done;
    if (items.length === 0) {
      foot.hidden = true;
      emptyState.hidden = false;
      return;
    }
    foot.hidden = false;
    emptyState.hidden = true;
    count.textContent = done + " of " + items.length + " tasks completed";
  }

  // Build a DOM item from a database row { id, text, date, priority, emoji, done }
  function renderTodo(row) {
    var li = document.createElement("li");
    li.className = "todo-item";
    if (row.done) li.classList.add("done");
    if (row.id) li.dataset.id = row.id;

    var check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo-check";
    check.checked = !!row.done;
    check.setAttribute("aria-label", "Mark task done");

    var emojiEl = document.createElement("span");
    emojiEl.className = "todo-emoji";
    emojiEl.textContent = row.emoji || "";

    var textEl = document.createElement("span");
    textEl.className = "todo-text";
    textEl.textContent = row.text || "";

    var priEl = document.createElement("span");
    priEl.className = "todo-pri pri-" + (row.priority || "none");
    priEl.textContent = row.priority || "";

    var dateEl = document.createElement("span");
    dateEl.className = "todo-date";
    dateEl.textContent = formatDate(row.date);

    var del = document.createElement("button");
    del.type = "button";
    del.className = "todo-delete";
    del.setAttribute("aria-label", "Delete task");
    del.innerHTML = "&times;";

    li.appendChild(check);
    li.appendChild(emojiEl);
    li.appendChild(textEl);
    li.appendChild(priEl);
    li.appendChild(dateEl);
    li.appendChild(del);
    list.appendChild(li);
    return li;
  }

  // Insert a new row (task/date/is_complete in Supabase; priority/emoji local), then render
  async function addItem(text, iso, priority, emoji) {
    if (!sb) { showError("Database not connected. Cannot save."); return; }
    try {
      var res = await sb.from("todos").insert({
        task: text,
        date: iso,
        is_complete: false
      }).select();
      if (res.error) { showError("Could not save task: " + (res.error.message || res.error)); return; }
      if (res.data && res.data[0]) {
        var row = res.data[0];
        // priority/emoji have no DB column — keep them local, keyed by row id
        saveLocal(row.id, { priority: priority, emoji: emoji });
        renderTodo({
          id: row.id, date: row.date, created_at: row.created_at,
          text: row.task, priority: priority, emoji: emoji, done: row.is_complete
        });
        updateFoot();
        clearStatus();
      }
    } catch (err) {
      showError("Could not save task: " + (err.message || err));
    }
  }

  // Read all todos ordered by time (created_at ascending)
  async function loadTodos() {
    if (!sb) { showError("Database not connected."); return; }
    emptyState.textContent = "Loading tasks…";
    emptyState.hidden = false;
    try {
      var res = await sb.from("todos").select("*").order("created_at", { ascending: true });
      if (res.error) {
        showError("Could not load tasks: " + (res.error.message || res.error));
        emptyState.textContent = "No tasks yet. Add your first one above. 🌱";
        return;
      }
      list.innerHTML = "";
      (res.data || []).forEach(function (row) {
        var local = getLocal(row.id);
        renderTodo({
          id: row.id, date: row.date, created_at: row.created_at,
          text: row.task || "", priority: local.priority || "",
          emoji: local.emoji || "", done: !!row.is_complete
        });
      });
      if (!res.data || res.data.length === 0) {
        emptyState.textContent = "No tasks yet. Add your first one above. 🌱";
      }
      updateFoot();
      clearStatus();
    } catch (err) {
      showError("Could not load tasks: " + (err.message || err));
      emptyState.textContent = "No tasks yet. Add your first one above. 🌱";
    }
  }

  // Delete a row from the database, then remove the DOM node
  async function deleteTodo(li) {
    var id = li.dataset.id;
    li.classList.add("removing");
    if (id && sb) {
      try {
        var res = await sb.from("todos").delete().eq("id", id);
        if (res.error) {
          showError("Could not delete task: " + (res.error.message || res.error));
          li.classList.remove("removing");
          return;
        }
      } catch (err) {
        showError("Could not delete task: " + (err.message || err));
        li.classList.remove("removing");
        return;
      }
    }
    if (id) removeLocal(id);
    li.remove();
    updateFoot();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = taskInput.value.trim();
    var iso = dateInput.value;
    if (!text) { taskInput.focus(); return; }
    if (!iso) {
      var d = new Date();
      iso = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }
    addItem(text, iso, selectedPriority, selectedEmoji);
    taskInput.value = "";
    resetPickers();
    taskInput.focus();
  });

  // ===== Inline editing of task text =====
  function startEditing(textEl) {
    if (textEl.getAttribute("contenteditable") === "true") return;
    textEl.dataset.original = textEl.textContent;
    textEl.setAttribute("contenteditable", "true");
    textEl.focus();
    // Select all text so typing replaces it
    var range = document.createRange();
    range.selectNodeContents(textEl);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function endEditing(textEl, cancel) {
    if (textEl.getAttribute("contenteditable") !== "true") return;
    var original = textEl.dataset.original || "";
    if (cancel) {
      textEl.textContent = original;
    } else {
      // Strip any HTML/formatting that may have been pasted in
      var next = textEl.textContent.replace(/\s+/g, " ").trim();
      if (!next) next = original; // don't allow empty
      textEl.textContent = next;
      // Sync edited text to Supabase's task column
      var li = textEl.closest(".todo-item");
      if (li && li.dataset.id && sb) {
        sb.from("todos").update({ task: next })
          .eq("id", li.dataset.id)
          .then(function (res) {
            if (res.error) showError("Could not save edit: " + (res.error.message || res.error));
          });
      }
    }
    textEl.removeAttribute("contenteditable");
    delete textEl.dataset.original;
  }

  // Event delegation for checkbox + delete + text edit
  list.addEventListener("click", function (e) {
    var el = e.target;
    if (el.classList.contains("todo-delete")) {
      var li = el.closest(".todo-item");
      if (!li) return;
      deleteTodo(li);
      return;
    }

    // Start inline editing when the task text is clicked
    var textEl = e.target.closest ? e.target.closest(".todo-text") : null;
    if (textEl && textEl.getAttribute("contenteditable") !== "true") {
      startEditing(textEl);
    }
  });

  list.addEventListener("keydown", function (e) {
    var target = e.target;
    if (!target.classList || !target.classList.contains("todo-text")) return;
    if (target.getAttribute("contenteditable") !== "true") return;
    if (e.key === "Enter") {
      e.preventDefault(); // don't insert a newline
      endEditing(target, false);
      target.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      endEditing(target, true); // revert
      target.blur();
    }
  });

  // Save on blur (focusout bubbles, blur does not)
  list.addEventListener("focusout", function (e) {
    var target = e.target;
    if (!target.classList || !target.classList.contains("todo-text")) return;
    if (target.getAttribute("contenteditable") === "true") {
      endEditing(target, false);
    }
  });

  list.addEventListener("change", function (e) {
    if (e.target.classList.contains("todo-check")) {
      var li = e.target.closest(".todo-item");
      if (li) {
        li.classList.toggle("done", e.target.checked);
        // Sync done state to Supabase's is_complete column
        if (li.dataset.id && sb) {
          sb.from("todos").update({ is_complete: e.target.checked })
            .eq("id", li.dataset.id)
            .then(function (res) {
              if (res.error) showError("Could not update task: " + (res.error.message || res.error));
            });
        }
        updateFoot();
      }
    }
  });

  clearBtn.addEventListener("click", async function () {
    var items = list.querySelectorAll(".todo-item");
    if (items.length === 0) return;
    if (!confirm("Clear all tasks? This can't be undone.")) return;
    var ids = [];
    items.forEach(function (li) {
      if (li.dataset.id) ids.push(li.dataset.id);
    });
    if (ids.length > 0 && sb) {
      try {
        var res = await sb.from("todos").delete().in("id", ids);
        if (res.error) {
          showError("Could not clear all: " + (res.error.message || res.error));
          return;
        }
      } catch (err) {
        showError("Could not clear all: " + (err.message || err));
        return;
      }
    }
    clearLocal();
    list.innerHTML = "";
    updateFoot();
  });

  // On page load, fetch all todos from Supabase ordered by time
  loadTodos();
})();
