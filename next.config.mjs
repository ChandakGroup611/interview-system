/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow larger request bodies for audio uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // External packages that need to be bundled for server-side
  serverExternalPackages: ['pdfkit', 'nodemailer'],

  // Headers for audio/CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
