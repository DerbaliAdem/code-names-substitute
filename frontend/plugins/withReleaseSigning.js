// Signs release APKs with a persistent keystore instead of the default RN debug keystore,
// so an update installs over the old app instead of being treated as a different app.
// The keystore itself is never committed: CI decodes it from a secret into
// android/app/release.keystore just before the build, and this plugin only wires Gradle to use
// it when the file and its env vars are present. Locally (no env vars, no file) release builds
// silently keep using the debug keystore, so `./gradlew assembleRelease` still works for testing.
const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let src = config.modResults.contents;
    if (!src.includes('RELEASE_KEYSTORE_PATH')) {
      src = src.replace(
        /signingConfigs\s*\{/,
        `signingConfigs {
        release {
            def storePath = System.getenv("RELEASE_KEYSTORE_PATH")
            if (storePath != null && file(storePath).exists()) {
                storeFile file(storePath)
                storePassword System.getenv("RELEASE_KEYSTORE_PASSWORD")
                keyAlias System.getenv("RELEASE_KEY_ALIAS")
                keyPassword System.getenv("RELEASE_KEY_PASSWORD")
            }
        }`
      );
      // Anchor on the comment React Native's template puts right above the release build type's
      // signingConfig line, so this only touches buildTypes.release, never signingConfigs.release.
      src = src.replace(
        /(\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\n\s*)signingConfig signingConfigs\.debug/,
        '$1signingConfig signingConfigs.release.storeFile != null ? signingConfigs.release : signingConfigs.debug'
      );
    }
    config.modResults.contents = src;
    return config;
  });
};
