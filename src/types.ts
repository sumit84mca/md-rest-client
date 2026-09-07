export type RequestBlock = {
  id: string;
  raw: string;
};

export type ParsedHttpRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

export type RequestExecutionResult = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  parsedJsonBody?: unknown;
};

export type EnvironmentVariables = Record<string, string>;
export type EnvironmentResolution = { name: string | undefined; variables: EnvironmentVariables };
