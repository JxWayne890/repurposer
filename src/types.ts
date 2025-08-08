export interface Clip {
  file?: string;
  videoUrl?: string;
  url?: string;
  caption?: string;
  text?: string;
}

export interface ApiResponse {
  clips?: Clip[];
  [key: string]: any;
}
