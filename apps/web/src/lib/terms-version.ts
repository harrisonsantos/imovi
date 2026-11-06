/**
 * Versões vigentes dos Termos de uso e da Política de privacidade.
 *
 * A versão é a data da última atualização (AAAA-MM-DD) exibida em cada
 * página. Ao alterar o texto de uma delas, atualize a data aqui: o cadastro
 * passa a exigir novo aceite e a trilha em `terms_acceptances` registra a
 * versão nova sem apagar as anteriores. Módulo seguro para o cliente.
 */
export const TERMS_VERSION = '2026-07-10';
export const PRIVACY_VERSION = '2026-09-30';

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** `2026-07-10` → `10 de julho de 2026`. */
export function formatVersionDate(version: string): string {
  const [year, month, day] = version.split('-').map(Number);
  return `${day} de ${MONTHS[(month ?? 1) - 1]} de ${year}`;
}
