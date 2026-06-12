import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { App } from './scene/index.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

const STEP_RANGES = [
  [0.10, 0.24], [0.24, 0.37], [0.37, 0.50], [0.50, 0.62], [0.62, 0.73], [0.73, 0.84], [0.84, 1.0],
];

document.body.classList.add('is-locked');
window.scrollTo(0, 0);

/* ---------------------------------------------------- scene */
const app = new App(document.getElementById('webgl'));
const heroPos = app.camPos.clone();

/* ---------------------------------------------------- step panel */
const steps = [...document.querySelectorAll('.flow__step')];
let prevActive = 0;

function setStep(active) {
  for (const el of steps) {
    const n = +el.dataset.step;
    const body = el.querySelector('.flow__body');
    const isActive = n === active;
    el.classList.toggle('is-active', isActive);
    gsap.to(body, { height: isActive ? 'auto' : 0, duration: 0.5, ease: 'power3.inOut', overwrite: true });
    if (!isActive) {
      const fill = el.querySelector('.flow__track-fill');
      if (fill) fill.style.height = '0%';
    }
  }
  // animate the newly stepped-over step, and pulse the scene like a hover
  if (active && active !== prevActive) {
    const el = steps[active - 1];
    if (el) {
      gsap.fromTo(el.querySelector('.flow__number'), { scale: 0.55 }, { scale: 1, duration: 0.6, ease: 'back.out(2.6)' });
      gsap.fromTo(el.querySelector('.flow__title'), { x: -12, opacity: 0.3 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
    }
    app.stepPulse();
  }
  prevActive = active;
}

app.buildJourney(setStep);

/* steps are hoverable (cursor reacts) + clickable to jump to that stage */
steps.forEach((el) => {
  const header = el.querySelector('.flow__header');
  header.addEventListener('pointerenter', () => el.classList.add('is-hover'));
  header.addEventListener('pointerleave', () => el.classList.remove('is-hover'));
  header.addEventListener('click', () => {
    const n = +el.dataset.step;
    const top = document.querySelector('.top');
    const [a, b] = STEP_RANGES[n - 1];
    const mid = (a + b) / 2;
    const targetY = top.offsetTop + (top.offsetHeight - window.innerHeight) * mid;
    gsap.to(window, { scrollTo: targetY, duration: 1.0, ease: 'power2.inOut' });
  });
});

/* ---------------------------------------------------- hero exit on scroll */
gsap.timeline({
  scrollTrigger: { trigger: '.hero', start: 'top top', end: '80% top', scrub: true },
})
  .to('.hero__title .hl', {
    yPercent: -140,
    opacity: 0,
    rotateX: 28,
    stagger: 0.04,
    ease: 'power1.in',
    transformOrigin: '50% 0%',
  }, 0)
  .to('.hero__subtitle .hl', {
    yPercent: -120,
    opacity: 0,
    stagger: 0.05,
    ease: 'power1.in',
  }, 0.04)
  .to('.hero__scroll-btn', { opacity: 0, ease: 'power1.in' }, 0);

/* ---------------------------------------------------- faq */
for (const item of document.querySelectorAll('.faq-item')) {
  const header = item.querySelector('.faq-item__header');
  const content = item.querySelector('.faq-item__content');
  if (item.classList.contains('faq-item--open')) gsap.set(content, { height: 'auto' });
  header.addEventListener('click', () => {
    const open = item.classList.toggle('faq-item--open');
    header.setAttribute('aria-expanded', String(open));
    gsap.to(content, { height: open ? 'auto' : 0, duration: 0.55, ease: 'power3.inOut' });
  });
}

/* ---------------------------------------------------- section reveals */
gsap.utils.toArray('.feature-item').forEach((el, i) => {
  gsap.from(el, {
    y: 44,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
    delay: (i % 4) * 0.08,
    scrollTrigger: { trigger: el, start: 'top 88%' },
  });
});

gsap.from('.features__title', {
  y: 60,
  opacity: 0,
  duration: 1,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.features', start: 'top 78%' },
});

gsap.from('.standards__title .hl', {
  yPercent: 110,
  opacity: 0,
  stagger: 0.08,
  duration: 0.9,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.standards', start: 'top 72%' },
});

gsap.from('.cta-section__title .hl', {
  yPercent: 110,
  opacity: 0,
  stagger: 0.08,
  duration: 0.9,
  ease: 'power3.out',
  scrollTrigger: { trigger: '.cta-section', start: 'top 75%' },
});

/* ---------------------------------------------------- scroll hint loop */
function scrollHintLoop() {
  gsap.timeline({ repeat: -1, repeatDelay: 2.2 })
    .to('.hsbtn-in', { yPercent: -130, duration: 0.7, ease: 'power3.in' })
    .set('.hsbtn-in', { yPercent: 130 })
    .to('.hsbtn-in', { yPercent: 0, duration: 0.7, ease: 'power3.out' });
}

/* ---------------------------------------------------- intro / loader */
const heroBits = ['.hero__title .hl', '.hero__subtitle .hl'];
gsap.set(heroBits, {
  opacity: 0,
  transformPerspective: 1000,
  rotateY: 60,
  rotateX: 35,
  x: -160,
  y: 90,
});
gsap.set('.hsbtn-in', { yPercent: 130 });
gsap.set('#webgl', { opacity: 0 });
gsap.set('.header', { opacity: 0, y: -12 });

const loaderTl = gsap.timeline();
gsap.set('.loader-hex', { strokeDasharray: 600, strokeDashoffset: 600 });
gsap.set('.loader-drop', { svgOrigin: '48 58', scale: 0, opacity: 0 });
gsap.set('.loader-leaf', { svgOrigin: '69 30', scale: 0, opacity: 0 });

loaderTl
  .from('.loader__ellipse', { opacity: 0, scale: 0.92, rotation: -7, duration: 1.4, ease: 'power2.out', stagger: 0.15, transformOrigin: '50% 50%' }, 0)
  .to('.loader-hex', { strokeDashoffset: 0, duration: 0.95, ease: 'power2.inOut' }, 0.2)
  .to('.loader-drop', { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(2)' }, 0.75)
  .to('.loader-leaf', { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.4)' }, 1.0)
  .to({}, { duration: 0.45 }); // settle

function intro() {
  const tl = gsap.timeline();
  tl.to('#loader .loader__logo', { scale: 0.72, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0)
    .to('.loader__ellipse', { opacity: 0, duration: 0.45 }, 0.05)
    .to('#loader', { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, 0.32)
    .add(() => {
      document.body.classList.remove('is-locked');
      ScrollTrigger.refresh();
    }, 0.7)
    .to('#webgl', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.45)
    .fromTo(app.camPos,
      {
        x: heroPos.x - 9,
        y: heroPos.y + 11,
        z: heroPos.z + 16,
      },
      { x: heroPos.x, y: heroPos.y, z: heroPos.z, duration: 2.2, ease: 'power3.out' }, 0.4)
    .to(heroBits, {
      opacity: 1,
      rotateY: 0,
      rotateX: 0,
      x: 0,
      y: 0,
      duration: 1.5,
      stagger: 0.09,
      ease: 'expo.out',
    }, 0.75)
    .to('.header', { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 1.0)
    .to('.hsbtn-in', { yPercent: 0, duration: 0.8, ease: 'power3.out' }, 1.25)
    .add(scrollHintLoop, 1.6);
  return tl;
}

Promise.all([
  document.fonts?.ready ?? Promise.resolve(),
  new Promise((res) => loaderTl.eventCallback('onComplete', res)),
]).then(intro);

/* ---------------------------------------------------- custom cursor + magnetic buttons */
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const dot = document.createElement('div');
  dot.id = 'cursor';
  const ring = document.createElement('div');
  ring.id = 'cursor-ring';
  ring.innerHTML = '<svg viewBox="0 0 100 100"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27"/></svg>';
  document.body.append(dot, ring);
  // the dotted hexagon spins continuously (and faster on hover)
  const hex = ring.querySelector('svg');
  const spin = gsap.to(hex, { rotation: 360, duration: 9, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });

  let mx = window.innerWidth / 2, my = window.innerHeight / 2, rx = mx, ry = my;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
  }, { passive: true });
  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.2; ry += (my - ry) * 0.2;
    ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
  });
  document.addEventListener('pointerover', () => { dot.style.opacity = ring.style.opacity = '1'; });
  document.addEventListener('mouseleave', () => { dot.style.opacity = ring.style.opacity = '0'; });

  document.querySelectorAll('a, button, .pill-btn, .faq-item__header, .footer-nav-btn, .flow__header').forEach((el) => {
    el.addEventListener('pointerenter', () => { ring.classList.add('is-hover'); gsap.to(spin, { timeScale: 3, duration: 0.4 }); });
    el.addEventListener('pointerleave', () => { ring.classList.remove('is-hover'); gsap.to(spin, { timeScale: 1, duration: 0.4 }); });
  });

  document.querySelectorAll('.pill-btn, .footer-nav-btn').forEach((btn) => {
    const strength = btn.classList.contains('footer-nav-btn') ? 0.16 : 0.4;
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.4, ease: 'power3.out',
      });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.4)' }));
  });
}
