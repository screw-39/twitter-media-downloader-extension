const DEFAULT_SETTINGS = {
  downloadSubfolder: "{author}",
  fileNamePattern: "{author}_{tweetId}_{index}",
  askWhereToSave: false
};

const form = document.getElementById("settings-form");
const statusNode = document.getElementById("status");

initialize();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const settings = {
    downloadSubfolder: document.getElementById("downloadSubfolder").value.trim() || DEFAULT_SETTINGS.downloadSubfolder,
    fileNamePattern: document.getElementById("fileNamePattern").value.trim() || DEFAULT_SETTINGS.fileNamePattern,
    askWhereToSave: document.getElementById("askWhereToSave").checked
  };

  await chrome.storage.sync.set(settings);
  statusNode.textContent = "已儲存";
  window.setTimeout(() => {
    statusNode.textContent = "";
  }, 1800);
});

async function initialize() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  document.getElementById("downloadSubfolder").value = settings.downloadSubfolder;
  document.getElementById("fileNamePattern").value = settings.fileNamePattern;
  document.getElementById("askWhereToSave").checked = settings.askWhereToSave;
}
