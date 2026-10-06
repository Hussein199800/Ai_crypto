export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class NotSupportedError extends ProviderError {
  constructor(provider: string, what: string) {
    super(provider, `غير مدعوم لدى ${provider}: ${what}`, undefined, false);
    this.name = "NotSupportedError";
  }
}

export class UnknownSymbolError extends Error {
  constructor(public readonly symbol: string) {
    super(`الرمز غير مدعوم: ${symbol}`);
    this.name = "UnknownSymbolError";
  }
}
