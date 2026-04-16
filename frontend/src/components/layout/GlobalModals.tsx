'use client';

import { useModal } from '@/hooks/useModal';
import { useToast } from '@/hooks/useToast';
import { SettingsModal } from '@/components/modals';
import { MODAL_TYPES, TOAST_TYPES } from '@/lib/constants';

export function GlobalModals() {
  const { activeModal, closeModal } = useModal();
  const { addToast } = useToast();

  return (
    <SettingsModal
      open={activeModal === MODAL_TYPES.SETTINGS}
      onClose={closeModal}
      onSuccess={(msg) => addToast(TOAST_TYPES.SUCCESS, msg)}
      onError={(msg) => addToast(TOAST_TYPES.ERROR, msg)}
    />
  );
}
