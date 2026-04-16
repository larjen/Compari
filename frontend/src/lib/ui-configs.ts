import { UI_CONFIG } from './constants';

export const getMasterContainer = (
  staggerDelay: number = UI_CONFIG.ANIMATION.STAGGER_DELAY, 
  exitDuration: number = UI_CONFIG.ANIMATION.EXIT_DURATION
) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: staggerDelay,
      when: "beforeChildren"
    }
  },
  exit: {
    opacity: 0,
    transition: { duration: exitDuration }
  }
});

export const masterItem = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: UI_CONFIG.ANIMATION.ENTRY_DURATION,
      ease: UI_CONFIG.ANIMATION.EASING_OUT
    }
  }
};