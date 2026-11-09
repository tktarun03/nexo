// Horizontal identity-card carousel (Swiper). Cards scale/fade as they leave
// the centre; the next and previous cards peek in at the edges.
import Swiper from 'swiper';
import { A11y, Keyboard, Pagination } from 'swiper/modules';
import 'swiper/css';
import { h, prefersReducedMotion, haptic } from '../utils/dom.js';
import { t } from '../utils/i18n.js';
import { icon } from './Icon.js';

/**
 * @param {{slides: HTMLElement[], initialIndex?: number, onChange?: (i:number)=>void, onAdd?: ()=>void}} opts
 */
export function CardCarousel({ slides, initialIndex = 0, onChange, onAdd }) {
  const wrapper = h('div', { class: 'swiper-wrapper' });
  for (const s of slides) wrapper.append(h('div', { class: 'swiper-slide' }, s));
  if (onAdd) {
    wrapper.append(
      h(
        'div',
        { class: 'swiper-slide' },
        h(
          'button',
          { type: 'button', class: 'id-card add-card', onclick: onAdd, 'data-testid': 'add-card-slide' },
          h('span', { class: 'add-card-icon' }, icon('Plus', { size: 28 })),
          h('strong', null, t('New card')),
          h('span', null, t('Professional, social, business or your own')),
        ),
      ),
    );
  }
  const pagination = h('div', { class: 'carousel-dots' });
  const root = h('div', { class: 'carousel', 'aria-roledescription': 'carousel', 'aria-label': t('Your identity cards') }, h('div', { class: 'swiper' }, wrapper), pagination);

  let swiper = null;
  const mount = () => {
    swiper = new Swiper(root.querySelector('.swiper'), {
      modules: [A11y, Keyboard, Pagination],
      slidesPerView: 'auto',
      centeredSlides: true,
      spaceBetween: 14,
      speed: prefersReducedMotion() ? 0 : 460,
      initialSlide: Math.min(initialIndex, slides.length - 1 + (onAdd ? 1 : 0)),
      grabCursor: true,
      resistanceRatio: 0.6,
      threshold: 6,
      touchStartPreventDefault: false,
      watchSlidesProgress: true,
      keyboard: { enabled: true, onlyInViewport: true },
      a11y: {
        prevSlideMessage: t('Previous card'),
        nextSlideMessage: t('Next card'),
        slideLabelMessage: t('Card {{index}} of {{slidesLength}}'),
      },
      pagination: { el: pagination, clickable: true, bulletClass: 'dot', bulletActiveClass: 'active' },
      on: {
        slideChange(s) {
          haptic(6);
          onChange?.(s.activeIndex);
        },
      },
    });
  };

  return {
    el: root,
    mount,
    destroy: () => swiper?.destroy(true, true),
    get index() {
      return swiper ? swiper.activeIndex : initialIndex;
    },
    slideTo: (i) => swiper?.slideTo(i),
  };
}
