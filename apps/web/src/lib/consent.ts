export const CONSENT_STORAGE_KEY = 'imovi:consent:v1';
export const CONSENT_EVENT = 'imovi:consent-changed';

export type ConsentChoice = 'essential' | 'ads';

export function readConsent(): ConsentChoice | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === 'essential' || value === 'ads' ? value : null;
}
