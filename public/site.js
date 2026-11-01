(function () {
  var btn = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("site-nav");
  if (!btn || !nav) return;
  btn.addEventListener("click", function () {
    var open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", open ? "false" : "true");
    nav.classList.toggle("is-open", !open);
  });
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      btn.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
    });
  });
})();
