(function () {
  var root = document.getElementById("brands-root");
  if (!root) return;

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
    clear(filters);
    filters.appendChild(chip("All", "", true));
    data.sections.forEach(function (section) {
      filters.appendChild(chip(section.segment, section.segment, false));
    });

    clear(root);
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
        if (!brand.url || brand.url.indexOf("https://") !== 0) {
          console.warn("Skipped brand with a non-https URL", brand.id || brand.name);
          return;
        }
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
      closeInfo();
    });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
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

    var link = document.createElement("a");
    link.className = "brand-tile";
    link.href = brand.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("data-id", brand.id);
    if (brand.dark) link.classList.add("is-dark");

    if (brand.logo && brand.logoStatus === "ok") {
      var img = document.createElement("img");
      img.src = brand.logo;
      img.alt = brand.name;
      img.loading = "lazy";
      img.decoding = "async";
      if (brand.logoWidth) img.width = brand.logoWidth;
      if (brand.logoHeight) img.height = brand.logoHeight;
      link.appendChild(img);
    }

    var caption = document.createElement("span");
    caption.className = "brand-caption";
    caption.textContent = brand.name;
    link.appendChild(caption);

    var hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = " (opens in new tab)";
    link.appendChild(hint);

    var info = document.createElement("button");
    info.type = "button";
    info.className = "brand-info";
    info.setAttribute("aria-expanded", "false");
    info.setAttribute("aria-controls", popId);
    var mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "i";
    var infoLabel = document.createElement("span");
    infoLabel.className = "sr-only";
    infoLabel.textContent = "About " + brand.name;
    info.appendChild(mark);
    info.appendChild(infoLabel);
    info.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var open = wrap.classList.contains("is-open");
      closeInfo();
      if (!open) {
        wrap.classList.add("is-open");
        info.setAttribute("aria-expanded", "true");
        place(link, pop);
      }
    });

    var pop = document.createElement("div");
    pop.className = "brand-pop";
    pop.id = popId;
    pop.setAttribute("role", "region");
    pop.setAttribute("aria-label", brand.name);
    var copy = document.createElement("p");
    copy.textContent = brand.blurb;
    pop.appendChild(copy);

    link.addEventListener("focus", function () { place(link, pop); });
    wrap.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") place(link, pop);
    });

    wrap.appendChild(link);
    wrap.appendChild(info);
    wrap.appendChild(pop);
    return wrap;
  }

  function place(link, pop) {
    var rect = link.getBoundingClientRect();
    pop.classList.toggle("is-end", rect.left > window.innerWidth * 0.55);
    pop.classList.toggle("is-above", rect.bottom + 160 > window.innerHeight && rect.top > 180);
  }

  function closeInfo() {
    root.querySelectorAll(".brand-cell.is-open").forEach(function (cell) {
      cell.classList.remove("is-open");
      var button = cell.querySelector(".brand-info");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeInfo();
  });

  document.addEventListener("pointerdown", function (event) {
    if (event.target.closest(".brand-cell")) return;
    closeInfo();
  });
})();
