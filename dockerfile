# Stage 1: Build the application
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Install build tools and libraries
RUN apk add --no-cache python3 make g++

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the application code
COPY . .


COPY .env ./



# Build the application
RUN npm run build

# Stage 2: Create the lightweight production image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install runtime dependencies
RUN apk add --no-cache libstdc++

# Copy only the production build from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/.env ./


# Expose the necessary port
EXPOSE 4080

# Start the application
CMD node dist/main
