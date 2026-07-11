/**
 * E-mail do módulo de auditoria (fase 5): relatório diário + cliente Resend.
 */
export {
  buildDailyReport,
  dailyReportHtml,
  type DailyReport,
  type DailyReportInput,
  type ReportAnomaliaRow,
  type ReportCorretorRow,
  type ReportLeadRow,
  type ReportNegocioRow,
  type TopCorretor,
} from './daily-report.js';
export { sendEmail, type SendEmailOpts, type SendEmailResult } from './resend.js';
