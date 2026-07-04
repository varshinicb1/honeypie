const revealTargets = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => observer.observe(el));

// Subtle mouse-driven tilt on the hero phone mockup.
const phone = document.getElementById("phoneFrame");
if (phone && matchMedia("(pointer: fine)").matches) {
  const heroVisual = phone.closest(".hero-visual");
  heroVisual.addEventListener("mousemove", (event) => {
    const bounds = heroVisual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    phone.style.transform = `rotate(${4 + x * 10}deg) rotateX(${y * -8}deg)`;
  });
  heroVisual.addEventListener("mouseleave", () => {
    phone.style.transform = "";
  });
}
