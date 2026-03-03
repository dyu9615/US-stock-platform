module.exports = {
  apps: [{
    name: 'data-service',
    script: 'python3',
    args: 'data_service/app.py',
    env: {
      NODE_ENV: 'production',
      FACTSET_API_KEY: 'dI8TR8jny4a1nq4fCupLIZCT23GN9i8H4B6ukBq7',
      FACTSET_SERIAL:  'UNIV_MI-2185784',
    },
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    restart_delay: 3000,
  }]
}
