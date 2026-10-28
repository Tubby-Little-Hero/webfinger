import type { TechnologyRules } from '../core/types';

import cms from './technologies/cms.json';
import servers from './technologies/servers.json';
import frameworks from './technologies/frameworks.json';
import cdn from './technologies/cdn.json';
import waf from './technologies/waf.json';
import analytics from './technologies/analytics.json';
import javascriptLibs from './technologies/javascript-libs.json';
import languages from './technologies/languages.json';
import databases from './technologies/databases.json';
import ecommerce from './technologies/ecommerce.json';
import fonts from './technologies/fonts.json';

const allRules: TechnologyRules = {
  ...cms,
  ...servers,
  ...frameworks,
  ...cdn,
  ...waf,
  ...analytics,
  ...javascriptLibs,
  ...languages,
  ...databases,
  ...ecommerce,
  ...fonts,
};

export default allRules;

export function getRuleCount(): number {
  return Object.keys(allRules).length;
}

export function getRulesByCategory(catId: number): TechnologyRules {
  const filtered: TechnologyRules = {};
  for (const [name, rule] of Object.entries(allRules)) {
    if (rule.cats.includes(catId)) {
      filtered[name] = rule;
    }
  }
  return filtered;
}
