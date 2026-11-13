import { z } from 'zod';

/** Ausência não é zero. Valores presentes e malformados invalidam o resultado. */
export const fiscalNumber = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const text = value.trim().replace(/^R\$\s*/, '');
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) {
    return Number(text.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+(?:[.,]\d{1,2})?$/.test(text)) return Number(text.replace(',', '.'));
  return value;
}, z.number().finite().positive().nullable());

export const fiscalYear = z.preprocess(
  (value) => (typeof value === 'string' && /^\d{4}$/.test(value) ? Number(value) : value),
  z.number().int().min(1900).max(9999),
);

export const cadastralNumber = z
  .string()
  .trim()
  .regex(/^\d[\d.\-/]*$/);
