import { initHero } from './hero-scene.js';

// ─── Hero Init ────────────────────────────────────────────────────────
const bgCanvas = document.getElementById('bg-canvas');
const hero = initHero(bgCanvas);

// Wire scroll → hero scene (rAF-batched for perf)
let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (!scrollTicking) {
    scrollTicking = true;
    requestAnimationFrame(() => {
      hero.setScrollProgress(window.scrollY);
      scrollTicking = false;
    });
  }
}, { passive: true });

// ─── Nav scroll behavior ──────────────────────────────────────────────
const nav = document.getElementById('nav');

function updateNav() {
  if (window.scrollY > window.innerHeight * 0.8) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

// ─── Mobile nav toggle ───────────────────────────────────────────────
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('open');
  navLinks.classList.toggle('open');
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('open');
    navLinks.classList.remove('open');
  });
});

// ─── GSAP Scroll Animations ──────────────────────────────────────────
gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hero overlay fade on scroll
gsap.to('#hero-overlay', {
  opacity: 0,
  y: -60,
  ease: 'none',
  scrollTrigger: {
    trigger: '#hero',
    start: 'top top',
    end: '50% top',
    scrub: true,
  },
});

// Scroll cue fade
gsap.to('#scroll-cue', {
  opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: '#hero',
    start: '10% top',
    end: '30% top',
    scrub: true,
  },
});

// Single overlay darkening + blur, driven by scroll
const overlay = document.getElementById('page-overlay');
if (overlay) {
  // Hero scroll: ramp from 0 → 0.75 opacity, 0 → 16px blur
  gsap.to(overlay, {
    '--overlay-alpha': 0.75,
    '--overlay-blur': '16px',
    ease: 'power2.in',
    scrollTrigger: {
      trigger: '#hero',
      start: '20% top',
      end: '100% top',
      scrub: true,
    },
  });

  // Post-hero: slow ramp 0.75 → 0.88, starts at hero bottom → through work
  gsap.fromTo(overlay,
    { '--overlay-alpha': 0.75 },
    {
      '--overlay-alpha': 0.88,
      immediateRender: false,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: '100% top',
        endTrigger: '.work',
        end: 'bottom top',
        scrub: true,
      },
    }
  );
}

// ─── Section reveals ─────────────────────────────────────────────────

if (!prefersReducedMotion) {
  // Generic section reveal: eyebrow -> heading -> body stagger
  document.querySelectorAll('.section').forEach(section => {
    const eyebrow = section.querySelector('.eyebrow');
    const heading = section.querySelector('.section-heading');
    const body = section.querySelector('.about-body, .contact-intro');

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        end: 'top 40%',
        toggleActions: 'play none none reverse',
      },
    });

    if (eyebrow) {
      tl.from(eyebrow, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      });
    }

    if (heading) {
      tl.from(heading, {
        opacity: 0,
        y: 25,
        scale: 0.98,
        duration: 0.6,
        ease: 'power2.out',
      }, '-=0.3');
    }

    if (body) {
      tl.from(body, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: 'power2.out',
      }, '-=0.3');
    }
  });

  // Service cards stagger from below
  gsap.from('#services .card', {
    opacity: 0,
    y: 40,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#services .card-grid',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Approach items stagger up from timeline
  gsap.from('#approach .approach-item', {
    opacity: 0,
    y: 30,
    duration: 0.5,
    stagger: 0.12,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#approach .approach-timeline',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Work cards scale + fade
  gsap.from('#work .work-card', {
    opacity: 0,
    y: 40,
    scale: 0.97,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#work .work-grid',
      start: 'top 80%',
      toggleActions: 'play none none reverse',
    },
  });

  // Shooting star dividers
  document.querySelectorAll('.section:not(.contact)').forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'bottom 90%',
      once: true,
      onEnter: () => section.classList.add('star-fired'),
    });
  });

  // Contact form reveal
  gsap.from('#contact .contact-form', {
    opacity: 0,
    y: 30,
    duration: 0.6,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: '#contact .contact-form',
      start: 'top 85%',
      toggleActions: 'play none none reverse',
    },
  });
}

// Teaser card glow pulse — desktop only
gsap.matchMedia().add('(min-width: 768px)', () => {
  const teaserCard = document.querySelector('.work-card-teaser');
  if (teaserCard && !prefersReducedMotion) {
    gsap.to(teaserCard, {
      boxShadow: '0 0 30px rgba(42,107,69,0.15), inset 0 0 30px rgba(42,107,69,0.05)',
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      scrollTrigger: {
        trigger: teaserCard,
        start: 'top 90%',
        toggleActions: 'play pause resume pause',
      },
    });
  }
});

// ─── Card tilt hover effect (desktop only) ──────────────────────────
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.querySelectorAll('.card, .work-card:not(.work-card-teaser)').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px) scale(1.01)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

// ─── Contact form submission ──────────────────────────────────────────
const form = document.getElementById('contact-form');
const formStatus = document.getElementById('form-status');
const btnSubmit = document.getElementById('btn-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Sending...';
  formStatus.textContent = '';
  formStatus.className = 'form-status';

  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    message: form.message.value.trim(),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    if (res.ok) {
      formStatus.textContent = 'Message sent. We\'ll be in touch.';
      formStatus.classList.add('success');
      form.reset();
    } else {
      throw new Error('Server error');
    }
  } catch {
    formStatus.textContent = 'Something went wrong. Email us at hello@unify-labs.dev instead.';
    formStatus.classList.add('error');
  } finally {
    clearTimeout(timeout);
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Send Message';
  }
});
