// Adds the GitHub Pages sub-path only for the web build in CI (EXPO_BASE_URL=/code-names-substitute).
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...(config.experiments || {}), baseUrl: process.env.EXPO_BASE_URL || '' },
});
