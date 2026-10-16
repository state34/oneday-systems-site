(function () {
  var root = document.getElementById("brands-root");
  if (!root) return;

  var pinned = null;
  var hover = null;
  var touchLock = 0;
  var suppressFocus = false;

  fetch("/src/data/brands-we-love.json")
    .then(function (res) {
      if (!res.ok) throw new Error("load");
      return res.json();
    })
    .then(render)
    .catch(function () {
      root.textContent = "The brand list did not load. Refresh the page.";
    });

  function render(data) {
    var intro = document.getElementById("brands-intro");
    var note = document.getElementById("brands-note");
    if (intro && data.intro) intro.textContent = data.intro;
    if (note && data.footerNote) note.textContent = data.footerNote;

    var filters = document.getElementById("brand-filters");
    filters.innerHTML = "";
    filters.appendChild(chip("All", "", true));
    data.sections.forEach(function (section) {
      filters.appendChild(chip(section.segment, section.segment, false));
    });

    root.innerHTML = "";
    data.sections.forEach(function (section) {
      var block = document.createElement("section");
      block.className = "brand-segment";
      block.setAttribute("data-segment", section.segment);
      var heading = document.createElement("h3");
      heading.textContent = section.segment;
      block.appendChild(heading);
      var grid = document.createElement("div");
      grid.className = "brands-grid";
      section.brands.forEach(function (brand) {
        grid.appendChild(cell(brand));
      });
      block.appendChild(grid);
      root.appendChild(block);
    });

    filters.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button || !filters.contains(button)) return;
      var segment = button.getAttribute("data-segment");
      filters.querySelectorAll("button").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });
      root.querySelectorAll(".brand-segment").forEach(function (block) {
        var show = !segment || block.getAttribute("data-segment") === segment;
        block.hidden = !show;
      });
      closeAll();
    });
  }

  function chip(label, segment, pressed) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "brand-chip";
    button.textContent = label;
    button.setAttribute("data-segment", segment);
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    return button;
  }

  function cell(brand) {
    var wrap = document.createElement("div");
    wrap.className = "brand-cell";
    var popId = "blurb-" + brand.id;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "brand-tile";
    button.setAttribute("data-id", brand.id);
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", popId);
    button.setAttribute("aria-describedby", popId);

    if (brand.logo && brand.logoStatus === "ok") {
      var img = document.createElement("img");
      img.src = brand.logo;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      button.classList.add("has-logo");
      button.appendChild(img);
    }

    var caption = document.createElement("span");
    caption.className = "brand-caption";
    caption.textContent = brand.name;
    button.appendChild(caption);

    var pop = document.createElement("div");
    pop.className = "brand-pop";
    pop.id = popId;
    pop.hidden = true;
    pop.setAttribute("role", "region");
    pop.setAttribute("aria-label", brand.name);
    var copy = document.createElement("p");
    copy.textContent = brand.blurb;
    var actions = document.createElement("div");
    actions.className = "brand-pop-actions";
    var visit = document.createElement("a");
    visit.href = brand.url;
    visit.target = "_blank";
    visit.rel = "noopener noreferrer";
    visit.textContent = "Visit site";
    var visitHint = document.createElement("span");
    visitHint.className = "sr-only";
    visitHint.textContent = " (opens in new tab)";
    visit.appendChild(visitHint);
    var close = document.createElement("button");
    close.type = "button";
    close.className = "brand-close";
    close.textContent = "Close";
    close.addEventListener("click", function () {
      setOpen(button, false);
      button.focus();
    });
    actions.appendChild(visit);
    actions.appendChild(close);
    pop.appendChild(copy);
    pop.appendChild(actions);

    button.addEventListener("pointerenter", function (event) {
      if (event.pointerType !== "mouse" || Date.now() < touchLock) return;
      hover = brand.id;
      setOpen(button, true);
    });
    button.addEventListener("pointerleave", function (event) {
      if (event.pointerType !== "mouse") return;
      if (hover === brand.id) hover = null;
      if (pinned === brand.id || document.activeElement === button) return;
      setOpen(button, false);
    });
    button.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse") touchLock = Date.now() + 800;
    });
    button.addEventListener("focus", function () {
      if (suppressFocus) return;
      setOpen(button, true);
    });
    button.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (pinned === brand.id || hover === brand.id) return;
        var live = document.getElementById(button.getAttribute("aria-controls"));
        if (live && live.contains(document.activeElement)) return;
        setOpen(button, false);
      }, 0);
    });
    button.addEventListener("click", function () {
      if (pinned === brand.id) {
        pinned = null;
        setOpen(button, false);
      } else {
        pinned = brand.id;
        setOpen(button, true);
      }
    });

    wrap.appendChild(button);
    wrap.appendChild(pop);
    return wrap;
  }

  function setOpen(button, open) {
    var pop = document.getElementById(button.getAttribute("aria-controls"));
    if (!pop) return;
    if (open) {
      root.querySelectorAll(".brand-tile[aria-expanded='true']").forEach(function (other) {
        if (other !== button) setOpen(other, false);
      });
    }
    button.setAttribute("aria-expanded", open ? "true" : "false");
    pop.hidden = !open;
    button.parentElement.classList.toggle("is-open", open);
    if (open) place(button, pop);
    if (!open && pinned === button.getAttribute("data-id") && hover !== button.getAttribute("data-id")) {
      pinned = null;
    }
  }

  function place(button, pop) {
    var rect = button.getBoundingClientRect();
    pop.classList.toggle("is-end", rect.left > window.innerWidth * 0.55);
    pop.classList.toggle("is-above", rect.bottom + 190 > window.innerHeight && rect.top > 210);
  }

  function closeAll() {
    pinned = null;
    hover = null;
    root.querySelectorAll(".brand-tile").forEach(function (button) {
      setOpen(button, false);
    });
  }

  function visibleTiles() {
    return Array.prototype.filter.call(root.querySelectorAll(".brand-tile"), function (button) {
      return button.offsetParent !== null;
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!root) return;
    if (event.key === "Escape") {
      var open = root.querySelector(".brand-tile[aria-expanded='true']");
      if (!open) return;
      pinned = null;
      hover = null;
      suppressFocus = true;
      setOpen(open, false);
      open.focus();
      window.setTimeout(function () { suppressFocus = false; }, 0);
      return;
    }
    var keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"];
    if (keys.indexOf(event.key) === -1) return;
    var current = document.activeElement;
    if (!current || !current.classList || !current.classList.contains("brand-tile")) return;
    var tiles = visibleTiles();
    var index = tiles.indexOf(current);
    if (index === -1) return;
    var columns = getColumns();
    var next = index;
    if (event.key === "ArrowRight") next = Math.min(tiles.length - 1, index + 1);
    if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
    if (event.key === "ArrowDown") next = Math.min(tiles.length - 1, index + columns);
    if (event.key === "ArrowUp") next = Math.max(0, index - columns);
    if (next !== index) {
      event.preventDefault();
      tiles[next].focus();
    }
  });

  document.addEventListener("pointerdown", function (event) {
    if (!pinned && !root.querySelector(".brand-tile[aria-expanded='true']")) return;
    if (event.target.closest(".brand-cell")) return;
    closeAll();
  });

  window.addEventListener("resize", function () {
    var open = root.querySelector(".brand-tile[aria-expanded='true']");
    if (!open) return;
    place(open, document.getElementById(open.getAttribute("aria-controls")));
  });

  function getColumns() {
    var grid = root.querySelector(".brands-grid");
    if (!grid) return 2;
    var style = window.getComputedStyle(grid);
    return Math.max(1, style.gridTemplateColumns.split(" ").length);
  }
})();
