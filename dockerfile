# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus

# Create app directory
WORKDIR /usr/src/app

# Set Puppeteer environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install puppeteer
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the lightweight production image
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dbus

# Create app directory
WORKDIR /usr/src/app

# Copy build artifacts
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/.env ./

# Set Puppeteer environment
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Expose port
EXPOSE 4080

# Start the application
CMD node dist/main