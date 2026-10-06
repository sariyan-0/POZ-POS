const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const assetRegistryShim = path.resolve(
  __dirname,
  'src/shims/reactNativeAssetsRegistry.js',
);

const config = {
  watchFolders: [path.resolve(__dirname, '../oneregister/packages/commerce-core')],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@react-native/assets-registry/registry') {
        return {
          type: 'sourceFile',
          filePath: assetRegistryShim,
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
