const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: [
    'vuetify'
  ],
  devServer: {
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:2233',
        ws: true,
      },
    },
  },
})
