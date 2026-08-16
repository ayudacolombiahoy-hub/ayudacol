import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Las capturas viajan en base64 por Server Action; el default (1MB) no alcanza.
    serverActions: { bodySizeLimit: '20mb' },
  },
}

export default withNextIntl(nextConfig)
