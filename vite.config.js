import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const devServerHost = env.VITE_DEV_SERVER_HOST || '10.10.12.20';
    const devServerPort = Number.parseInt(env.VITE_DEV_SERVER_PORT || '5173', 10);

    return {
        plugins: [
            laravel({
                input: 'resources/js/app.jsx',
                refresh: true,
            }),
            react(),
        ],
        server: {
            host: '0.0.0.0',
            port: Number.isNaN(devServerPort) ? 5173 : devServerPort,
            strictPort: true,
            origin: `http://${devServerHost}:${Number.isNaN(devServerPort) ? 5173 : devServerPort}`,
            hmr: {
                host: devServerHost,
                port: Number.isNaN(devServerPort) ? 5173 : devServerPort,
                clientPort: Number.isNaN(devServerPort) ? 5173 : devServerPort,
            },
        },
    };
});
