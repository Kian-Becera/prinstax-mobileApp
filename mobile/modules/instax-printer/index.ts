// Re-export the shared InstaxPrinter interface
// For a production dev build, swap this with a NativeModule implementation
export { InstaxPrinter } from '../../src/lib/instaxPrinter';
export type { PrinterStatus, PrinterDevice } from '../../src/lib/instaxPrinter';
