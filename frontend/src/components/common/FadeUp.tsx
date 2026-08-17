import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { fadeUpStagger } from '@/lib/motion';

export interface FadeUpProps {
  children: ReactNode;
  /** Stagger index, not seconds — each step adds 0.15s (e.g. delay={1} = 0.15s). */
  delay?: number;
  className?: string;
}

export function FadeUp({ children, delay = 0, className }: FadeUpProps) {
  return (
    <motion.div
      custom={delay}
      variants={fadeUpStagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
