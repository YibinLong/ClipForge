import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

// Import platform-specific binary paths
// These will automatically resolve to the correct binary for the build platform
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

const config: ForgeConfig = {
  packagerConfig: {
    // Package app into asar for smaller size, but unpack native assets/binaries
    asar: {
      // Unpack these so binaries remain executable in production
      unpack: '{**/native_modules/**,**/ffmpeg,**/ffprobe,**/*.node}',
    },
    // Required for macOS identity and future signing/notarization
    appBundleId: 'com.clipforge.app',
    // Ensure ffmpeg/ffprobe binaries are present in packaged Resources
    // These paths are automatically resolved to the correct platform-specific binaries
    extraResource: [
      ffmpegPath,
      ffprobePath,
    ].filter((path): path is string => path !== null),
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerDMG({}),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      // LAX dev CSP to allow file:// thumbnails and dev tools
      devContentSecurityPolicy:
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: file:; " +
        "img-src 'self' data: blob: file:;",
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/renderer/index.html',
            js: './src/renderer/index.tsx',
            name: 'main_window',
            preload: {
              js: './src/preload/preload.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
