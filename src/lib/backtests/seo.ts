// JSON-LD for the open-source project page. Breadcrumbs come from the shared
// helper in src/lib/seo.ts; this adds the one type that file does not have.
import { absoluteUrl } from '../../i18n/config';
import type { Locale } from '../../i18n/config';
import { SITE_NAME } from '../seo';
import { REPO_URL } from './engine';

/**
 * The engine as schema.org SoftwareSourceCode. Only facts: where the code is,
 * its language, its licence and the version the published results were made
 * with. No ratings, no download counts.
 */
export function softwareSourceCodeLd(
  locale: Locale,
  page: { path: string; description: string; version: string },
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: SITE_NAME,
    description: page.description,
    url: absoluteUrl(locale, page.path),
    codeRepository: REPO_URL,
    programmingLanguage: 'Python',
    runtimePlatform: 'Python 3.10 or newer',
    license: 'https://opensource.org/licenses/MIT',
    version: page.version,
    isAccessibleForFree: true,
  };
}
