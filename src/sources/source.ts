import type { SourceFetchOptions, SourceResult } from '../types.js';

export interface ReviewsSource {
  fetch(options: SourceFetchOptions): Promise<SourceResult>;
}
