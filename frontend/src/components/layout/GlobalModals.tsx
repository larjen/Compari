'use client';

import { useModal } from '@/hooks/useModal';
import { useToast } from '@/hooks/useToast';
import { SettingsModal } from '@/components/modals';

export function GlobalModals() {
  const { activeModal, closeModal } = useModal();
  const { addToast } = useToast();

  return (
    <SettingsModal
      open={activeModal === 'settings'}
      onClose={closeModal}
      onSuccess={(msg) => addToast('success', msg)}
      onError={(msg) => addToast('error', msg)}
    />
  );
}
