module.exports = ({ config }) => {
  const IS_DEV = process.env.APP_VARIANT === 'development';

  return {
    ...config,
    name: IS_DEV ? 'KeepYourSeed (Dev)' : (config.name || 'KeepYourSeed'),
    slug: 'KeepYourSeed',
    scheme: IS_DEV ? 'keepyourseed-dev' : (config.scheme || 'keepyourseed'),
    ios: {
      ...config.ios,
      bundleIdentifier: IS_DEV ? 'com.tianyr.KeepYourSeed.dev' : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: IS_DEV ? 'com.tianyr.KeepYourSeed.dev' : config.android?.package,
    },
  };
};
