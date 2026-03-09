console.log('Local Code Reviewer active on:', window.location.href);

const findCodeBlocks = () => {
  const selectors = [
    '.react-code-text',
    '.blob-code-inner',
    '.markdown-body pre',
    '.highlight pre',
    'pre code'
  ];

  const blocks = document.querySelectorAll(selectors.join(', '));
  injectToFileHeader();

  blocks.forEach((block) => {
    const htmlBlock = block as HTMLElement;
    if (htmlBlock.dataset.reviewerProcessed) return;
    
    if (htmlBlock.classList.contains('react-code-text') || htmlBlock.classList.contains('blob-code-inner')) {
      if (!htmlBlock.closest('pre') && !htmlBlock.closest('.markdown-body')) return;
    }

    const button = createReviewButton();
    button.onclick = (e) => {
      e.stopPropagation();
      sendReviewMessage(htmlBlock.innerText, detectLanguage(htmlBlock));
    };
    
    const parent = htmlBlock.parentElement;
    if (parent) {
      if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
      parent.appendChild(button);
    }
    htmlBlock.dataset.reviewerProcessed = 'true';
  });
};

const injectToFileHeader = () => {
  const actionBars = document.querySelectorAll('.react-blob-header-edit-and-raw-actions, [data-testid="file-action-bar"]');
  actionBars.forEach(bar => {
    if ((bar as HTMLElement).dataset.reviewerProcessed) return;
    
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; margin-right: 8px;';

    const button = document.createElement('button');
    button.innerHTML = '🔍 Review File';
    button.className = 'lcr-header-btn';
    button.style.cssText = `
      background: #0ea5e9; color: white; border: none; border-radius: 6px;
      padding: 3px 12px; font-size: 12px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; gap: 4px; transition: all 0.2s;
    `;
    
    button.onmouseover = () => button.style.backgroundColor = '#0284c7';
    button.onmouseout = () => button.style.backgroundColor = '#0ea5e9';
    button.onclick = () => {
      const lines = document.querySelectorAll('.react-code-text');
      if (lines.length > 0) {
        const fullCode = Array.from(lines).map(l => (l as HTMLElement).innerText).join('\n');
        sendReviewMessage(fullCode, detectLanguage(lines[0]));
      } else {
        const codeContainer = document.querySelector('.blob-wrapper, .blob-code-inner');
        if (codeContainer) sendReviewMessage((codeContainer as HTMLElement).innerText, detectLanguage(codeContainer));
      }
    };
    
    container.appendChild(button);
    bar.prepend(container);
    (bar as HTMLElement).dataset.reviewerProcessed = 'true';
  });
};

const createReviewButton = () => {
  const button = document.createElement('button');
  button.innerText = '🔍 Review';
  button.className = 'lcr-review-btn';
  button.style.cssText = `
    position: absolute; right: 10px; top: 5px; z-index: 100;
    background: #0ea5e9; color: white; border: none; border-radius: 4px;
    padding: 2px 8px; font-size: 10px; font-weight: bold; cursor: pointer;
    opacity: 0.6; transition: opacity 0.2s;
  `;
  button.onmouseover = () => button.style.opacity = '1';
  button.onmouseout = () => button.style.opacity = '0.6';
  return button;
};

const sendReviewMessage = (code: string, language: string) => {
  try {
    chrome.runtime.sendMessage({
      type: 'REVIEW_CODE',
      code: code,
      language: language
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('LCR: Extension context invalidated. Please refresh the page.');
      }
    });
  } catch (err) {
    console.warn('LCR: Failed to send message. This usually happens if the extension was reloaded. Please refresh.');
  }
};

const detectLanguage = (el: Element): string => {
  const text = el.className + ' ' + (el.parentElement?.className || '') + ' ' + window.location.pathname;
  if (text.toLowerCase().match(/\.(js|jsx|mjs|cjs)$/) || text.includes('javascript')) return 'javascript';
  if (text.toLowerCase().match(/\.(ts|tsx)$/) || text.includes('typescript')) return 'typescript';
  if (text.toLowerCase().match(/\.(py)$/) || text.includes('python')) return 'python';
  if (text.toLowerCase().match(/\.(json)$/) || text.includes('json')) return 'json';
  return 'javascript';
};

findCodeBlocks();
const observer = new MutationObserver(() => findCodeBlocks());
observer.observe(document.body, { childList: true, subtree: true });
