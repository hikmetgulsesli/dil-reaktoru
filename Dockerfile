FROM node:20-alpine

WORKDIR /app

# Install yt-dlp and dependencies
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip3 install --no-cache-dir yt-dlp && \
    apk add --no-cache wget curl

# Copy package files from backend
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code from backend
COPY backend/src ./src

# Create temp directory for cookies
RUN mkdir -p /tmp && chmod 777 /tmp

# Expose port
EXPOSE 3000

# Health check (use PORT env variable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
