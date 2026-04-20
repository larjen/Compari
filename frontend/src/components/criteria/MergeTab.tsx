'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DOMAIN_ICONS } from '@/lib/iconRegistry';
import { Criterion } from '@/lib/types';
import { criteriaApi } from '@/lib/api/criteriaApi';
import { useToast } from '@/hooks/useToast';
import { useDimensions } from '@/hooks/useDimensions';
import { formatPercentage } from '@/lib/utils';
import { CriterionPill } from '@/components/shared/CriterionPill';
import { Button } from '@/components/ui';
import { TOAST_TYPES } from '@/lib/constants';

interface MergeTabProps {
  criterion: Criterion;
  onMerged: () => void;
}

export function MergeTab({ criterion, onMerged }: MergeTabProps) {
  const { addToast } = useToast();
  const { dimensions } = useDimensions();
  const [similar, setSimilar] = useState<{ criterion: Criterion; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    criteriaApi.getSimilarCriteria(criterion.id)
      .then(data => { if (isMounted) setSimilar(data); })
      .catch(err => console.error(err))
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [criterion.id]);

  const handleMerge = async (removeId: number) => {
    setIsProcessing(true);
    try {
      await criteriaApi.mergeCriteria(criterion.id, removeId);
      addToast(TOAST_TYPES.SUCCESS, 'Criteria merged successfully');
      setSimilar(prev => prev.filter(s => s.criterion.id !== removeId));
      onMerged();
    } catch (err) {
      addToast(TOAST_TYPES.ERROR, 'Failed to merge criteria');
    } finally {
      setIsProcessing(false);
      setConfirmId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><DOMAIN_ICONS.LOADING className="w-6 h-6 animate-spin text-accent-sage" /></div>;
  if (similar.length === 0) return <div className="text-center py-10 text-accent-forest/40">No similar criteria found.</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-accent-forest/60 mb-4">
        Select a similar criterion to merge <strong>it into {criterion.displayName}</strong>. The original will be deleted.
      </p>
      {similar.map((item, idx) => {
        const itemDimensionId = item.criterion.dimensionId ?? 0;
        const isConfirming = confirmId === item.criterion.id;

        return (
          <motion.div
            key={item.criterion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center justify-between p-3 bg-white border border-border-light rounded-xl hover:border-accent-sage transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-bold text-accent-forest w-10 text-right">{formatPercentage(item.score)}</span>
              <CriterionPill
                id={item.criterion.id}
                label={item.criterion.displayName}
                dimensionId={itemDimensionId}
                className="min-w-0"
              />
            </div>

            <div className="flex items-center">
              {isConfirming ? (
                <div className="flex items-center gap-2">
                  <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => handleMerge(item.criterion.id)} 
                    disabled={isProcessing}
                  >
                    {isProcessing ? <DOMAIN_ICONS.LOADING className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setConfirmId(null)} 
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setConfirmId(item.criterion.id)}
                >
                  <DOMAIN_ICONS.MERGE className="w-4 h-4 mr-2" />
                  Merge
                </Button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
