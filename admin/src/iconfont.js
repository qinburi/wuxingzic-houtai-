// Compatible with iconfont.cn Symbol projects. Set VITE_ICONFONT_SYMBOL_URL to
// replace the bundled fallback symbols with the company's iconfont project.
const iconfontSymbolUrl = String(import.meta.env.VITE_ICONFONT_SYMBOL_URL || "").trim();

const symbols = {
  assets: '<path d="M4 5.5 12 2l8 3.5v12L12 22l-8-4.5v-12Zm2 3v7.7l5 2.8v-7.7L6 8.5Zm7 10.5 5-2.8V8.5l-5 2.8V19ZM7.2 6.8 12 9.5l4.8-2.7L12 4.7 7.2 6.8Z"/>',
  publish: '<path d="M12 3 4 7v5c0 4.6 3.2 7.6 8 9.4 4.8-1.8 8-4.8 8-9.4V7l-8-4Zm0 2.2L18 8v4c0 3.3-2.1 5.5-6 7.1-3.9-1.6-6-3.8-6-7.1V8l6-2.8Zm-1 3.3h2v5.1l2.2-2.2 1.4 1.4-4.6 4.6-4.6-4.6 1.4-1.4 2.2 2.2V8.5Z"/>',
  review: '<path d="M7 3h10v3h3v15H4V6h3V3Zm2 3h6V5H9v1ZM6 8v11h12V8H6Zm3 3h6v2H9v-2Zm0 4h4v2H9v-2Z"/>',
  public: '<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm5.8 8h-3.1a14 14 0 0 0-1.1-5.5A7 7 0 0 1 17.8 11ZM12 5c.8 1.1 1.5 3.1 1.7 6h-3.4c.2-2.9.9-4.9 1.7-6ZM6.2 13h3.1a14 14 0 0 0 1.1 5.5A7 7 0 0 1 6.2 13Zm0-2a7 7 0 0 1 4.2-5.5A14 14 0 0 0 9.3 11H6.2Zm5.8 8c-.8-1.1-1.5-3.1-1.7-6h3.4c-.2 2.9-.9 4.9-1.7 6Zm1.6-.5a14 14 0 0 0 1.1-5.5h3.1a7 7 0 0 1-4.2 5.5Z"/>',
  ip: '<path d="M6 3h9l4 4v14H6V3Zm2 2v14h9V8h-3V5H8Zm2 6h5v2h-5v-2Zm0 4h5v2h-5v-2Z"/>',
  risk: '<path d="M12 3 22 21H2L12 3Zm0 4L5.5 19h13L12 7Zm-1 4h2v4h-2v-4Zm0 5h2v2h-2v-2Z"/>',
  trend: '<path d="M5 19h15v2H3V4h2v15Zm2-3 3.8-4 3 2.3L19 8.8l1.4 1.4-6.5 6.9-2.9-2.3-2.6 2.6L7 16Z"/>',
  distribution: '<path d="M11 3v8H3a9 9 0 1 0 8-8Zm2 0v7h7a8 8 0 0 0-7-7Zm0 9h6.7A7 7 0 1 1 9 5.3V13h4v-1Z"/>',
  department: '<path d="M4 20V8l5-3v5l5-3v5l6-4v12H4Zm2-2h3v-5H6v5Zm5 0h3v-5h-3v5Zm5 0h2v-6l-2 1.4V18Z"/>',
  todo: '<path d="M7 4h10v3h3v14H4V7h3V4Zm2 3h6V6H9v1ZM6 9v10h12V9H6Zm2 3h2v2H8v-2Zm4 .2h4v1.6h-4v-1.6ZM8 16h2v2H8v-2Zm4 .2h4v1.6h-4v-1.6Z"/>',
  system: '<path d="M5 4h14v6H5V4Zm2 2v2h10V6H7Zm-2 6h14v8H5v-8Zm2 2v4h10v-4H7Zm1-7h2v1H8V7Zm0 8h2v2H8v-2Z"/>',
  quick: '<path d="M4 4h7v7H4V4Zm2 2v3h3V6H6Zm7-2h7v7h-7V4Zm2 2v3h3V6h-3ZM4 13h7v7H4v-7Zm2 2v3h3v-3H6Zm7-2h7v7h-7v-7Zm2 2v3h3v-3h-3Z"/>'
};

export function loadDashboardIconfont() {
  if (!document.getElementById("hannao-dashboard-iconfont")) {
    const sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    sprite.id = "hannao-dashboard-iconfont";
    sprite.setAttribute("aria-hidden", "true");
    sprite.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    sprite.innerHTML = Object.entries(symbols).map(([id, paths]) => `<symbol id="icon-${id}" viewBox="0 0 24 24">${paths}</symbol>`).join("");
    document.body.prepend(sprite);
  }
  if (iconfontSymbolUrl && !document.querySelector("script[data-admin-iconfont]")) {
    const script = document.createElement("script");
    script.src = iconfontSymbolUrl;
    script.dataset.adminIconfont = "true";
    document.head.appendChild(script);
  }
}
