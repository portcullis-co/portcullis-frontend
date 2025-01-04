# Use an official Node.js runtime as the base image
FROM node:20

# Install pnpm
RUN npm install -g pnpm

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install the application dependencies
RUN pnpm install

# Copy the rest of the application code to the working directory
COPY . .

# Build the Next.js application
RUN pnpm run build

# Expose both the Next.js and Inngest ports
EXPOSE 3000 8288

# Use an entrypoint script to handle environment variables
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Start the application
CMD ["pnpm", "start"]