export const ITEMS_PER_PAGE = 12;

export const getMasterContainer = (staggerDelay = 0.05, exitDuration = 0.1) => ({
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
      duration: 0.3,
      ease: "easeOut" as const
    }
  }
};
