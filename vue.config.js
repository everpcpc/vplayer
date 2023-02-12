const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: [
    'vuetify'
  ],
  configureWebpack: config => {
    if (process.env.NODE_ENV === 'production') {
      config.mode = 'production';
      config.optimization = {
        splitChunks: {
          chunks: "all",
        },
      }
    }
  },
  devServer: {
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:2233',
        ws: true,
      },
    },
  },
})
