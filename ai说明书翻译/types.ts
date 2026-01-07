export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING_FILE = 'PROCESSING_FILE',
  LOCATING_PAGE = 'LOCATING_PAGE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GeneratedResult {
  html: string;
  rawResponse: string;
}

export interface FileData {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface PageConfig {
  pageRange: string;
}