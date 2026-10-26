// Mobile menu
const btn = document.querySelector(".menu-btn"), nav = document.querySelector("nav.main");
btn?.addEventListener("click", () => { const open = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", open); });
// Booking form: validate, then show a confirmation with a reference number
const form = document.getElementById("booking");
if (form) {
  const date = form.elements.date;
  date.min = new Date(Date.now() + 864e5).toISOString().slice(0, 10); // from tomorrow
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = (name, msg) => { form.querySelector(`[data-error=${name}]`).textContent = msg; return !msg; };
    const d = new Date(date.value + "T12:00"), day = d.getDay();
    const ok = [
      err("name", form.elements.name.value.trim().length < 2 ? "Please enter your full name." : ""),
      err("email", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.elements.email.value) ? "" : "Please enter a valid email address."),
      err("phone", /^[+\d][\d\s()-]{6,}$/.test(form.elements.phone.value) ? "" : "Please enter a valid phone number."),
      err("service", form.elements.service.value ? "" : "Please choose a treatment."),
      err("date", !date.value ? "Please choose a date." : day === 0 ? "We're closed on Sundays." : ""),
    ].every(Boolean);
    if (!ok) return;
    const ref = "GL-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    form.hidden = true;
    const done = document.getElementById("confirmation");
    done.querySelector("[data-ref]").textContent = ref;
    done.querySelector("[data-when]").textContent = `${d.toDateString()} at ${form.elements.time.value}`;
    done.hidden = false;
  });
}
