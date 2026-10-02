import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Joins class names, skipping falsy ones (clsx) and letting a later Tailwind class
// win over an earlier conflicting one (tailwind-merge): cn('p-2', cond && 'p-4') -> 'p-4'.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
