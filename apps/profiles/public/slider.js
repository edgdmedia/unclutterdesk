// Home hero carousel (index.astro). Progressive enhancement only: without
// this file the slides still swipe (CSS scroll-snap) and the arrows and dots
// are plain links. This keeps the active dot in sync and makes the arrows
// step one slide without jumping the page. It never moves on its own.
(function () {
  var slider = document.querySelector('[data-slider]');
  if (!slider) return;
  var slides = Array.prototype.slice.call(slider.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('[data-slide-dot]'));
  var prev = document.querySelector('[data-slide-prev]');
  var next = document.querySelector('[data-slide-next]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = 0;

  function show(index) {
    var i = Math.max(0, Math.min(slides.length - 1, index));
    slider.scrollTo({ left: slides[i].offsetLeft - slider.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
  }
  function mark(index) {
    current = index;
    dots.forEach(function (d, i) {
      if (i === index) d.setAttribute('aria-current', 'true');
      else d.removeAttribute('aria-current');
    });
    if (prev) prev.setAttribute('aria-disabled', String(index === 0));
    if (next) next.setAttribute('aria-disabled', String(index === slides.length - 1));
  }

  dots.forEach(function (d, i) {
    d.addEventListener('click', function (e) { e.preventDefault(); show(i); });
  });
  if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); show(current - 1); });
  if (next) next.addEventListener('click', function (e) { e.preventDefault(); show(current + 1); });
  slider.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) mark(slides.indexOf(entry.target));
      });
    }, { root: slider, threshold: [0.6] });
    slides.forEach(function (s) { io.observe(s); });
  }
  // A link to #dashboard (the menu) opens on that slide.
  var start = slides.findIndex(function (s) { return '#' + s.id === location.hash; });
  if (start > 0) { slider.scrollLeft = slides[start].offsetLeft - slider.offsetLeft; mark(start); } else mark(0);
})();
