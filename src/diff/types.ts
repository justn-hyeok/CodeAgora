export interface DiffChunk {
  file: string;
  lineRange: [number, number];
  content: string;
  language: string;
}

export interface ExtractResult {
  success: true;
  chunks: DiffChunk[];
}

export interface ExtractError {
  success: false;
  error: string;
}

export type DiffResult = ExtractResult | ExtractError;
