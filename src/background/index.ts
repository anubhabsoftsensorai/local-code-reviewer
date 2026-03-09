// Background service worker startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Local Code Reviewer Extension Installed');
  
  // Set the behavior to open panel on action click if API exists
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('SidePanel config error:', error));
  }
});

// Handle messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'REVIEW_CODE' && sender.tab?.id) {
    console.log('Received REVIEW_CODE request for tab:', sender.tab.id);
    
    // 1. MUST open the side panel synchronously here to preserve user gesture!
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ 
        tabId: sender.tab.id,
        windowId: sender.tab.windowId
      } as any).catch((error) => {
        console.error('Error opening side panel:', error);
      });
    }

    // 2. Perform the storage update in parallel
    chrome.storage.local.set({ 
      pendingReview: {
        code: message.code,
        language: message.language,
        timestamp: Date.now()
      } 
    }).catch((error) => {
      console.error('Storage failed:', error);
    });
    
    return true;
  }
});
