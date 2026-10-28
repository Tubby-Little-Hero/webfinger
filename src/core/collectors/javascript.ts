export const JS_GLOBAL_CHECKS: Array<[string, string]> = [
  ['React', 'React'],
  ['React.version', 'React'],
  ['__REACT_DEVTOOLS_GLOBAL_HOOK__', 'React'],
  ['ReactDOM', 'React'],
  ['__NEXT_DATA__', 'Next.js'],
  ['__NEXT_LOADED_PAGES__', 'Next.js'],
  ['Vue', 'Vue.js'],
  ['__VUE_DEVTOOLS_GLOBAL_HOOK__', 'Vue.js'],
  ['__VUE_OPTIONS_API__', 'Vue.js'],
  ['angular', 'Angular'],
  ['__NUXT__', 'Nuxt.js'],
  ['$nuxt', 'Nuxt.js'],
  ['__svelte', 'Svelte'],
  ['Alpine', 'Alpine.js'],
  ['htmx', 'HTMX'],
  ['jQuery', 'jQuery'],
  ['jQuery.fn.jquery', 'jQuery'],
  ['$', 'jQuery'],
  ['_', 'Lodash'],
  ['lodash', 'Lodash'],
  ['moment', 'Moment.js'],
  ['dayjs', 'Day.js'],
  ['axios', 'Axios'],
  ['Swiper', 'Swiper'],
  ['THREE', 'Three.js'],
  ['echarts', 'ECharts'],
  ['Chart', 'Chart.js'],
  ['Highcharts', 'Highcharts'],
  ['D3', 'D3.js'],
  ['d3', 'D3.js'],
  ['io', 'Socket.io'],
  ['antd', 'Ant Design'],
  ['MUI', 'Material UI'],
  ['Mui', 'Material UI'],
  ['wp', 'WordPress'],
  ['wp.apiFetch', 'WordPress'],
  ['Drupal', 'Drupal'],
  ['drupalSettings', 'Drupal'],
  ['DedeXHTTP', '织梦CMS (DedeCMS)'],
  ['DedeXHTTP2', '织梦CMS (DedeCMS)'],
  ['discuz_uid', 'Discuz!'],
  ['ga', 'Google Analytics'],
  ['gaData', 'Google Analytics'],
  ['_gaq', 'Google Analytics'],
  ['_hmt', '百度统计 (Baidu Tongji)'],
  ['_czc', 'CNZZ / 友盟+'],
  ['cnzz_protocol', 'CNZZ / 友盟+'],
  ['Piwik', 'Matomo (Piwik)'],
  ['Matomo', 'Matomo (Piwik)'],
  ['umami', 'Umami'],
  ['hj', 'Hotjar'],
  ['webpackJsonp', 'Webpack'],
  ['__webpack_public_path__', 'Webpack'],
  ['__webpack_hash__', 'Webpack'],
  ['__webpack_require__', 'Webpack'],
  ['__NEXT_DATA__', 'Next.js'],
  ['__NUXT__', 'Nuxt.js'],
  ['MtaH5', '腾讯移动分析 (MTA)'],
  ['Alpine', 'Alpine.js'],
  ['AOS', 'AOS'],
  ['gsap', 'GSAP'],
  ['TWEEN', 'Tween.js'],
  ['Masonry', 'Masonry'],
  ['Isotope', 'Isotope'],
  ['Fancybox', 'Fancybox'],
  ['Flickity', 'Flickity'],
  ['ApexCharts', 'ApexCharts'],
  ['Quill', 'Quill'],
  ['tinymce', 'TinyMCE'],
  ['CKEDITOR', 'CKEditor'],
  ['CodeMirror', 'Codemirror'],
  ['monaco', 'Monaco Editor'],
  ['pdfjsLib', 'PDF.js'],
  ['Stripe', 'Stripe'],
  ['firebase', 'Firebase'],
  ['Amplify', 'Amplify'],
  ['Twilio', 'Twilio'],
  ['AlpineData', 'Alpine.js'],
  ['SweetAlert', 'SweetAlert'],
  ['swal', 'SweetAlert'],
  ['ClipboardJS', 'Clipboard.js'],
  ['LazyLoad', 'LazyLoad'],
  ['echarts', 'ECharts'],
  ['mapboxgl', 'Mapbox GL JS'],
  ['leaflet', 'Leaflet'],
  ['Babel', 'Babel'],
  ['feather', 'Feather Icons'],
  ['REDUX_DEVTOOLS_EXTENSION__', 'Redux'],
  ['__REDUX_DEVTOOLS_EXTENSION__', 'Redux'],
  ['TanStack', 'TanStack Query'],
  ['createClient', 'Supabase'],
  ['supabase', 'Supabase'],
];

export const MAIN_WORLD_CHECK_SCRIPT = `
(function() {
  const results = {};
  const checks = ${JSON.stringify(JS_GLOBAL_CHECKS.map(([path]) => path))};

  for (const path of checks) {
    try {
      const parts = path.split('.');
      let val = window;
      let valid = true;
      for (const part of parts) {
        if (val === null || val === undefined) { valid = false; break; }
        val = val[part];
      }
      if (valid && val !== undefined) {
        results[path] = typeof val === 'string' ? val : 'true';
      }
    } catch (e) {
    }
  }

  return results;
})();
`;

export function parseJsGlobalsResult(
  rawResult: Record<string, string>
): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [path, value] of Object.entries(rawResult)) {
    const techName = JS_GLOBAL_CHECKS.find(([p]) => p === path)?.[1];
    if (techName) {
      mapped[techName] = value;
      if (path !== techName) {
        mapped[path] = value;
      }
    }
  }

  return mapped;
}
