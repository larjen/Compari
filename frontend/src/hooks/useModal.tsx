'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Modal type enumeration for create actions.
 */
export type ModalType = 'create-requirement' | 'create-offering' | 'create-match' | 'create-criterion' | 'create-blueprint' | 'create-dimension' | 'settings' | null;

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