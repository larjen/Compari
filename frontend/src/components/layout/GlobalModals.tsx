'use client';

import { useModal } from '@/hooks/useModal';
import { useToast } from '@/hooks/useToast';
import { useCriterionOperations } from '@/hooks/useCriterionOperations';
import { useCriteria } from '@/hooks/useCriteria';
import { SettingsModal, CreateCriterionModal } from '@/components/modals';
import { MODAL_TYPES, TOAST_TYPES } from '@/lib/constants';

export function GlobalModals() {
  const { activeModal, closeModal } = useModal();
  const { addToast } = useToast();
  const { refetch } = useCriteria({ immediate: false });
  const { createWithToast } = useCriterionOperations({ onSuccess: refetch });

  return (
    <>
      <SettingsModal
        open={activeModal === MODAL_TYPES.SETTINGS}
        onClose={closeModal}
        onSuccess={(msg) => addToast(TOAST_TYPES.SUCCESS, msg)}
        onError={(msg) => addToast(TOAST_TYPES.ERROR, msg)}
      />
      <CreateCriterionModal
        open={activeModal === MODAL_TYPES.CREATE_CRITERION}
        onClose={closeModal}
        onCreateCriterion={createWithToast}
      />
    </>
  );
}
