(function(){console.log("Local Code Reviewer active on:",window.location.href);const l=()=>{const t=[".react-code-text",".blob-code-inner",".markdown-body pre",".highlight pre","pre code"],o=document.querySelectorAll(t.join(", "));d(),o.forEach(n=>{const e=n;if(e.dataset.reviewerProcessed||(e.classList.contains("react-code-text")||e.classList.contains("blob-code-inner"))&&!e.closest("pre")&&!e.closest(".markdown-body"))return;const s=p();s.onclick=c=>{c.stopPropagation(),i(e.innerText,a(e))};const r=e.parentElement;r&&(getComputedStyle(r).position==="static"&&(r.style.position="relative"),r.appendChild(s)),e.dataset.reviewerProcessed="true"})},d=()=>{document.querySelectorAll('.react-blob-header-edit-and-raw-actions, [data-testid="file-action-bar"]').forEach(o=>{if(o.dataset.reviewerProcessed)return;const n=document.createElement("div");n.style.display="flex",n.style.alignItems="center",n.style.marginRight="8px";const e=document.createElement("button");e.innerHTML="🔍 Review File",e.className="lcr-header-btn",e.style.cssText=`
      background: #0ea5e9;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
    `,e.onmouseover=()=>e.style.backgroundColor="#0284c7",e.onmouseout=()=>e.style.backgroundColor="#0ea5e9",e.onclick=()=>{const s=document.querySelectorAll(".react-code-text");if(s.length>0){const r=Array.from(s).map(c=>c.innerText).join(`
`);i(r,a(s[0]))}else{const r=document.querySelector(".blob-wrapper, .blob-code-inner");r&&i(r.innerText,a(r))}},n.appendChild(e),o.prepend(n),o.dataset.reviewerProcessed="true"})},p=()=>{const t=document.createElement("button");return t.innerText="🔍 Review",t.className="lcr-review-btn",t.style.cssText=`
    position: absolute;
    right: 10px;
    top: 5px;
    z-index: 100;
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
  `,t.onmouseover=()=>t.style.opacity="1",t.onmouseout=()=>t.style.opacity="0.6",t},i=(t,o)=>{chrome.runtime.sendMessage({type:"REVIEW_CODE",code:t,language:o})},a=t=>{var n;const o=t.className+" "+(((n=t.parentElement)==null?void 0:n.className)||"")+" "+window.location.pathname;return o.toLowerCase().match(/\.(js|jsx|mjs|cjs)$/)||o.includes("javascript")?"javascript":o.toLowerCase().match(/\.(ts|tsx)$/)||o.includes("typescript")?"typescript":o.toLowerCase().match(/\.(py)$/)||o.includes("python")?"python":o.toLowerCase().match(/\.(json)$/)||o.includes("json")?"json":"javascript"};l();const u=new MutationObserver(()=>{l()});u.observe(document.body,{childList:!0,subtree:!0});
})()