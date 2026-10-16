(function () {
  var form = document.getElementById("contact-form");
  var status = document.getElementById("form-status");
  var started = document.getElementById("started");
  var slot = document.getElementById("turnstile-slot");
  var widget = document.querySelector(".calendly-inline-widget");
  var fallback = document.getElementById("calendly-fallback");
  if (started) started.value = String(Date.now());

  var params = new URLSearchParams(window.location.search);
  if (params.get("sent") === "1") showSuccess();
  if (params.get("error") === "1" && status) {
    status.textContent = errorCopy();
  }

  if (form) {
    observe(form, loadTurnstile);
    form.addEventListener("submit", onSubmit);
  }
  if (widget) observe(widget, loadCalendly);

  function observe(el, fn) {
    if (!("IntersectionObserver" in window)) {
      fn();
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          io.disconnect();
          fn();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
  }

  function loadTurnstile() {
    if (document.querySelector("script[data-turnstile]")) return;
    fetch("/api/form-config", { headers: { accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (data) {
        if (!data.turnstileSiteKey || !slot) return;
        var script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.dataset.turnstile = "1";
        script.onload = function () {
          if (!window.turnstile) return;
          window.turnstile.render(slot, { sitekey: data.turnstileSiteKey });
        };
        document.body.appendChild(script);
      })
      .catch(function () {});
  }

  function loadCalendly() {
    if (document.querySelector("script[data-calendly]")) return;
    var script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.dataset.calendly = "1";
    document.body.appendChild(script);
    var began = Date.now();
    var timer = window.setInterval(function () {
      var frame = widget && widget.querySelector("iframe");
      if (frame) {
        if (fallback) fallback.hidden = true;
        window.clearInterval(timer);
      } else if (Date.now() - began > 8000) {
        window.clearInterval(timer);
      }
    }, 250);
  }

  function onSubmit(event) {
    event.preventDefault();
    var button = form.querySelector("button[type=submit]");
    var tokenInput = form.querySelector("[name=cf-turnstile-response]");
    var payload = {
      name: value("name"),
      email: value("email"),
      company: value("company"),
      phone: value("phone"),
      message: value("message"),
      website: value("website"),
      started: started ? started.value : "",
      turnstile: tokenInput ? tokenInput.value : "",
    };
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }
    if (status) status.textContent = "";
    fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { res: res, data: data }; }).catch(function () {
          return { res: res, data: { ok: false, error: "send" } };
        });
      })
      .then(function (result) {
        if (result.res.ok && result.data && result.data.ok) {
          showSuccess();
          return;
        }
        if (status) status.textContent = result.data && result.data.error === "rate" ? rateCopy() : errorCopy();
        if (button) {
          button.disabled = false;
          button.textContent = "Send to Stan";
        }
      })
      .catch(function () {
        if (status) status.textContent = errorCopy();
        if (button) {
          button.disabled = false;
          button.textContent = "Send to Stan";
        }
      });
  }

  function value(name) {
    var el = form.elements[name];
    return el ? el.value : "";
  }

  function showSuccess() {
    if (form) form.hidden = true;
    if (status) status.textContent = "Thanks, got it. Stan will be in touch soon.";
  }

  function errorCopy() {
    return "Shoot, that didn't go through. Give it another try, or grab a time on the calendar instead.";
  }

  function rateCopy() {
    return "Looks like we've heard from you a few times already. We'll be in touch, or grab a time on the calendar.";
  }
})();
