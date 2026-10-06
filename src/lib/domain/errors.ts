export type DomainErrorCode =
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "INSUFFICIENT_PLAYERS"
  | "INVALID_COURT_COUNT"
  | "INVALID_RESULT"
  | "UNRESOLVED_MATCHES";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
