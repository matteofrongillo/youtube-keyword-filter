document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("blacklist-input");
  const saveBtn = document.getElementById("save-btn");
  const statusMessage = document.getElementById("status-message");

  // Load existing words
  chrome.storage.local.get({ blockedWords: "ASMR" }, (result) => {
    input.value = result.blockedWords;
  });

  // Save on button click
  saveBtn.addEventListener("click", () => {
    const words = input.value;
    chrome.storage.local.set({ blockedWords: words }, () => {
      // Show saved message
      statusMessage.textContent = "Saved!";
      statusMessage.classList.add("visible");
      
      setTimeout(() => {
        statusMessage.classList.remove("visible");
      }, 2000);
    });
  });
});
