module.exports = {
  presets: [
    [
      '@babel/preset-env',
      { 
        targets: { node: 'current' },
        modules: 'auto' // Let Webpack handle module resolution
      },
    ],
    '@babel/preset-react' // Add React preset for broader JS syntax support
  ],
};