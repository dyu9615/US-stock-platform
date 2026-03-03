module.exports = {
  apps: [{
    name: 'data-service',
    script: 'python3',
    args: 'data_service/app.py',
    env: { NODE_ENV: 'production', FACTSET_API_KEY: '' },
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    restart_delay: 3000,
  }]
}
