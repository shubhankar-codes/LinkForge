const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function page(title, content, head = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · LinkForge</title><link rel="stylesheet" href="/style.css">${head}</head><body class="public-page"><main class="gate"><a href="/" class="brand">↗ LinkForge</a>${content}</main></body></html>`;
}
module.exports = { escape, page };
