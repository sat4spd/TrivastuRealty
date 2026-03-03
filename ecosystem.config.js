module.exports = {
    apps: [
        {
            name: 'trivastu-backend',
            script: './backend/server.js',
            cwd: '/home/ubuntu/app',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            },
            error_file: '/home/ubuntu/app/logs/backend-error.log',
            out_file: '/home/ubuntu/app/logs/backend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
        },
        {
            name: 'trivastu-dashboard',
            script: 'node_modules/.bin/next',
            args: 'start',
            cwd: '/home/ubuntu/app/dashboard',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            env: {
                NODE_ENV: 'production',
                PORT: 3001,
                NEXT_PUBLIC_API_URL: 'https://api.yourdomain.com',
            },
            error_file: '/home/ubuntu/app/logs/dashboard-error.log',
            out_file: '/home/ubuntu/app/logs/dashboard-out.log',
        },
    ],
};
