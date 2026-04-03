// Suppress expected NestJS logger output during tests.
// Error-path tests intentionally trigger Logger.error — this keeps the output clean.
const { Logger } = require("@nestjs/common");
jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
