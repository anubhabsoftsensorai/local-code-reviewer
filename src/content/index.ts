console.log('Local Code Reviewer content script active');

// Function to find code blocks on the page
const findCodeBlocks = () => {
  // GitHub specific selectors
  const githubCode = document.querySelectorAll('.blob-code-inner, .highlight pre, pre code');
  
  githubCode.forEach((block) => {
    if ((block as HTMLElement).dataset.reviewerProcessed) return;
    
    // Add a small "Review" button overlay
    const button = document.createElement('button');
    button.innerText = '🔍 Review';
    button.className = 'lcr-review-btn';
    button.style.cssText = `
      position: absolute;
      right: 10px;
      top: 5px;
      z-index: 100;
      background: #38bdf8;
      color: black;
      border: none;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 10px;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity 0.2s;
    `;
    
    button.onmouseover = () => button.style.opacity = '1';
    button.onmouseout = () => button.style.opacity = '0.7';
    
    button.onclick = (e) => {
      e.stopPropagation();
      const code = (block as HTMLElement).innerText;
      
      // Open the side panel and send code
      chrome.runtime.sendMessage({
        type: 'REVIEW_CODE',
        code: code,
        language: detectLanguage(block)
      });
    };
    
    const parent = block.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(button);
    }
    
    (block as HTMLElement).dataset.reviewerProcessed = 'true';
  });
};

const detectLanguage = (el: Element): string => {
  // Try to detect language from class names or context
  const text = el.className + ' ' + (el.parentElement?.className || '');
  if (text.includes('javascript') || text.includes('js')) return 'javascript';
  if (text.includes('typescript') || text.includes('ts')) return 'typescript';
  if (text.includes('python') || text.includes('py')) return 'python';
  if (text.includes('json')) return 'json';
  return 'javascript'; // Default
};

// Initial run
findCodeBlocks();

// Watch for DOM changes (for SPA like GitHub)
const observer = new MutationObserver(() => {
  findCodeBlocks();
});
observer.observe(document.body, { childList: true, subtree: true });
