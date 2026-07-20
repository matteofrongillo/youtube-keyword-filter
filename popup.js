document.addEventListener("DOMContentLoaded", () => {
  const wordInput = document.getElementById("word-input");
  const typeSelect = document.getElementById("type-select");
  const addBtn = document.getElementById("add-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const editId = document.getElementById("edit-id");
  const ruleList = document.getElementById("rule-list");
  const statusMessage = document.getElementById("status-message");

  let rules = [];

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function renderList() {
    ruleList.innerHTML = "";
    rules.forEach((rule) => {
      const li = document.createElement("li");
      li.className = "rule-item";

      const infoDiv = document.createElement("div");
      infoDiv.className = "rule-info";
      
      const wordSpan = document.createElement("span");
      wordSpan.className = "rule-word";
      wordSpan.textContent = rule.word;
      
      const typeSpan = document.createElement("span");
      typeSpan.className = "rule-type";
      typeSpan.textContent = getFriendlyTypeName(rule.type);

      infoDiv.appendChild(wordSpan);
      infoDiv.appendChild(typeSpan);

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "rule-actions";
      
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.textContent = "Edit";
      editBtn.onclick = () => startEdit(rule);
      
      const delBtn = document.createElement("button");
      delBtn.className = "delete-btn";
      delBtn.textContent = "Del";
      delBtn.onclick = () => deleteRule(rule.id);

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(delBtn);

      li.appendChild(infoDiv);
      li.appendChild(actionsDiv);

      ruleList.appendChild(li);
    });
  }

  function getFriendlyTypeName(type) {
    const types = {
      "contains": "Contains",
      "exact": "Exact Word",
      "starts": "Starts With",
      "ends": "Ends With",
      "regex": "Regex"
    };
    return types[type] || type;
  }

  function showMessage(msg, color = "#2ba640") {
    statusMessage.textContent = msg;
    statusMessage.style.color = color;
    setTimeout(() => {
      statusMessage.textContent = "";
    }, 3000);
  }

  function saveRules() {
    chrome.storage.local.set({ filterRules: rules }, () => {
      renderList();
    });
  }

  function startEdit(rule) {
    editId.value = rule.id;
    wordInput.value = rule.word;
    typeSelect.value = rule.type;
    addBtn.textContent = "Update";
    cancelBtn.classList.remove("hidden");
  }

  function cancelEdit() {
    editId.value = "";
    wordInput.value = "";
    typeSelect.value = "contains";
    addBtn.textContent = "Add";
    cancelBtn.classList.add("hidden");
  }

  function deleteRule(id) {
    rules = rules.filter(r => r.id !== id);
    saveRules();
    showMessage("Rule deleted");
    if (editId.value === id) {
      cancelEdit();
    }
  }

  // Load existing rules or migrate
  chrome.storage.local.get(["filterRules", "blockedWords"], (result) => {
    if (result.filterRules) {
      rules = result.filterRules;
    } else if (result.blockedWords) {
      // Migrate old blockedWords
      const words = result.blockedWords.split(',').map(w => w.trim()).filter(w => w.length > 0);
      rules = words.map(w => ({
        id: generateId(),
        word: w,
        type: "exact"
      }));
      // Save migrated rules and clear legacy
      chrome.storage.local.set({ filterRules: rules, blockedWords: "" });
    }
    renderList();
  });

  addBtn.addEventListener("click", () => {
    const word = wordInput.value.trim();
    const type = typeSelect.value;
    const id = editId.value;

    if (!word) {
      showMessage("Please enter a word", "#cc0000");
      return;
    }

    if (id) {
      // Edit existing
      const index = rules.findIndex(r => r.id === id);
      if (index !== -1) {
        rules[index] = { id, word, type };
        showMessage("Rule updated");
      }
    } else {
      // Add new
      rules.push({ id: generateId(), word, type });
      showMessage("Rule added");
    }

    saveRules();
    cancelEdit();
  });

  cancelBtn.addEventListener("click", cancelEdit);
});
