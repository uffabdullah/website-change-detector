const SITE = "https://website-change-detector-mu.vercel.app";

const urlNode = document.querySelector("#url");
const button = document.querySelector("#watch");

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0]?.url || "";
  const usable = /^https?:\/\//i.test(url);
  urlNode.textContent = usable ? url : "Only public http and https pages can be watched.";
  button.disabled = !usable;
  button.addEventListener("click", () => {
    if (!usable) return;
    chrome.tabs.create({ url: `${SITE}/console/new?url=${encodeURIComponent(url)}` });
  });
});
