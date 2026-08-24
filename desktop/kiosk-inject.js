(() => {
  if (window.__pizzaKioskInjected) return;
  window.__pizzaKioskInjected = true;

  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());

  const hotspot = document.createElement("div");
  hotspot.id = "pizza-kiosk-hotspot";
  hotspot.title = "连续点 5 次打开管理";

  const bar = document.createElement("div");
  bar.id = "pizza-kiosk-bar";
  bar.innerHTML = `
    <button class="ghost" type="button" data-act="home">方案选择</button>
    <button type="button" data-act="quit">退出</button>
  `;

  document.documentElement.appendChild(hotspot);
  document.documentElement.appendChild(bar);

  let taps = [];
  hotspot.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    taps = taps.filter((t) => now - t < 2000);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      bar.classList.add("show");
      clearTimeout(bar._hide);
      bar._hide = setTimeout(() => bar.classList.remove("show"), 8000);
    }
  });

  bar.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !window.pizzaApp) return;
    if (btn.dataset.act === "home") window.pizzaApp.goHome();
    if (btn.dataset.act === "quit") window.pizzaApp.quit();
  });

  if (location.hash === "#draw" && typeof openDrawMode === "function") {
    setTimeout(() => openDrawMode(), 400);
  }
})();
