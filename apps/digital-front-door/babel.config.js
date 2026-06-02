// SDK 56 note: do NOT add `react-native-reanimated/plugin` here.
// `babel-preset-expo` auto-configures Reanimated 4 + react-native-worklets.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  }
}
