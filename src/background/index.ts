chrome.runtime.onInstalled.addListener(() => {
  console.log('Local Code Reviewer Extension Installed');
});

// Handle messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_REQUEST') {
    // We could run analysis here or in the side panel
    // For now, let's just forward messages if needed
  }
});
