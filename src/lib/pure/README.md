/**
 * Pure, dependency-free parsers and normalisers.
 *
 * These modules are imported by the provider adapters (and by the unit tests
 * under /tests). They deliberately use no path aliases and no server-only
 * imports so Node can type-strip and run them directly — which is what makes
 * the parsers testable without a separate build step.
 */
export {};
