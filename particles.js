const canvas = document.getElementById("particles-canvas");
const ctx = canvas.getContext("2d");

let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

document.addEventListener("mousemove", (e) => {
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: e.clientX,
      y: e.clientY,
      size: Math.random() * 18 + 12,
      alpha: 1,
      char: Math.random() < 0.5 ? "●" : "|",
      dx: (Math.random() - 0.5) * 2,
      dy: (Math.random() - 0.5) * 2
    });
  }
});

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((p, index) => {
    ctx.globalAlpha = p.alpha;
    ctx.font = `${p.size}px Segoe UI`;
    ctx.fillStyle = "#FFD700";
    ctx.fillText(p.char, p.x, p.y);

    p.x += p.dx;
    p.y += p.dy;
    p.alpha -= 0.02;

    if (p.alpha <= 0) {
      particles.splice(index, 1);
    }
  });

  requestAnimationFrame(animate);
}

animate();