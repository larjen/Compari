'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MODAL_TYPES } from '@/lib/constants';

/**
 * Modal type derived from centralized constants.
 * Prevents magic string errors in modal type definitions.
 */
export type ModalType = typeof MODAL_TYPES[keyof typeof MODAL_TYPES];

/**
 * Context shape for modal state management.
 */
interface ModalContextType {
  /** The currently active modal type */
  activeModal: ModalType;
  /** Opens a specific modal type */
  openModal: (modal: ModalType) => void;
  /** Closes any active modal */
  closeModal: () => void;
}

/**
 * Default context values for modal state.
 */
const defaultContext: ModalContextType = {
  activeModal: null,
  openModal: () => {},
  closeModal: () => {},
};

/**
 * Modal context for global create intent management.
 * * This context provides a way for the Navbar to trigger create actions
 * that are handled by individual pages. It follows the Separation of
 * Concerns principle by keeping navigation separate from modal logic.
 */
const ModalContext = createContext<ModalContextType>(defaultContext);

/**
 * Modal provider component that wraps the application.
 * * @param children - Child components that will have access to the modal context
 */
export function ModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  return (
    <ModalContext.Provider value={{ activeModal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

/**
 * Hook to access modal context values.
 * * @returns The modal context object containing activeModal, openModal, and closeModal
 * @throws Error if used outside of ModalProvider
 */
export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}