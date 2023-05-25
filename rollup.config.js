import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'lib/esm/index.js',
  output: {
    file: 'build/doge-wallet.js',
    format: 'umd',
    name: 'dogeWallet',
    exports: 'named',
    preferConst: true,
  },
  plugins: [resolve({ browser: true })],
};
